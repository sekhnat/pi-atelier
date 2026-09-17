import { describe, expect, it } from "vitest";
import { ANSI_ESCAPE_PATTERN, sanitizeTerminalText } from "../src/sanitize.js";

describe("sanitizeTerminalText", () => {
	it("strips CSI sequences", () => {
		expect(sanitizeTerminalText("\u001b[31mred\u001b[0m")).toBe("red");
		expect(sanitizeTerminalText("a\u001b[38;2;12;34;56mb")).toBe("ab");
	});

	it("strips OSC sequences with both terminators", () => {
		expect(sanitizeTerminalText("a\u001b]8;;http://x\u0007b")).toBe("ab");
		expect(sanitizeTerminalText("a\u001b]0;title\u001b\\b")).toBe("ab");
	});

	it("strips two-character ESC sequences", () => {
		expect(sanitizeTerminalText("a\u001bXb")).toBe("ab");
		expect(sanitizeTerminalText("a\u001b\\b")).toBe("ab");
	});

	it("strips 8-bit CSI sequences", () => {
		expect(sanitizeTerminalText("a\u009b31mb")).toBe("ab");
	});

	it("replaces C1 controls with a space", () => {
		expect(sanitizeTerminalText("a\u0085b")).toBe("a b");
		expect(sanitizeTerminalText("a\u0098b")).toBe("a b");
	});

	it("replaces NUL and C0 controls with a space", () => {
		expect(sanitizeTerminalText("a\u0000b")).toBe("a b");
		expect(sanitizeTerminalText("a\u0007b")).toBe("a b");
		expect(sanitizeTerminalText("a\u007fb")).toBe("a b");
	});

	it("collapses whitespace runs and trims", () => {
		expect(sanitizeTerminalText("  a \t b  ")).toBe("a b");
		expect(sanitizeTerminalText("a\n\nb")).toBe("a b");
	});

	it("handles the empty string", () => {
		expect(sanitizeTerminalText("")).toBe("");
	});

	it("leaves plain and multibyte text unchanged", () => {
		expect(sanitizeTerminalText("plain ascii")).toBe("plain ascii");
		expect(sanitizeTerminalText("日本語テキスト")).toBe("日本語テキスト");
		expect(sanitizeTerminalText("emoji 🦊 tail")).toBe("emoji 🦊 tail");
	});

	it("exposes the escape pattern for reuse", () => {
		expect("x\u001b[0my".replace(ANSI_ESCAPE_PATTERN, "")).toBe("xy");
	});
});
