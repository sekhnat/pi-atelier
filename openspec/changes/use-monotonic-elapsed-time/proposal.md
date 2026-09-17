## Why

Pi Atelier currently derives response, run, and tool elapsed times from `Date.now()`, so wall-clock adjustments can distort durations and integer-millisecond normalization discards the sub-millisecond precision needed for short response windows. Runtime elapsed measurements should use a monotonic high-resolution clock while calendar timestamps remain wall-clock based.

## What Changes

- Measure response TTFT and TPS windows with `performance.now()` by default.
- Measure agent-run and tool elapsed durations with the same monotonic clock domain.
- Render live run and tool durations using a monotonic current time compatible with stored activity start values.
- Preserve existing metric formulas, lifecycle/reset behavior, display formatting, and explicit timestamp injection used by deterministic tests.
- Add regression coverage proving wall-clock changes do not affect elapsed metrics and fractional-millisecond readings are retained until display formatting.

## Capabilities

### New Capabilities

- `elapsed-time-metrics`: Defines the clock semantics and consistency requirements for runtime response, run, and tool elapsed-time measurements.

### Modified Capabilities

None.

## Impact

- Affected runtime code: `src/run-activity.ts` and the sidebar's live-duration clock path in `src/sidebar.ts`; a small shared or injected monotonic-clock abstraction may be introduced.
- Affected tests: tracker, sidebar, and extension integration tests that currently drive elapsed time through wall-clock fake timers.
- Public formatting and configuration remain compatible; no new runtime dependency is required because `performance.now()` is available in the supported Node.js versions.
