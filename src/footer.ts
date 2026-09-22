import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { formatTokens } from "./metrics.js";
import { type AtelierPalette, createPalette, type PaletteRole } from "./palette.js";
import { responsePerformanceValues } from "./run-activity.js";
import { sanitizeTerminalText } from "./sanitize.js";
import type { AtelierConfig, AtelierMetrics, AtelierState, DisplayValue, FooterState } from "./types.js";

export interface ThemeLike {
	readonly name?: string;
	fg(color: string, text: string): string;
	bold(text: string): string;
	italic(text: string): string;
}

const WORKING_DOT_FRAMES = ["...", "..", "."] as const;
const WORKING_ANIMATION_INTERVAL_MS = 400;

// Nerd Font glyphs, matching the icon vocabulary used by shell prompts. Used
// only by the opt-in session ribbon surfaces; the plain Status Rail stays text-only.
const FOOTER_ICONS = {
	model: "\ueb08", // nf-cod-hubot
	thinking: "\uf0eb", // nf-fa-lightbulb
	git: "\uf418", // nf-oct-git_branch (Starship's Nerd Font preset)
	workspace: "\uf07b", // nf-fa-folder
	input: "\uf019", // nf-fa-download
	output: "\uf093", // nf-fa-upload
	cache: "\uf1c0", // nf-fa-database
	performance: "\uf017", // nf-fa-clock
	speed: "\uf0e7", // nf-fa-bolt
	context: "\uf2db", // nf-fa-microchip
	autoCompact: "\uf021", // nf-fa-refresh
	menu: "\uf013", // nf-fa-gear
	separator: "\ue0b1", // nf-pl-right_soft_divider
} as const;
type FooterZone = "left" | "right";
type FooterItemId =
	| "brand"
	| "status"
	| "activity"
	| "model"
	| "thinking"
	| "workspace"
	| "git"
	| "input"
	| "output"
	| "performance"
	| "cache"
	| "cost"
	| "context"
	| "menu";

interface FooterItem {
	id: FooterItemId;
	zone: FooterZone;
	full: string;
	compact: string;
	dropRank: number;
	required: boolean;
}

/** Ribbon render surfaces: the prompt-style header and the compact telemetry row. */
type FooterSurface = "header" | "telemetry";

const RIBBON_HEADER_ITEMS = new Set<FooterItemId>([
	"activity",
	"model",
	"thinking",
	"workspace",
	"git",
	"context",
]);

// Related readings share a quiet space; separate concerns get a visible divider.
const RIBBON_ITEM_GROUP: Record<FooterItemId, string> = {
	brand: "brand",
	status: "status",
	activity: "activity",
	model: "model",
	thinking: "model",
	workspace: "workspace",
	git: "workspace",
	input: "usage",
	output: "usage",
	cache: "usage",
	cost: "usage",
	performance: "performance",
	context: "context",
	menu: "menu",
};

// Ribbon width-drop order: secondary detail gives up first; required state remains.
const RIBBON_DROP = {
	thinking: 10,
	cost: 20,
	input: 40,
	output: 40,
	performance: 45,
	workspace: 50,
	cache: 50,
	git: 55,
	model: 60,
	menu: 60,
	activity: Number.POSITIVE_INFINITY,
	context: Number.POSITIVE_INFINITY,
	brand: Number.POSITIVE_INFINITY,
	status: Number.POSITIVE_INFINITY,
} as const;

const DROP = {
	brand: 0,
	status: 0,
	git: 10,
	thinking: 10,
	cost: 20,
	model: 30,
	input: 40,
	output: 40,
	performance: 45,
	cache: 50,
	menu: 60,
	activity: Number.POSITIVE_INFINITY,
	context: Number.POSITIVE_INFINITY,
} as const;

const sanitize = sanitizeTerminalText;

function paintValue(value: DisplayValue, role: PaletteRole, palette: AtelierPalette): string {
	return palette.paint(value.available ? role : "dim", value.text);
}

function metric(label: string, value: DisplayValue, palette: AtelierPalette, role: PaletteRole): string {
	return `${palette.paint("muted", label)} ${paintValue(value, role, palette)}`;
}

function availableValue(available: boolean, value: number): DisplayValue {
	return available && Number.isFinite(value)
		? { text: formatTokens(value), available: true }
		: { text: "—", available: false };
}

function percentValue(value: number | null | undefined, decimals: number): DisplayValue {
	return value !== null && value !== undefined && Number.isFinite(value)
		? { text: `${value.toFixed(decimals)}%`, available: true }
		: { text: "—", available: false };
}

function costValue(metrics: AtelierMetrics, decimals: number, compact: boolean): DisplayValue {
	if (!metrics.costAvailable || !Number.isFinite(metrics.cost)) return { text: "$—", available: false };
	const amount =
		compact && metrics.cost >= 1_000
			? formatTokens(metrics.cost)
			: metrics.cost.toFixed(compact ? Math.min(2, decimals) : decimals);
	return { text: `$${amount}`, available: true };
}

function contextRole(metrics: AtelierMetrics, config: AtelierConfig): PaletteRole {
	if (metrics.contextPercent === null || !Number.isFinite(metrics.contextPercent)) return "context";
	if (metrics.contextPercent >= config.contextDanger) return "error";
	if (metrics.contextPercent >= config.contextWarning) return "warning";
	return "context";
}

function activityText(
	state: AtelierState,
	palette: AtelierPalette,
	theme: ThemeLike,
	workingDots: string,
	compact: boolean,
): string {
	const fallback = state.activity.toUpperCase();
	const label = state.activity === "working" && !compact ? (state.workingLabel ?? fallback) : fallback;
	const dots =
		state.activity === "working" && !compact ? workingDots.padEnd(WORKING_DOT_FRAMES[0].length, " ") : "";
	const role: PaletteRole =
		state.activity === "ready"
			? "ready"
			: state.activity === "working"
				? "working"
				: state.activity === "warning"
					? "warning"
					: "error";
	return palette.paint(role, theme.bold(`● ${sanitize(label)}${dots}`));
}

function buildItems(
	state: FooterState,
	config: AtelierConfig,
	theme: ThemeLike,
	colorEnabled: boolean,
	workingDots: string,
): FooterItem[] {
	const palette = createPalette(theme, colorEnabled);
	const items: FooterItem[] = [];
	const itemIds = new Set<FooterItemId>();
	const compactDensity = config.density === "compact";
	const add = (item: FooterItem): void => {
		if (itemIds.has(item.id)) return;
		itemIds.add(item.id);
		items.push(compactDensity ? { ...item, full: item.compact } : item);
	};

	for (const entry of config.segmentLayout) {
		if (!entry.visible) continue;
		const segment = entry.id;
		if (segment === "brand") {
			const brand = palette.paint("muted", "ATELIER");
			add({
				id: "brand",
				zone: "left",
				full: brand,
				compact: brand,
				dropRank: DROP.brand,
				required: false,
			});
			continue;
		}

		if (segment === "activity") {
			add({
				id: "activity",
				zone: "left",
				full: activityText(state, palette, theme, workingDots, false),
				compact: activityText(state, palette, theme, workingDots, true),
				dropRank: DROP.activity,
				required: true,
			});
			continue;
		}

		if (segment === "model") {
			const model = state.modelId ? sanitize(state.modelId) : "";
			if (model) {
				const rendered = palette.paint("primary", model);
				add({
					id: "model",
					zone: "left",
					full: rendered,
					compact: rendered,
					dropRank: DROP.model,
					required: false,
				});
			}
			const thinking = state.thinkingLevel ? sanitize(state.thinkingLevel) : "";
			if (thinking) {
				const rendered = palette.paint("muted", thinking);
				add({
					id: "thinking",
					zone: "left",
					full: rendered,
					compact: rendered,
					dropRank: DROP.thinking,
					required: false,
				});
			}
			continue;
		}

		if (segment === "git") {
			const branch = state.branch ? sanitize(state.branch) : "";
			if (branch) {
				const rendered = `${palette.paint("primary", branch)}${state.dirty ? palette.paint("warning", "*") : ""}`;
				add({
					id: "git",
					zone: "left",
					full: rendered,
					compact: rendered,
					dropRank: DROP.git,
					required: false,
				});
			}
			continue;
		}

		if (segment === "statuses") {
			const statuses = state.extensionStatuses.map(sanitize).filter(Boolean).join(" ");
			if (statuses) {
				const rendered = palette.paint("muted", statuses);
				add({
					id: "status",
					zone: "left",
					full: rendered,
					compact: rendered,
					dropRank: DROP.status,
					required: false,
				});
			}
			continue;
		}

		if (segment === "metrics") {
			const metrics = state.metrics;
			const inputFull = metric("in", availableValue(metrics.usageAvailable, metrics.input), palette, "input");
			const outputFull = metric(
				"out",
				availableValue(metrics.usageAvailable, metrics.output),
				palette,
				"output",
			);
			const cacheHit = metric("cache", percentValue(metrics.cacheHitPercent, 0), palette, "cache");
			const cacheDetail = [
				metric("read", availableValue(metrics.usageAvailable, metrics.cacheRead), palette, "cache"),
				metrics.cacheWrite > 0
					? metric("write", availableValue(metrics.usageAvailable, metrics.cacheWrite), palette, "cache")
					: "",
				metric("hit", percentValue(metrics.latestCacheHitPercent, 1), palette, "cache"),
			]
				.filter(Boolean)
				.join(" ");
			const cost = `${paintValue(costValue(metrics, config.currencyDecimals, false), "cost", palette)}${
				metrics.subscription ? palette.paint("muted", " (sub)") : ""
			}`;

			add({
				id: "input",
				zone: "right",
				full: inputFull,
				compact: inputFull,
				dropRank: DROP.input,
				required: false,
			});
			add({
				id: "output",
				zone: "right",
				full: outputFull,
				compact: outputFull,
				dropRank: DROP.output,
				required: false,
			});
			add({
				id: "cache",
				zone: "right",
				full: config.preset === "classic" ? cacheDetail : cacheHit,
				compact: cacheHit,
				dropRank: DROP.cache,
				required: false,
			});
			add({ id: "cost", zone: "right", full: cost, compact: cost, dropRank: DROP.cost, required: false });
			continue;
		}

		if (segment === "performance") {
			const values = responsePerformanceValues(state.performance);
			const rendered = [
				metric("TTFT", values.ttft, palette, "output"),
				metric("TPS", values.tps, palette, "output"),
			].join(palette.paint("muted", " · "));
			add({
				id: "performance",
				zone: "right",
				full: rendered,
				compact: rendered,
				dropRank: DROP.performance,
				required: false,
			});
			continue;
		}

		if (segment === "context") {
			const metrics = state.metrics;
			const role = contextRole(metrics, config);
			const contextFull = `${metric("ctx", percentValue(metrics.contextPercent, 1), palette, role)}${
				metrics.autoCompact === true ? palette.paint("muted", " (auto)") : ""
			}`;
			const contextCompact = metric("ctx", percentValue(metrics.contextPercent, 0), palette, role);
			add({
				id: "context",
				zone: "right",
				full: contextFull,
				compact: contextCompact,
				dropRank: DROP.context,
				required: true,
			});
			continue;
		}

		if (segment === "menu") {
			const configuredShortcut = sanitize(config.shortcut);
			const shortcut = configuredShortcut.toLowerCase() === "alt+a" ? "⌥A" : configuredShortcut.toUpperCase();
			if (shortcut) {
				const rendered = palette.paint("menu", shortcut);
				add({
					id: "menu",
					zone: "right",
					full: rendered,
					compact: rendered,
					dropRank: DROP.menu,
					required: false,
				});
			}
		}
	}

	return items;
}

function renderItems(items: FooterItem[], compactIds: Set<FooterItemId>, separator: string): string {
	return items
		.map((item) => (compactIds.has(item.id) ? item.compact : item.full))
		.filter(Boolean)
		.join(separator);
}

function compose(items: FooterItem[], width: number, leftSeparator: string): string {
	const active = [...items];
	const compactIds = new Set<FooterItemId>();
	const left = () =>
		renderItems(
			active.filter((item) => item.zone === "left"),
			compactIds,
			leftSeparator,
		);
	const right = () =>
		renderItems(
			active.filter((item) => item.zone === "right"),
			compactIds,
			"  ",
		);
	const measured = () => visibleWidth(left()) + visibleWidth(right()) + (left() && right() ? 2 : 0);

	const droppable = active.filter((item) => !item.required).sort((a, b) => a.dropRank - b.dropRank);
	for (const item of droppable) {
		if (measured() <= width) break;
		const index = active.findIndex((candidate) => candidate.id === item.id);
		if (index >= 0) active.splice(index, 1);
	}

	for (const item of active.filter((candidate) => candidate.required)) {
		if (measured() <= width) break;
		if (item.full !== item.compact) compactIds.add(item.id);
	}

	const leftText = left();
	const rightText = right();
	const gap = width - visibleWidth(leftText) - visibleWidth(rightText);
	if (leftText && rightText && gap >= 2) return `${leftText}${" ".repeat(gap)}${rightText}`;
	return truncateToWidth([leftText, rightText].filter(Boolean).join("  "), width, "");
}

export function renderFooterLine(
	state: FooterState,
	config: AtelierConfig,
	theme: ThemeLike,
	width: number,
	colorEnabled = true,
	workingDots = "...",
): string {
	if (width <= 0) return "";
	const palette = createPalette(theme, colorEnabled);
	const line = compose(
		buildItems(state, config, theme, colorEnabled, workingDots),
		width,
		palette.paint("dim", " · "),
	);
	return truncateToWidth(line, width, "");
}

/**
 * Ribbon item builder for the opt-in session-ribbon surfaces. It reuses the
 * plain rail's value formatters and metric meanings but renders Nerd Font
 * prompt icons; the plain Status Rail path above stays untouched.
 */
function buildRibbonItems(
	state: FooterState,
	config: AtelierConfig,
	theme: ThemeLike,
	colorEnabled: boolean,
	workingDots: string,
	surface: FooterSurface,
): FooterItem[] {
	const palette = createPalette(theme, colorEnabled);
	const items: FooterItem[] = [];
	const itemIds = new Set<FooterItemId>();
	const icon = (symbol: string, text: string, role: PaletteRole = "muted"): string =>
		`${palette.paint(role, symbol)} ${text}`;
	const add = (item: FooterItem): void => {
		if (itemIds.has(item.id)) return;
		itemIds.add(item.id);
		items.push(item);
	};

	for (const entry of config.segmentLayout) {
		if (!entry.visible) continue;
		const segment = entry.id;

		if (surface === "header") {
			if (segment === "activity") {
				add({
					id: "activity",
					zone: "left",
					full: activityText(state, palette, theme, workingDots, false),
					compact: activityText(state, palette, theme, workingDots, true),
					dropRank: RIBBON_DROP.activity,
					required: true,
				});
				continue;
			}

			if (segment === "model") {
				const model = state.modelId ? sanitize(state.modelId) : "";
				if (model) {
					add({
						id: "model",
						zone: "left",
						full: icon(FOOTER_ICONS.model, palette.paint("accent", theme.bold(model)), "accent"),
						compact: icon(
							FOOTER_ICONS.model,
							palette.paint("accent", theme.bold(truncateToWidth(model, 24, "…"))),
							"accent",
						),
						dropRank: RIBBON_DROP.model,
						required: false,
					});
				}
				const thinking = state.thinkingLevel ? sanitize(state.thinkingLevel) : "";
				if (thinking) {
					const role: PaletteRole = thinking === "off" ? "dim" : "accent";
					add({
						id: "thinking",
						zone: "left",
						full: icon(FOOTER_ICONS.thinking, palette.paint(role, thinking), role),
						compact: icon(FOOTER_ICONS.thinking, palette.paint(role, thinking), role),
						dropRank: RIBBON_DROP.thinking,
						required: false,
					});
				}
				continue;
			}

			if (segment === "git") {
				const workspace = state.workspaceLabel ? sanitize(state.workspaceLabel) : "";
				if (workspace) {
					add({
						id: "workspace",
						zone: "left",
						full: icon(FOOTER_ICONS.workspace, palette.paint("cache", workspace), "cache"),
						compact: icon(
							FOOTER_ICONS.workspace,
							palette.paint("cache", truncateToWidth(workspace, 18, "…")),
							"cache",
						),
						dropRank: RIBBON_DROP.workspace,
						required: false,
					});
				}
				const branch = state.branch ? sanitize(state.branch) : "";
				if (branch) {
					add({
						id: "git",
						zone: "left",
						full: icon(
							FOOTER_ICONS.git,
							`${palette.paint("input", branch)}${state.dirty ? palette.paint("warning", "*") : ""}`,
							"input",
						),
						compact: icon(
							FOOTER_ICONS.git,
							`${palette.paint("input", truncateToWidth(branch, 18, "…"))}${state.dirty ? palette.paint("warning", "*") : ""}`,
							"input",
						),
						dropRank: RIBBON_DROP.git,
						required: false,
					});
				}
				continue;
			}

			if (segment === "context") {
				const metrics = state.metrics;
				const role = contextRole(metrics, config);
				const rendered = icon(
					FOOTER_ICONS.context,
					paintValue(percentValue(metrics.contextPercent, 1), role, palette),
					role,
				);
				add({
					id: "context",
					zone: "right",
					full: `${rendered}${
						Number.isFinite(metrics.contextWindow) && metrics.contextWindow > 0
							? palette.paint("muted", ` / ${formatTokens(metrics.contextWindow)}`)
							: ""
					}${metrics.autoCompact === true ? ` ${palette.paint("muted", FOOTER_ICONS.autoCompact)}` : ""}`,
					compact: rendered,
					dropRank: RIBBON_DROP.context,
					required: true,
				});
				continue;
			}
			continue;
		}

		// Telemetry surface: measured usage, cache, cost, and performance.
		if (segment === "metrics") {
			const metrics = state.metrics;
			const input = availableValue(metrics.usageAvailable, metrics.input);
			const output = availableValue(metrics.usageAvailable, metrics.output);
			const cache = percentValue(metrics.cacheHitPercent, 0);
			const cost = `${paintValue(costValue(metrics, config.currencyDecimals, true), "cost", palette)}${
				metrics.subscription ? palette.paint("muted", " (sub)") : ""
			}`;
			add({
				id: "input",
				zone: "left",
				full: icon(
					FOOTER_ICONS.input,
					paintValue(input, "input", palette),
					input.available ? "input" : "dim",
				),
				compact: icon(FOOTER_ICONS.input, paintValue(input, "input", palette)),
				dropRank: RIBBON_DROP.input,
				required: false,
			});
			add({
				id: "output",
				zone: "left",
				full: icon(
					FOOTER_ICONS.output,
					paintValue(output, "output", palette),
					output.available ? "output" : "dim",
				),
				compact: icon(FOOTER_ICONS.output, paintValue(output, "output", palette)),
				dropRank: RIBBON_DROP.output,
				required: false,
			});
			add({
				id: "cache",
				zone: "left",
				full: icon(
					FOOTER_ICONS.cache,
					paintValue(cache, "cache", palette),
					cache.available ? "cache" : "dim",
				),
				compact: icon(FOOTER_ICONS.cache, paintValue(cache, "cache", palette)),
				dropRank: RIBBON_DROP.cache,
				required: false,
			});
			add({
				id: "cost",
				zone: "left",
				full: cost,
				compact: cost,
				dropRank: RIBBON_DROP.cost,
				required: false,
			});
			continue;
		}

		if (segment === "performance") {
			const values = responsePerformanceValues(state.performance);
			const rendered = [
				icon(FOOTER_ICONS.performance, paintValue(values.ttft, "output", palette)),
				icon(
					FOOTER_ICONS.speed,
					paintValue(values.tps, "output", palette) +
						(values.tps.available ? palette.paint("muted", "/s") : ""),
				),
			].join("  ");
			add({
				id: "performance",
				zone: "right",
				full: rendered,
				compact: rendered,
				dropRank: RIBBON_DROP.performance,
				required: false,
			});
			continue;
		}

		if (segment === "menu") {
			const configuredShortcut = sanitize(config.shortcut);
			const shortcut = configuredShortcut.toLowerCase() === "alt+a" ? "⌥A" : configuredShortcut.toUpperCase();
			if (shortcut) {
				add({
					id: "menu",
					zone: "right",
					full: icon(FOOTER_ICONS.menu, palette.paint("menu", shortcut), "menu"),
					compact: palette.paint("menu", shortcut),
					dropRank: RIBBON_DROP.menu,
					required: false,
				});
			}
		}
	}

	return items;
}

function renderRibbonItems(
	items: FooterItem[],
	compactIds: Set<FooterItemId>,
	palette: AtelierPalette,
): string {
	return items
		.map((item, index) => {
			const text = compactIds.has(item.id) ? item.compact : item.full;
			const previous = items[index - 1];
			if (!previous) return text;
			if (RIBBON_ITEM_GROUP[previous.id] !== RIBBON_ITEM_GROUP[item.id]) {
				return `${palette.paint("dim", ` ${FOOTER_ICONS.separator} `)}${text}`;
			}
			const group = RIBBON_ITEM_GROUP[item.id];
			return `${group === "model" || group === "workspace" ? palette.paint("dim", " · ") : "  "}${text}`;
		})
		.join("");
}

/**
 * Renders one ribbon surface. The header flows left-to-right inside the
 * composer's top rule and gives up entirely (returning "") when it cannot fit,
 * letting the complete plain Status Rail render instead. The telemetry row is
 * the compact measured-usage strip below the composer.
 */
export function renderFooterRibbonLine(
	state: FooterState,
	config: AtelierConfig,
	theme: ThemeLike,
	width: number,
	colorEnabled: boolean,
	workingDots: string,
	surface: FooterSurface,
): string {
	if (width <= 0) return "";
	const palette = createPalette(theme, colorEnabled);
	let items = buildRibbonItems(state, config, theme, colorEnabled, workingDots, surface);
	if (surface === "telemetry") {
		const metrics = state.metrics;
		const available: Partial<Record<FooterItemId, boolean>> = {
			input: metrics.usageAvailable && Number.isFinite(metrics.input),
			output: metrics.usageAvailable && Number.isFinite(metrics.output),
			cache: Number.isFinite(metrics.cacheHitPercent),
			cost: metrics.costAvailable && Number.isFinite(metrics.cost),
			performance: responsePerformanceValues(state.performance).ttft.available,
		};
		items = items.filter((item) => available[item.id] !== false);
	}

	const active = [...items];
	const compactIds = new Set<FooterItemId>();
	const renderRow = (): string => {
		const leftText = renderRibbonItems(
			active.filter((item) => item.zone === "left"),
			compactIds,
			palette,
		);
		const rightText = renderRibbonItems(
			active.filter((item) => item.zone === "right"),
			compactIds,
			palette,
		);
		return [leftText, rightText].filter(Boolean).join(palette.paint("dim", ` ${FOOTER_ICONS.separator} `));
	};
	const measured = () => visibleWidth(renderRow()) + (surface === "header" ? 2 : 0);

	const droppable = active.filter((item) => !item.required).sort((a, b) => a.dropRank - b.dropRank);
	for (const item of droppable) {
		if (measured() <= width) break;
		const index = active.findIndex((candidate) => candidate.id === item.id);
		if (index >= 0) active.splice(index, 1);
	}
	// Required content that still overflows: compact it, then give up the header.
	for (const item of active.filter((candidate) => candidate.required)) {
		if (measured() <= width) break;
		if (item.full !== item.compact) compactIds.add(item.id);
	}
	if (surface === "header" && measured() > width) return "";

	const row = renderRow();
	if (surface === "telemetry" && active.length > 0 && active.every((item) => item.zone === "right")) {
		return `${" ".repeat(Math.max(0, width - visibleWidth(row)))}${row}`;
	}
	return truncateToWidth(row, width, "");
}

export interface FooterComponentOptions {
	getState(): FooterState;
	getConfig(): AtelierConfig;
	colorEnabled?: boolean;
	requestRender(): void;
	onBranchChange(callback: () => void): () => void;
	theme: ThemeLike;
}

export interface AtelierFooterComponent extends Component {
	/** Prompt-style header strip for the composer's top rule (ribbon mode). */
	renderHeader(width: number): string;
	/** Compact measured-telemetry row (ribbon mode); empty when nothing is measurable. */
	renderTelemetry(width: number): string[];
	dispose(): void;
}

export function createFooterComponent(options: FooterComponentOptions): AtelierFooterComponent {
	let disposed = false;
	let frameIndex = 0;
	let animationTimer: ReturnType<typeof setInterval> | undefined;
	const unsubscribe = options.onBranchChange(options.requestRender);

	const stopAnimation = (): void => {
		if (animationTimer) {
			clearInterval(animationTimer);
			animationTimer = undefined;
		}
		frameIndex = 0;
	};

	const syncAnimation = (visible: boolean): void => {
		if (disposed || !visible) {
			stopAnimation();
			return;
		}
		if (animationTimer) return;
		animationTimer = setInterval(() => {
			if (disposed) return;
			frameIndex = (frameIndex + 1) % WORKING_DOT_FRAMES.length;
			options.requestRender();
		}, WORKING_ANIMATION_INTERVAL_MS);
	};

	const renderSurface = (width: number, surface: FooterSurface): string => {
		const state = options.getState();
		const config = options.getConfig();
		const colorEnabled = options.colorEnabled ?? true;
		const workingDots = WORKING_DOT_FRAMES[frameIndex] ?? WORKING_DOT_FRAMES[0];
		const line = renderFooterRibbonLine(
			state,
			config,
			options.theme,
			width,
			colorEnabled,
			workingDots,
			surface,
		);
		const fullActivity = activityText(
			state,
			createPalette(options.theme, colorEnabled),
			options.theme,
			workingDots,
			false,
		);
		if (surface !== "telemetry") syncAnimation(state.activity === "working" && line.includes(fullActivity));
		return line;
	};
	return {
		render(width) {
			const state = options.getState();
			const config = options.getConfig();
			const colorEnabled = options.colorEnabled ?? true;
			const workingDots = WORKING_DOT_FRAMES[frameIndex] ?? WORKING_DOT_FRAMES[0];
			const line = renderFooterLine(state, config, options.theme, width, colorEnabled, workingDots);
			const fullActivity = activityText(
				state,
				createPalette(options.theme, colorEnabled),
				options.theme,
				workingDots,
				false,
			);
			syncAnimation(state.activity === "working" && line.includes(fullActivity));
			return [line];
		},
		renderHeader(width: number) {
			return renderSurface(width, "header");
		},
		renderTelemetry(width: number) {
			const line = renderSurface(Math.max(0, width - 4), "telemetry");
			return line ? [`  ${line}  `] : [];
		},
		invalidate() {},
		dispose() {
			if (disposed) return;
			disposed = true;
			stopAnimation();
			unsubscribe();
		},
	};
}
