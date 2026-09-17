/**
 * The single sanitization policy for text bound for terminal display and OS
 * notifications. Every surface that renders or forwards user-visible text
 * funnels through this module, so an escape-handling fix lands in exactly one
 * place. Truncation policies stay at their call sites.
 */

// biome-ignore-all lint/suspicious/noControlCharactersInRegex: the regexes below intentionally match terminal control/ANSI bytes in order to strip them

/**
 * Strictest union of every sanitizer policy this module replaces:
 * - OSC sequences, both BEL- and ST-terminated;
 * - CSI sequences;
 * - two-character ESC sequences (the run-activity generation);
 * - 8-bit CSI (0x9b) sequences (the sidebar-panel generation).
 * Ordered so OSC and CSI consume `ESC ]` and `ESC [` before the generic
 * two-character alternative can.
 */
export const ANSI_ESCAPE_PATTERN =
	/(?:\u001b\][^\u0007]*(?:\u0007|\u001b\\)|\u001b\[[0-?]*[ -/]*[@-~]|\u001b[@-Z\\-_]|\u009b[0-?]*[ -/]*[@-~])/g;

/**
 * Strips ANSI escape sequences, replaces C0 control characters, DEL, and C1
 * controls with a space, collapses whitespace runs, and trims.
 */
export function sanitizeTerminalText(text: string): string {
	return text
		.replace(ANSI_ESCAPE_PATTERN, "")
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
