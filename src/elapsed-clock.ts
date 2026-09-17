/**
 * Monotonic clock seam for runtime elapsed-time measurements.
 *
 * Samples are process-relative clock coordinates in milliseconds — never Unix
 * timestamps — so elapsed intervals are immune to wall-clock adjustments and
 * retain the sub-millisecond precision of `performance.now()`.
 */
export type ElapsedClock = () => number;

const productionClock: ElapsedClock = () => performance.now();

let activeClock: ElapsedClock = productionClock;

/** Current monotonic elapsed-clock sample in milliseconds. */
export function elapsedNow(): number {
	return activeClock();
}

/**
 * Install a deterministic elapsed clock (tests); returns a function that
 * restores the previously installed clock.
 */
export function installElapsedClock(clock: ElapsedClock): () => void {
	const previous = activeClock;
	activeClock = clock;
	return () => {
		activeClock = previous;
	};
}

/** Test-only: restore the production `performance.now()` clock immediately. */
export function resetElapsedClock(): void {
	activeClock = productionClock;
}
