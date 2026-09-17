## Context

See `proposal.md` for motivation. Runtime elapsed state is centralized in `src/run-activity.ts`: run starts, provider-request starts, first output, response completion, tool starts/ends, and settlement default to `Date.now()`, then `normalizeTimestamp` truncates samples to integer milliseconds. `src/sidebar.ts` separately obtains `Date.now()` while rendering active run and tool durations. These values are in-memory clock coordinates used only for ordering and subtraction; completed durations are stored separately.

The migration crosses tracker and renderer boundaries because changing only the tracker would mix monotonic start values with wall-clock render values. Existing tracker methods accept explicit timestamp overrides, and rendering helpers accept an explicit `now`, which already provide deterministic test seams.

## Goals / Non-Goals

**Goals:**

- Put all runtime elapsed samples used by run activity and sidebar live durations in the `performance.now()` clock domain.
- Preserve fractional-millisecond samples through calculations.
- Keep deterministic tests able to supply exact timestamps.
- Preserve existing formulas, state transitions, clamping, formatting, and response scope.

**Non-Goals:**

- Changing TPS reliability policy, stall detection, token estimation, or aggregation scope.
- Persisting run-activity timing or treating monotonic coordinates as calendar timestamps.
- Replacing wall-clock time where a real-world timestamp is required elsewhere in the product.
- Changing display precision or labels.

## Decisions

### Use a single elapsed-clock helper backed by `performance.now()`

Introduce a small elapsed-clock seam whose production implementation returns `performance.now()`. Use it for every default sample in the run-activity tracker and for the sidebar's live `now` sample.

This avoids duplicated clock choices and makes the clock-domain invariant visible. Directly replacing individual `Date.now()` calls was considered, but it makes a future mixed-domain regression easier and gives integration tests no single seam to control.

### Keep explicit timestamp overrides as clock coordinates

Retain the existing optional `now` arguments on tracker operations and the explicit sidebar render timestamp. They remain deterministic clock coordinates rather than Unix timestamps. Unit tests can continue to exercise transitions without depending on a global timer; integration tests can inject or mock the elapsed-clock helper.

Removing these overrides in favor of globally mocking `performance.now()` was considered, but it would reduce test isolation and make transition tests harder to read.

### Preserve fractional samples; clamp only invalid or negative intervals

Replace integer truncation for elapsed samples with normalization that preserves finite fractional values. Interval calculations continue to use `Math.max(0, end - start)` so malformed deterministic inputs cannot produce negative durations. Presentation remains responsible for integer/decimal formatting.

Retaining `Math.trunc` was rejected because it defeats the precision benefit of the new clock and can materially distort very short TPS denominators.

### Treat activity start values as opaque monotonic coordinates

`RunActivitySnapshot.startedAt` and `ToolActivity.startedAt` remain numeric for sorting and live subtraction, but they are not wall-clock timestamps and must not be serialized or formatted as dates. No persisted-state migration is needed because run activity is reset when its runtime session is replaced.

Adding parallel wall-clock timestamps was considered, but no current behavior needs them and doing so would expand the data model without serving the change.

### Update tests at the behavioral boundary

Add tracker tests for fractional TTFT/TPS and run/tool durations, plus an integration or sidebar test that changes wall-clock time while monotonic time advances. Existing display assertions remain unchanged to prove compatibility. Tests that currently rely on `vi.setSystemTime()` to drive elapsed metrics will instead control the elapsed-clock seam or explicit timestamp inputs.

## Risks / Trade-offs

- **[Risk] A remaining `Date.now()` consumer subtracts a monotonic start value** → Inventory every `startedAt` consumer and cover live sidebar rendering with a clock-domain regression test.
- **[Risk] Tests assume `vi.setSystemTime()` also advances elapsed time** → Use explicit samples or mock the elapsed-clock seam; avoid coupling to fake-timer implementation details.
- **[Risk] Fractional values change exact internal snapshots** → Assert observable durations and formulas where precision matters, while preserving existing formatted output assertions.
- **[Trade-off] Monotonic start values are not meaningful outside the process** → Keep them runtime-only and continue exposing completed `durationMs` for elapsed reporting.

## Migration Plan

1. Add the elapsed-clock helper and fractional-preserving sample normalization.
2. Switch run, response, tool, settlement, and sidebar live-render defaults to the helper.
3. Update deterministic tests and add wall-clock-jump and sub-millisecond regressions.
4. Run focused activity/sidebar/extension tests, then the full repository checks.

No persisted data migration or rollout flag is required. Rollback consists of reverting the clock helper usage and associated tests; public configuration and stored session data are unaffected.
