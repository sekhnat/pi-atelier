## 1. Metrics core

- [x] 1.1 Add `latestCacheHitPercent?: number` to `AtelierMetrics` in `src/types.ts` (after `cacheHitPercent`), and verify `npx tsc --noEmit` passes
- [x] 1.2 Rework `aggregateMetrics` in `src/metrics.ts` per design D2/D3: drop the in-loop `cacheHitPercent` assignment, compute the session aggregate after the loop as `cacheRead / (input + cacheRead + cacheWrite) × 100` from the accumulated sums (omitted when the prompt total is 0), and track the latest-request rate by assigning only on messages with a non-empty prompt so an empty-prompt tail holds the last valid value; update `tests/metrics.test.ts` to re-baseline the multi-message case (`cacheHitPercent` ≈ 88.14 = 26_000/29_500, `latestCacheHitPercent` = 90), keep the zero-usage case asserting both fields stay undefined, and add an empty-prompt-tail case asserting no flicker; verify with `npx vitest run tests/metrics.test.ts`

## 2. Display wiring

- [x] 2.1 Split the footer cache slots in `src/footer.ts`: the `cache` headline keeps `metrics.cacheHitPercent` (0 decimals) and the `hit` detail switches to `metrics.latestCacheHitPercent` (1 decimal); update `tests/footer.test.ts` fixtures with distinct values (aggregate 98.8 → `cache 99%`, latest 91.2 → `hit 91.2%`), extend the destructure/NaN cases to cover `latestCacheHitPercent`, and assert both slots; verify with `npx vitest run tests/footer.test.ts`
- [x] 2.2 Add a distinct `latestCacheHitPercent` (e.g. 88) to the usage fixture in `tests/sidebar.test.ts` and keep asserting `Cache 100.0k  Hit 96.0%` to pin the sidebar `Hit` row to the session aggregate; verify with `npx vitest run tests/sidebar.test.ts`
- [x] 2.3 Add `latestCacheHitPercent` to the settings preview sample metrics in `src/settings-workspace.ts` (e.g. 74.1) so the previewed footer's `hit` slot renders a value instead of `—`; update `tests/settings-workspace.test.ts` preview assertions if they assert footer content; verify with `npx vitest run tests/settings-workspace.test.ts`

## 3. Docs and gate

- [x] 3.1 Add a `CHANGELOG.md` entry under Unreleased: `cacheHitPercent` is now the session aggregate, new `latestCacheHitPercent` reports the latest request with a stable fallback, and the footer `cache`/`hit` slots now show aggregate/latest respectively; verify the entry matches the shipped behavior
- [x] 3.2 Run the full gate: verify `npx tsc --noEmit` and `npx vitest run` pass, and `npx biome format` reports no new findings in the files touched by this change (the pre-existing `.pi/fabric/*.json` format failures are tracked separately as IMPROVEMENTS.md item 1 and are out of scope)
