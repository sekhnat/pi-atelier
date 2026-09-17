import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	applyDisplayTemplate,
	derivePresetIdentity,
	isSegmentId,
	legacySegmentsToLayout,
	normalizeSegmentLayout,
	PRODUCT_SEGMENT_ORDER,
} from "./display.js";
import {
	DEFAULT_CONFIG,
	type AtelierConfig,
	type ConfigurationSource,
	type DisplayLayerState,
	type DisplayProvenance,
	type DisplaySettings,
	type PresetName,
	type SegmentId,
	type SegmentLayout,
	type TemplateName,
} from "./types.js";
import {
	type DEFAULT_SIDEBAR_PANEL_LAYOUT,
	legacyPanelVisibilityFromLayout,
	normalizeSidebarPanelLayout,
} from "./sidebar-panels.js";

export interface ConfigLoadResult {
	config: AtelierConfig;
	warnings: string[];
	displayLayers: DisplayLayerState;
	displayProvenance: DisplayProvenance;
}

export interface LoadConfigOptions {
	userPath: string;
	projectPath: string;
	projectTrusted: boolean;
	session?: Record<string, unknown> | Partial<AtelierConfig>;
}

interface SidebarResolution {
	layout: AtelierConfig["sidebarPanelLayout"];
	warnings: string[];
	authoritative: boolean;
}

function cloneSidebarLayout(
	layout: AtelierConfig["sidebarPanelLayout"],
): AtelierConfig["sidebarPanelLayout"] {
	return layout.map((entry) => ({ ...entry }));
}

function parseSidebarLayout(
	value: unknown,
	warnings: string[],
): AtelierConfig["sidebarPanelLayout"] | undefined {
	if (!Array.isArray(value)) {
		warnings.push("sidebarPanelLayout must be an array");
		return undefined;
	}
	const entries: Array<{ id: (typeof DEFAULT_SIDEBAR_PANEL_LAYOUT)[number]["id"]; visible: boolean }> = [];
	for (const item of value) {
		if (!isRecord(item) || typeof item.id !== "string") {
			warnings.push("Ignoring malformed sidebarPanelLayout entry");
			continue;
		}
		const visible = item.visible;
		if (typeof visible !== "boolean") {
			warnings.push(`sidebar panel visibility for ${item.id} must be boolean; using hidden`);
		}
		entries.push({
			id: item.id as (typeof DEFAULT_SIDEBAR_PANEL_LAYOUT)[number]["id"],
			visible: visible === true,
		});
	}
	return normalizeSidebarPanelLayout(entries, warnings);
}

function setSidebarVisibility(
	layout: AtelierConfig["sidebarPanelLayout"],
	id: "agent" | "todos",
	visible: boolean,
): void {
	const entry = layout.find((item) => item.id === id);
	if (entry) entry.visible = visible;
}

function resolveSidebarLayout(
	layers: DisplayLayerState,
	base: AtelierConfig = DEFAULT_CONFIG,
): SidebarResolution {
	const warnings: string[] = [];
	const user = layers.user;
	if (user && "sidebarPanelLayout" in user) {
		const parsed = parseSidebarLayout(user.sidebarPanelLayout, warnings);
		return {
			layout: parsed ?? cloneSidebarLayout(base.sidebarPanelLayout),
			warnings,
			authoritative: true,
		};
	}
	const layout = cloneSidebarLayout(base.sidebarPanelLayout);
	// Legacy Agent and TODOS visibility are global-user-only compatibility inputs.
	// Project/session values are intentionally ignored.
	if (user && typeof user.showSidebarAgent === "boolean")
		setSidebarVisibility(layout, "agent", user.showSidebarAgent);
	if (user && typeof user.showSidebarTodos === "boolean")
		setSidebarVisibility(layout, "todos", user.showSidebarTodos);
	return { layout, warnings, authoritative: false };
}

const presets = new Set<PresetName>(["editorial", "minimal", "classic", "custom"]);
const densities = new Set(["comfortable", "compact"]);
const ornaments = new Set(["none", "restrained"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const record = (value: unknown): Record<string, unknown> | undefined => (isRecord(value) ? value : undefined);
const cloneConfig = (config: AtelierConfig): AtelierConfig => ({
	...config,
	segmentLayout: config.segmentLayout.map((entry) => ({ ...entry })),
	sidebarPanelLayout: cloneSidebarLayout(config.sidebarPanelLayout),
});

interface CompatibilityState {
	preset: PresetName;
	ornament: "none" | "restrained";
	brandListed: boolean;
	statusesListed: boolean;
	showStatuses: boolean;
}

interface DisplayResolution {
	display: DisplaySettings;
	provenance: DisplayProvenance;
	warnings: string[];
}

function parsePersistedLayout(value: unknown, warnings: string[]): SegmentLayout | undefined {
	if (!Array.isArray(value)) {
		warnings.push("segmentLayout must be an array");
		return undefined;
	}
	const seen = new Set<SegmentId>();
	const entries: SegmentLayout = [];
	for (const item of value) {
		if (!isRecord(item) || !isSegmentId(item.id)) {
			warnings.push(
				isRecord(item) && "id" in item
					? `Unknown segmentLayout segment: ${String(item.id)}`
					: "Ignoring malformed segmentLayout entry",
			);
			continue;
		}
		if (seen.has(item.id)) {
			warnings.push(`Ignoring duplicate segmentLayout segment: ${item.id}`);
			continue;
		}
		seen.add(item.id);
		let visible = item.visible;
		if (typeof visible !== "boolean") {
			warnings.push(`segmentLayout visibility for ${item.id} must be boolean; using hidden`);
			visible = false;
		}
		entries.push({ id: item.id, visible: visible === true });
	}
	return normalizeSegmentLayout(entries);
}

function parseLegacySegments(value: unknown, warnings: string[]): SegmentLayout | undefined {
	if (!Array.isArray(value)) {
		warnings.push("segments must be an array");
		return undefined;
	}
	const seen = new Set<SegmentId>();
	const valid: SegmentId[] = [];
	for (const item of value) {
		if (!isSegmentId(item)) {
			warnings.push(`Unknown segment: ${String(item)}`);
			continue;
		}
		if (seen.has(item)) {
			warnings.push(`Ignoring duplicate segment: ${item}`);
			continue;
		}
		seen.add(item);
		valid.push(item);
	}
	return legacySegmentsToLayout(valid);
}

export function resolveDisplayLayers(
	layers: DisplayLayerState,
	base: DisplaySettings = DEFAULT_CONFIG,
): DisplayResolution {
	let display: DisplaySettings = {
		preset: base.preset,
		density: base.density,
		segmentLayout: base.segmentLayout.map((entry) => ({ ...entry })),
	};
	const visibility = Object.fromEntries(PRODUCT_SEGMENT_ORDER.map((id) => [id, "product"])) as Record<
		SegmentId,
		ConfigurationSource
	>;
	const provenance: DisplayProvenance = {
		preset: "product",
		density: "product",
		order: "product",
		visibility,
	};
	const compatibility: CompatibilityState = {
		preset: "editorial",
		ornament: "none",
		brandListed: true,
		statusesListed: true,
		showStatuses: true,
	};
	const warnings: string[] = [];

	for (const [source, input] of [
		["user", layers.user],
		["project", layers.project],
		["session", layers.session],
	] as const) {
		if (!input) continue;
		let changedTemplateField = false;
		let suppliedPreset = false;
		if ("preset" in input) {
			if (typeof input.preset === "string" && presets.has(input.preset as PresetName)) {
				compatibility.preset = input.preset as PresetName;
				display.preset = input.preset as PresetName;
				provenance.preset = source;
				suppliedPreset = true;
				if (input.preset !== "custom") {
					display = applyDisplayTemplate(input.preset as TemplateName);
					provenance.density = source;
					provenance.order = source;
					for (const id of PRODUCT_SEGMENT_ORDER) provenance.visibility[id] = source;
					changedTemplateField = true;
				}
			} else
				warnings.push(
					typeof input.preset === "string" ? `Unknown preset: ${input.preset}` : "preset must be a string",
				);
		}
		if ("density" in input) {
			if (typeof input.density === "string" && densities.has(input.density)) {
				display.density = input.density as AtelierConfig["density"];
				provenance.density = source;
				changedTemplateField = true;
			} else
				warnings.push(
					typeof input.density === "string"
						? `Unknown density: ${input.density}`
						: "density must be a string",
				);
		}

		let authoritative = false;
		let legacySegmentsApplied = false;
		if ("segmentLayout" in input) {
			const parsed = parsePersistedLayout(input.segmentLayout, warnings);
			if (parsed) {
				display.segmentLayout = parsed;
				provenance.order = source;
				for (const id of PRODUCT_SEGMENT_ORDER) provenance.visibility[id] = source;
				compatibility.brandListed = parsed.find((entry) => entry.id === "brand")?.visible ?? false;
				compatibility.statusesListed = parsed.find((entry) => entry.id === "statuses")?.visible ?? false;
				authoritative = true;
				changedTemplateField = true;
			}
		}
		if (!authoritative && "segments" in input) {
			const parsed = parseLegacySegments(input.segments, warnings);
			if (parsed) {
				display.segmentLayout = parsed;
				provenance.order = source;
				for (const id of PRODUCT_SEGMENT_ORDER) provenance.visibility[id] = source;
				compatibility.brandListed = parsed.find((entry) => entry.id === "brand")?.visible ?? false;
				compatibility.statusesListed = parsed.find((entry) => entry.id === "statuses")?.visible ?? false;
				changedTemplateField = true;
				legacySegmentsApplied = true;
			}
		}

		if (!authoritative) {
			let brandCompatibilityChanged = suppliedPreset || legacySegmentsApplied;
			if ("ornament" in input) {
				if (typeof input.ornament === "string" && ornaments.has(input.ornament)) {
					compatibility.ornament = input.ornament as CompatibilityState["ornament"];
					brandCompatibilityChanged = true;
				} else
					warnings.push(
						typeof input.ornament === "string"
							? `Unknown ornament: ${input.ornament}`
							: "ornament must be a string",
					);
			}
			if (brandCompatibilityChanged) {
				const brand = display.segmentLayout.find((entry) => entry.id === "brand");
				if (brand)
					brand.visible =
						compatibility.brandListed &&
						compatibility.preset !== "editorial" &&
						compatibility.ornament === "restrained";
				provenance.visibility.brand = source;
				changedTemplateField = true;
			}
			let statusesCompatibilityChanged = legacySegmentsApplied;
			if ("showExtensionStatuses" in input) {
				if (typeof input.showExtensionStatuses === "boolean") {
					compatibility.showStatuses = input.showExtensionStatuses;
					statusesCompatibilityChanged = true;
				} else warnings.push("showExtensionStatuses must be boolean");
			}
			if (statusesCompatibilityChanged) {
				const statuses = display.segmentLayout.find((entry) => entry.id === "statuses");
				if (statuses) statuses.visible = compatibility.statusesListed && compatibility.showStatuses;
				provenance.visibility.statuses = source;
				changedTemplateField = true;
			}
		}

		const identity = derivePresetIdentity(display);
		if (identity !== display.preset) {
			display.preset = identity;
			if (changedTemplateField) provenance.preset = source;
		}
	}
	return { display, provenance, warnings: [...new Set(warnings)] };
}

/**
 * Fields that only the user configuration layer may set: they govern the
 * whole session rather than one display layer. Project and session values
 * are still type-checked (the warning contract is preserved) but are not
 * applied. Declared once; enforced by filter-on-apply in applyNonDisplay.
 */
const GLOBAL_USER_ONLY_FIELDS = [
	"showSidebarOnStartup",
	"completionNotifications",
	"showSidebarAgent",
	"showSidebarTodos",
] as const satisfies readonly (keyof AtelierConfig)[];

function applyNonDisplay(
	input: unknown,
	config: AtelierConfig,
	warnings: string[],
	source: ConfigurationSource = "user",
): void {
	if (!isRecord(input)) {
		if (input !== undefined) warnings.push("Configuration must be a JSON object");
		return;
	}
	if (typeof input.shortcut === "string") {
		if (input.shortcut.trim()) config.shortcut = input.shortcut.trim();
		else warnings.push("Shortcut cannot be empty");
	} else if ("shortcut" in input) warnings.push("shortcut must be a string");
	const invalidThresholdType =
		("contextWarning" in input && typeof input.contextWarning !== "number") ||
		("contextDanger" in input && typeof input.contextDanger !== "number");
	const warning = typeof input.contextWarning === "number" ? input.contextWarning : config.contextWarning;
	const danger = typeof input.contextDanger === "number" ? input.contextDanger : config.contextDanger;
	if (invalidThresholdType) warnings.push("context thresholds must be numbers");
	else if (warning >= 0 && warning < danger && danger <= 100) {
		config.contextWarning = warning;
		config.contextDanger = danger;
	} else if ("contextWarning" in input || "contextDanger" in input)
		warnings.push("Invalid context threshold ordering; expected 0 <= warning < danger <= 100");
	if (typeof input.currencyDecimals === "number") {
		if (
			Number.isInteger(input.currencyDecimals) &&
			input.currencyDecimals >= 0 &&
			input.currencyDecimals <= 6
		)
			config.currencyDecimals = input.currencyDecimals;
		else warnings.push("currencyDecimals must be an integer from 0 through 6");
	}
	const globalUserOnly = new Set<string>(GLOBAL_USER_ONLY_FIELDS);
	for (const key of ["showSessionActions", "showSidebarToolNames", ...GLOBAL_USER_ONLY_FIELDS] as const) {
		if (typeof input[key] === "boolean") {
			// Global-user-only fields filter on apply: every layer is type-checked,
			// but only the user layer's values land in the resolved config.
			if (source === "user" || !globalUserOnly.has(key)) config[key] = input[key];
		} else if (key in input) warnings.push(`${key} must be boolean`);
	}
}

/**
 * The single resolution pipeline behind the public entry points: applies the
 * non-display fields per layer in fixed user → project → session order
 * (global-user-only fields filter on apply inside applyNonDisplay, so the
 * re-override blocks net to nothing and are not needed), resolves the display
 * layers and the sidebar layout against `base`, assigns them, and derives the
 * legacy panel booleans from the single layout projection. A missing entry in
 * the layout keeps the fallback value.
 */
function resolveConfig(
	layers: { user?: unknown; project?: unknown; session?: unknown },
	options: { base?: AtelierConfig } = {},
): ConfigLoadResult {
	const base = options.base ?? DEFAULT_CONFIG;
	const config = cloneConfig(base);
	const warnings: string[] = [];
	applyNonDisplay(layers.user, config, warnings, "user");
	if (layers.project !== undefined) applyNonDisplay(layers.project, config, warnings, "project");
	if (layers.session !== undefined) applyNonDisplay(layers.session, config, warnings, "session");
	const userRecord = record(layers.user);
	const projectRecord = record(layers.project);
	const sessionRecord = record(layers.session);
	const displayLayers: DisplayLayerState = {
		...(userRecord ? { user: userRecord } : {}),
		...(projectRecord ? { project: projectRecord } : {}),
		...(sessionRecord ? { session: sessionRecord } : {}),
	};
	const resolved = resolveDisplayLayers(displayLayers, base);
	const sidebar = resolveSidebarLayout(displayLayers, base);
	Object.assign(config, resolved.display, { sidebarPanelLayout: cloneSidebarLayout(sidebar.layout) });
	if (sidebar.authoritative) {
		Object.assign(config, legacyPanelVisibilityFromLayout(sidebar.layout, config));
	}
	return {
		config,
		warnings: [...new Set([...warnings, ...resolved.warnings, ...sidebar.warnings])],
		displayLayers,
		displayProvenance: resolved.provenance,
	};
}

export function validateConfig(input: unknown, base: AtelierConfig = DEFAULT_CONFIG): ConfigLoadResult {
	return resolveConfig({ user: input }, { base });
}

async function readJson(path: string): Promise<{ value?: unknown; warning?: string }> {
	try {
		return { value: JSON.parse(await readFile(path, "utf8")) };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		return { warning: `Cannot load ${path}: ${error instanceof Error ? error.message : String(error)}` };
	}
}

export async function loadConfig(options: LoadConfigOptions): Promise<ConfigLoadResult> {
	const user = await readJson(options.userPath);
	const project = options.projectTrusted ? await readJson(options.projectPath) : { value: undefined };
	const layers = {
		user: user.value,
		project: project.value,
		session: options.session,
	};
	const result = resolveConfig(layers);
	const readWarnings = [user.warning, project.warning].filter((item): item is string => !!item);
	return { ...result, warnings: [...new Set([...readWarnings, ...result.warnings])] };
}

export async function saveUserConfigPatch(path: string, patch: Partial<AtelierConfig>): Promise<void> {
	let current: Record<string, unknown> = {};
	try {
		const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
		if (!isRecord(parsed)) throw new Error("User configuration must be a JSON object");
		current = parsed;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	await writeJsonAtomic(path, { ...current, ...patch });
}
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.tmp`;
	try {
		await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, { force: true }).catch(() => undefined);
	}
}
