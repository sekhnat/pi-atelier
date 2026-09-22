import type { OverlayOptions, TUI } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { createImageCompositorBinding } from "../src/image-compositor.js";
import { stableTuiReference } from "./helpers/stable-tui-reference.js";

const ESC = "\u001b";
const BEL = "\u0007";
const RESET = "\u001b[0m\u001b]8;;\u0007";

/** One Kitty multipart transmission, byte-for-byte, spanning three rows. */
const KITTY_SEQUENCE = `${ESC}_Ga=T,f=100,q=2,i=7,r=3;${"A".repeat(20)}${ESC}\\${ESC}_Gm=0;${"B".repeat(20)}${ESC}\\`;

/** One iTerm2 inline image whose command row sits two rows below its top. */
const ITERM_SEQUENCE = `${ESC}[2A${ESC}]1337;File=inline=1;size=4;width=10;height=6:${btoa("test")}${BEL}`;

interface FakeOverlayEntry {
	options?: OverlayOptions;
	visible: boolean;
	line?: string;
	row?: number;
}

/**
 * Minimal stand-in for Pi's concrete renderers: `compositeOverlays` is a
 * prototype method, the overlay stack and visibility probe are instance
 * state, and instance properties shadow the prototype after adaptation.
 */
class FakeRenderer {
	overlayStack: FakeOverlayEntry[] = [];
	baseCalls: string[][] = [];

	compositeOverlays(lines: string[], width: number, _height: number): string[] {
		this.baseCalls.push([...lines]);
		const result = [...lines];
		for (const entry of this.overlayStack) {
			if (!entry.visible || entry.row === undefined || entry.line === undefined) continue;
			result[entry.row] = entry.line.padEnd(Math.max(0, width - entry.line.length)).slice(0, width);
		}
		return result;
	}

	isOverlayVisible(entry: FakeOverlayEntry): boolean {
		return entry.visible;
	}
}

const hooked = (renderer: FakeRenderer): unknown =>
	Object.getOwnPropertyDescriptor(renderer, "compositeOverlays")?.value;
const kittyAt = (column: number): string => `${"x".repeat(column)}${KITTY_SEQUENCE}`;

describe("image compositor", () => {
	it("reinserts untouched graphics commands at their original columns", () => {
		const renderer = new FakeRenderer();
		const binding = createImageCompositorBinding(stableTuiReference(() => renderer as unknown as TUI));

		const result = renderer.compositeOverlays(["before", kittyAt(2), "after"], 80, 10);

		// The untouched command bytes are redrawn after the text at the image's
		// original column (column 2 → cursor column 3), then returned past the
		// reserved cells.
		expect(result[1]).toContain(`${ESC}[3G${KITTY_SEQUENCE}`);
		expect(result[1]?.startsWith("xx")).toBe(true);
		expect(result[1]?.endsWith(`${ESC}[3G`)).toBe(true);
		binding.dispose();
	});

	it("hides multi-row Kitty images under a capturing modal and restores them after", () => {
		const renderer = new FakeRenderer();
		const binding = createImageCompositorBinding(stableTuiReference(() => renderer as unknown as TUI));
		const lines = ["top", kittyAt(0), "", "", "bottom"];

		renderer.overlayStack.push({ options: {}, visible: true, line: "MENU", row: 1 });
		const suppressed = renderer.compositeOverlays(lines, 80, 10);
		// The capturing modal hides the image: no graphics bytes on any row.
		expect(suppressed.join("")).not.toContain("_Ga=T");
		// Reserved rows stay in place for later restoration.
		expect(suppressed).toHaveLength(lines.length);

		// Closing the modal restores the image bytes on the next render.
		renderer.overlayStack.pop();
		const restored = renderer.compositeOverlays(lines, 80, 10);
		expect(restored[1]).toContain(KITTY_SEQUENCE);
		binding.dispose();
	});

	it("repairs fullscreen sidebar cells on image rows before text composition", () => {
		const renderer = new FakeRenderer();
		const sidebarLines = ["SIDEBAR ROW", "", ""];
		const binding = createImageCompositorBinding(
			stableTuiReference(() => renderer as unknown as TUI),
			() => ({ column: 60, width: 20, lines: sidebarLines }),
		);

		renderer.compositeOverlays([kittyAt(0), "text"], 80, 10);

		// The text handed to Pi's compositor carries the repaired sidebar cells.
		expect(renderer.baseCalls[0]?.[0]).toContain("SIDEBAR ROW");
		binding.dispose();
	});

	it("dirties every occupied iTerm2 row while a modal is visible", () => {
		const renderer = new FakeRenderer();
		const binding = createImageCompositorBinding(stableTuiReference(() => renderer as unknown as TUI));
		const lines = ["a", "b", "c", "d", "e", "f", "g"];
		lines[4] = `${"x".repeat(3)}${ITERM_SEQUENCE}`;

		renderer.overlayStack.push({ options: {}, visible: true, line: "MENU", row: 0 });
		const suppressed = renderer.compositeOverlays(lines, 80, 10);

		expect(suppressed.join("")).not.toContain("1337;File=");
		// Occupied rows 2..4 (top = 4 - 2, bottom = 4 + 1) are dirtied so Pi
		// erases the whole image, not just the command row.
		expect(suppressed[2]?.endsWith(RESET)).toBe(true);
		expect(suppressed[3]?.endsWith(RESET)).toBe(true);
		expect(suppressed[4]?.endsWith(RESET)).toBe(true);
		expect(suppressed[0]?.endsWith(RESET)).toBe(false);
		binding.dispose();
	});

	it("shares one adapter across multiple clients and restores after the last release", () => {
		const renderer = new FakeRenderer();
		const prototypeBase = FakeRenderer.prototype.compositeOverlays;
		const binding = createImageCompositorBinding(stableTuiReference(() => renderer as unknown as TUI));

		expect(hooked(renderer)).toBeDefined();

		const first = createImageCompositorBinding(stableTuiReference(() => renderer as unknown as TUI));
		first.dispose();
		// The second client still holds the adapter, so the hook remains.
		expect(renderer.compositeOverlays).not.toBe(prototypeBase);

		binding.dispose();
		expect(renderer.compositeOverlays).toBe(prototypeBase);
	});

	it("rebinds when Pi switches the renderer behind its stable reference", () => {
		const first = new FakeRenderer();
		const second = new FakeRenderer();
		let current: FakeRenderer = first;
		const prototypeBase = FakeRenderer.prototype.compositeOverlays;
		const binding = createImageCompositorBinding(stableTuiReference(() => current as unknown as TUI));

		expect(first.compositeOverlays).not.toBe(prototypeBase);
		// A rendered frame pins the adapter to the concrete renderer.
		first.compositeOverlays([kittyAt(0)], 80, 10);

		current = second;
		binding.sync();

		// The old renderer is restored and the new one is adapted.
		expect(first.compositeOverlays).toBe(prototypeBase);
		expect(hooked(second)).toBeDefined();
		expect(second.compositeOverlays).not.toBe(prototypeBase);

		binding.dispose();
		expect(second.compositeOverlays).toBe(prototypeBase);
	});

	it("degrades to a no-op binding when the renderer seam is absent", () => {
		const withoutCompose = { overlayStack: [], isOverlayVisible: () => false } as unknown as TUI;
		const composeBinding = createImageCompositorBinding(withoutCompose);
		composeBinding.sync();
		composeBinding.dispose();
		expect((withoutCompose as unknown as Record<string, unknown>).compositeOverlays).toBeUndefined();

		const withoutStack = { compositeOverlays: () => ["ok"] } as unknown as TUI;
		const stackBinding = createImageCompositorBinding(withoutStack);
		stackBinding.sync();
		stackBinding.dispose();
		expect(Object.getOwnPropertyDescriptor(withoutStack, "compositeOverlays")?.value).toBeDefined();
	});

	it("passes through frames without images and skips composition without clients", () => {
		const renderer = new FakeRenderer();
		const binding = createImageCompositorBinding(stableTuiReference(() => renderer as unknown as TUI));
		const plain = ["hello", "world"];

		expect(renderer.compositeOverlays(plain, 80, 10)).toEqual(plain);
		binding.dispose();

		// After the last release the base renderer runs again untouched.
		const prototypeBase = FakeRenderer.prototype.compositeOverlays;
		expect(renderer.compositeOverlays).toBe(prototypeBase);
		expect(renderer.compositeOverlays([kittyAt(0)], 80, 10)).toEqual([kittyAt(0)]);
	});
});
