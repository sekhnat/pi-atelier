import { describe, expect, it } from "vitest";
import { elapsedNow, installElapsedClock } from "../src/elapsed-clock.js";

describe("elapsed clock", () => {
	it("defaults to performance.now() and never moves backward", () => {
		const first = elapsedNow();
		const second = elapsedNow();
		expect(Number.isFinite(first)).toBe(true);
		expect(first).toBeGreaterThanOrEqual(0);
		expect(second).toBeGreaterThanOrEqual(first);
	});

	it("supplies deterministic fractional-millisecond samples without wall-clock time", () => {
		const samples = [1_000.25, 1_820.5, 2_800.75];
		let index = 0;
		const restore = installElapsedClock(() => {
			const sample = samples.at(index) ?? samples.at(-1) ?? 0;
			index += 1;
			return sample;
		});
		try {
			expect(elapsedNow()).toBe(1_000.25);
			expect(elapsedNow()).toBe(1_820.5);
			expect(elapsedNow()).toBe(2_800.75);
		} finally {
			restore();
		}
		expect(Number.isFinite(elapsedNow())).toBe(true);
	});

	it("restores the previously installed clock when unwinding", () => {
		const restoreOuter = installElapsedClock(() => 10.5);
		const restoreInner = installElapsedClock(() => 20.25);
		try {
			expect(elapsedNow()).toBe(20.25);
		} finally {
			restoreInner();
		}
		try {
			expect(elapsedNow()).toBe(10.5);
		} finally {
			restoreOuter();
		}
		expect(Number.isFinite(elapsedNow())).toBe(true);
	});
});
