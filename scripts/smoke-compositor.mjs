/**
 * 5.4 smoke probes against Pi's real regular/fullscreen renderers.
 * Run: node scripts/smoke-compositor.mjs
 */
import { TuiMainScreen, TuiAltScreen, ScrollView } from "@earendil-works/pi-tui";
import { createImageCompositorBinding } from "../src/image-compositor.ts";

const ESC = "\u001b";
const KITTY = `${ESC}_Ga=T,f=100,q=2,i=7,r=2;${"A".repeat(40)}${ESC}\\${ESC}_Gm=0;${"B".repeat(20)}${ESC}\\`;
const ITERM = `${ESC}]1337;File=inline=1;size=4;width=10;height=4:${Buffer.from("test").toString("base64")}\u0007`;

const write = (chunks) => chunks;
function makeTerminal(rows = 24, columns = 100) {
	return {
		rows,
		columns,
		writes: [],
		write(data) {
			this.writes.push(String(data));
		},
		start() {},
		stop() {},
		hideCursor() {},
		showCursor() {},
	};
}

// --- Regular mode: image line beside a plain frame ---
{
	const terminal = makeTerminal();
	const renderer = new TuiMainScreen(terminal);
	let sidebarRendered = false;
	const compositor = createImageCompositorBinding(renderer, (width) => ({
		column: width - 20,
		width: 20,
		lines: ["", "SIDEBAR", ""],
	}));
	const hook = renderer.compositeOverlays;
	const lines = [`text before`, `${"x".repeat(4)}${KITTY}`, "text after"];
	const composed = hook.call(renderer, lines, 100, 24);
	const row = composed[1] ?? "";
	const okBytes = row.includes(KITTY);
	const okColumn = row.includes(`${ESC}[5G${KITTY}`);
	const okSidebar = row.includes("SIDEBAR");
	console.log(
		`regular: multipart kitty bytes preserved=${okBytes} original column=${okColumn} sidebar cells repaired=${okSidebar}`,
	);
	compositor.dispose();
	console.log(`regular: compositor restored=${renderer.compositeOverlays !== hook}`);
}

// --- Fullscreen mode: capturing overlay suppression ---
{
	const terminal = makeTerminal();
	const renderer = new TuiAltScreen(terminal);
	renderer.setLayoutRoot(
		new ScrollView({ render: () => ["alpha", "beta"], invalidate() {} }, { primary: true }),
	);
	const compositor = createImageCompositorBinding(renderer);
	const hook = renderer.compositeOverlays;
	// Simulate a capturing overlay in the stack.
	renderer.overlayStack.push({
		options: { anchor: "top-left", width: 40, maxHeight: "100%", margin: 0 },
		component: { render: () => ["MENU"], invalidate() {} },
		visible: true,
	});
	const suppressed = hook.call(renderer, [KITTY, "", ""], 100, 24);
	console.log(
		`fullscreen: kitty image suppressed under capturing overlay=${!suppressed.join("").includes("a=T")}`,
	);
	console.log(
		`fullscreen: reserved rows kept in compositor text=${suppressed.length >= 3} (base compositing may pad to overlay height: ${suppressed.length})`,
	);
	renderer.overlayStack.pop();
	const restored = hook.call(renderer, [KITTY, "", ""], 100, 24);
	console.log(`fullscreen: image restored after overlay closes=${restored.join("").includes("a=T")}`);
	compositor.dispose();
}

// --- iTerm2 multi-row dirtying ---
{
	const terminal = makeTerminal();
	const renderer = new TuiMainScreen(terminal);
	const compositor = createImageCompositorBinding(renderer);
	const hook = renderer.compositeOverlays;
	renderer.overlayStack.push({
		options: { anchor: "top-left", width: 40, maxHeight: "100%", margin: 0 },
		component: { render: () => ["MENU"], invalidate() {} },
		visible: true,
	});
	const lines = ["a", "b", "c", "d", "e"];
	lines[3] = ITERM; // up=0 → single row span for this fixture
	const out = hook.call(renderer, lines, 100, 24);
	console.log(
		`fullscreen/iterm2: suppressed without deletion sequence=${!out.join("").includes("1337;File=")}`,
	);
	compositor.dispose();
}

// --- Selection clamp through the real alt-screen renderer ---
{
	const terminal = makeTerminal();
	const renderer = new TuiAltScreen(terminal);
	renderer.setLayoutRoot({ render: (w) => ["M".repeat(w)], invalidate() {} });
	const tui = renderer;
	// Adapter applied the same way split-pane does it.
	const proto = TuiAltScreen.prototype;
	const base = Object.getOwnPropertyDescriptor(proto, "getSelectionColumns")?.value;
	Object.defineProperty(renderer, "getSelectionColumns", {
		value: function (line, row, selection, min, max) {
			const columns = base.call(this, line, row, selection, min, max);
			const sidebar = 44;
			const main = this.terminal.columns - sidebar;
			return { start: Math.min(columns.start, main), end: Math.min(columns.end, main) };
		},
	});
	renderer.start();
	renderer.previousScreen = ["M".repeat(100)];
	const clamped = renderer.getSelectionColumns("M".repeat(100), 0, {
		start: { row: 0, col: 0 },
		end: { row: 0, col: 99 },
	});
	console.log(
		`fullscreen: screen-selection columns clamped to main pane=${clamped.end <= 56} (end=${clamped.end})`,
	);
	const shim = Object.getOwnPropertyDescriptor(renderer, "getSelectionColumns");
	if (shim?.configurable)
		Object.defineProperty(renderer, "getSelectionColumns", { value: undefined, configurable: true });
	renderer.stop();
}

// --- Editor top-rule handshake ---
{
	const { AtelierEditor } = await import("../src/editor.ts");
	const terminal = makeTerminal(6, 80); // fewer than 12 rows
	const editor = new AtelierEditor(
		{ requestRender() {}, terminal },
		{ borderColor: (t) => t, selectList: {} },
		{ matches: () => false },
	);
	editor.renderStatusLine = (width) => (terminal.rows >= 12 ? "● READY" : "");
	editor.render(80);
	console.log(`editor: short terminal refuses the status strip=${editor.statusLineVisible === false}`);

	const tall = makeTerminal(24, 80);
	const tallEditor = new AtelierEditor(
		{ requestRender() {}, terminal: tall },
		{ borderColor: (t) => t, selectList: {} },
		{ matches: () => false },
	);
	tallEditor.renderStatusLine = () => "● READY";
	const framed = tallEditor.render(80);
	console.log(
		`editor: tall terminal insets the status in the top rule=${tallEditor.statusLineVisible && String(framed[0]).includes("● READY")}`,
	);
}
console.log("smoke probes complete");
