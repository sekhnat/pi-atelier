import type { TUI } from "@earendil-works/pi-tui";
import { ScrollView, TuiAltScreen } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import { createSidebarController } from "../src/sidebar.js";
import { createSplitPaneController, DEFAULT_SIDEBAR_WIDTH } from "../src/split-pane.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const press = (x: number, y: number) => `\u001b[<0;${x};${y}M`;
const motion = (x: number, y: number) => `\u001b[<32;${x};${y}M`;
const release = (x: number, y: number) => `\u001b[<0;${x};${y}m`;

function stableTuiReference(getRenderer: () => TUI): TUI {
	return new Proxy({} as TUI, {
		get: (_target, property) => {
			const renderer = getRenderer();
			const value = Reflect.get(renderer, property, renderer);
			if (typeof value !== "function") return value;
			return (...args: unknown[]) => {
				const currentRenderer = getRenderer();
				const method = Reflect.get(currentRenderer, property, currentRenderer);
				if (typeof method !== "function") throw new TypeError(`${String(property)} is not callable`);
				return Reflect.apply(method, currentRenderer, args);
			};
		},
		set: (_target, property, value) => {
			const renderer = getRenderer();
			return Reflect.set(renderer, property, value, renderer);
		},
		getPrototypeOf: () => Reflect.getPrototypeOf(getRenderer()),
	}) as TUI;
}

describe("fullscreen Sidebar selection", () => {
	it("removes the split child immediately when ctx.ui.custom closes its lifecycle overlay", async () => {
		const terminal = {
			columns: 120,
			rows: 8,
			write: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			hideCursor: vi.fn(),
			showCursor: vi.fn(),
		};
		const renderer = new TuiAltScreen(terminal as never);
		const tui = stableTuiReference(() => renderer);
		const mainWidths: number[] = [];
		renderer.setLayoutRoot({
			render: (width) => {
				mainWidths.push(width);
				return [`main:${width}`];
			},
			invalidate() {},
		});
		let closeCustom: (() => void) | undefined;
		const custom = vi.fn(
			(factory, options) =>
				new Promise<void>((resolve) => {
					const done = () => {
						tui.hideOverlay();
						resolve();
					};
					closeCustom = done;
					const component = factory(
						tui,
						{
							name: "dark",
							fg: (_color: string, text: string) => text,
							bold: (text: string) => text,
							italic: (text: string) => text,
						},
						{},
						done,
					);
					const overlayOptions =
						typeof options.overlayOptions === "function" ? options.overlayOptions() : options.overlayOptions;
					const handle = tui.showOverlay(component, overlayOptions);
					options.onHandle?.(handle);
				}),
		);
		const controller = createSidebarController({
			ctx: { mode: "tui", ui: { custom } } as never,
			getSnapshot: () => {
				throw new Error("render lifecycle marker");
			},
			getConfig: () => DEFAULT_CONFIG,
		});

		controller.show();
		tui.render(120);
		expect(mainWidths.at(-1)).toBe(76);

		closeCustom?.();
		tui.render(120);
		expect(mainWidths.at(-1)).toBe(120);
		await Promise.resolve();
		await Promise.resolve();
		expect(controller.isVisible()).toBe(false);

		controller.dispose();
	});

	it("copies transcript content without Sidebar text through Pi's stable TUI reference", () => {
		let deliverInput: ((data: string) => void) | undefined;
		const write = vi.fn();
		const terminal = {
			columns: 120,
			rows: 8,
			write,
			start: vi.fn((onInput: (data: string) => void) => {
				deliverInput = onInput;
			}),
			stop: vi.fn(),
			hideCursor: vi.fn(),
			showCursor: vi.fn(),
		};
		const renderer = new TuiAltScreen(terminal as never);
		const tui = stableTuiReference(() => renderer);
		const transcript = new ScrollView(
			{
				render: () => ["alpha", "beta", "gamma"],
				invalidate() {},
			},
			{ primary: true },
		);
		renderer.setLayoutRoot(transcript);
		renderer.start();

		const split = createSplitPaneController();
		split.attach(tui);
		split.show();
		const overlayHandle = tui.showOverlay(
			{
				render: () => ["SIDEBAR", "TOKEN BURDEN"],
				invalidate() {},
			},
			split.overlayOptions(),
		);
		renderer.renderNow();

		// The Sidebar is visibly part of the HStack, but its lifecycle overlay is
		// non-visible so Pi can bind text selection to the transcript ScrollView.
		expect(tui.render(120).join("\n")).toContain("SIDEBAR");
		expect(tui.hasOverlay()).toBe(false);

		deliverInput?.(press(1, 1));
		deliverInput?.(motion(4, 2));
		deliverInput?.(release(4, 2));

		const copyWrite = write.mock.calls
			.map(([value]) => String(value))
			.findLast((value) => value.includes("\u001b]52;c;"));
		expect(copyWrite).toBeDefined();
		// biome-ignore lint/suspicious/noControlCharactersInRegex: regex intentionally matches terminal control/ANSI bytes to strip them
		const encoded = copyWrite?.match(/\u001b\]52;c;([A-Za-z0-9+/=]+)\u0007/)?.[1];
		expect(encoded).toBeDefined();
		const copied = Buffer.from(encoded ?? "", "base64").toString("utf8");
		expect(copied).toBe("alpha\nbeta");
		expect(copied).not.toContain("SIDEBAR");
		expect(copied).not.toContain("TOKEN BURDEN");

		overlayHandle.setHidden(true);
		expect(overlayHandle.isHidden()).toBe(true);
		expect(tui.render(120).join("\n")).not.toContain("SIDEBAR");
		overlayHandle.setHidden(false);
		expect(tui.render(120).join("\n")).toContain("SIDEBAR");

		tui.hideOverlay();
		expect(tui.render(120).join("\n")).not.toContain("SIDEBAR");

		overlayHandle.hide();
		expect(tui.render(120).join("\n")).not.toContain("SIDEBAR");
		expect(tui.render(120).join("\n")).not.toContain("TOKEN BURDEN");
		split.dispose();
		renderer.stop();
	});
});

describe("fullscreen screen-selection clamping", () => {
	interface SelectionHarness {
		renderer: TuiAltScreen;
		tui: TUI;
		deliverInput: (data: string) => void;
		write: ReturnType<typeof vi.fn>;
		split: ReturnType<typeof createSplitPaneController>;
	}

	/** Fullscreen frame with an editor-like main pane (no ScrollView) and a visible Sidebar. */
	const selectionHarness = (): SelectionHarness => {
		let deliverInput: ((data: string) => void) | undefined;
		const write = vi.fn();
		const terminal = {
			columns: 120,
			rows: 8,
			write,
			start: vi.fn((onInput: (data: string) => void) => {
				deliverInput = onInput;
			}),
			stop: vi.fn(),
			hideCursor: vi.fn(),
			showCursor: vi.fn(),
		};
		const renderer = new TuiAltScreen(terminal as never);
		const tui = stableTuiReference(() => renderer);
		// An editor-like main pane: no ScrollView, so Pi falls back to screen selection.
		renderer.setLayoutRoot({
			render: (width: number) => Array.from({ length: 8 }, () => "M".repeat(width)),
			invalidate() {},
		});
		renderer.start();
		const split = createSplitPaneController();
		split.attach(tui);
		split.show();
		tui.showOverlay(
			{
				render: (width: number) => Array.from({ length: 8 }, () => "S".repeat(width)),
				invalidate() {},
			},
			split.overlayOptions(),
		);
		renderer.renderNow();
		return {
			renderer,
			tui,
			deliverInput: (data: string) => deliverInput?.(data),
			write,
			split,
		};
	};

	const copiedText = (write: ReturnType<typeof vi.fn>): string | undefined => {
		const copyWrite = write.mock.calls
			.map(([value]) => String(value))
			.findLast((value) => value.includes("\u001b]52;c;"));
		// biome-ignore lint/suspicious/noControlCharactersInRegex: regex intentionally matches terminal control/ANSI bytes to strip them
		const encoded = copyWrite?.match(/\u001b\]52;c;([A-Za-z0-9+/=]+)\u0007/)?.[1];
		return encoded === undefined ? undefined : Buffer.from(encoded, "base64").toString("utf8");
	};

	it("clamps a drag that starts in the editor to the main pane", () => {
		const { renderer, deliverInput, write, split } = selectionHarness();

		deliverInput(press(1, 1));
		deliverInput(motion(100, 1));
		deliverInput(release(100, 1));

		// Main pane is 120 - 44 columns; the copy excludes all Sidebar columns.
		expect(copiedText(write)).toBe("M".repeat(120 - DEFAULT_SIDEBAR_WIDTH));
		split.dispose();
		renderer.stop();
	});

	it("copies nothing from a drag that starts in the Sidebar", () => {
		const { renderer, deliverInput, write, split } = selectionHarness();

		deliverInput(press(100, 1));
		deliverInput(motion(119, 1));
		deliverInput(release(119, 1));

		// The clamped range is empty, so no Sidebar text reaches the clipboard.
		expect(copiedText(write)).toBeUndefined();
		split.dispose();
		renderer.stop();
	});

	it("keeps screen selection native while a capturing overlay is visible", () => {
		const { renderer, tui, deliverInput, write, split } = selectionHarness();
		tui.showOverlay(
			{
				render: (width: number) => Array.from({ length: 8 }, () => "O".repeat(width)),
				invalidate() {},
			},
			{ anchor: "top-left", width: 120, maxHeight: "100%", margin: 0 },
		);
		renderer.renderNow();

		deliverInput(press(1, 1));
		deliverInput(motion(120, 1));
		deliverInput(release(120, 1));

		// The overlay is not clamped to the main-pane boundary.
		expect(copiedText(write)).toBe("O".repeat(120));
		split.dispose();
		renderer.stop();
	});
});
