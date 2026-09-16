## Why

`cacheHitPercent` claims to be a session metric but is recomputed inside the per-message aggregation loop (`src/metrics.ts:53`): every usage-bearing message overwrites the previous value, so the last one wins. What the footer (`cache NN%`) and the sidebar usage panel (`Hit NN.N%`) actually display is the latest request's cache-hit rate, and whenever the newest usage-bearing message has an empty prompt the value drops to `undefined`, making both displays flicker to `—` even though earlier messages carried a perfectly good rate. IMPROVEMENTS.md item 4 tracks this as a correctness bug: a latest-request value masquerading as a session metric.

## What Changes

- `cacheHitPercent` becomes a deliberate **session aggregate** — `session cacheRead / (session input + session cacheRead + session cacheWrite) × 100`, computed once from the accumulated sums after the aggregation loop. It no longer depends on which message happens to be latest, and no single message can blank it.
- `AtelierMetrics` gains an optional `latestCacheHitPercent` — the cache-hit of the most recent request, with a **stable fallback**: when the latest usage-bearing message has an empty prompt, it holds the most recent earlier message's rate instead of dropping to `undefined`. It is omitted only when no message in the session produced a computable rate.
- Display mapping makes both metrics visible in slots that already exist: the footer's `cache` headline shows the session aggregate (0 decimals) while the footer's `hit` detail shows the latest request rate (1 decimal) — today both slots render the same number twice; the sidebar usage panel's `Hit` stays on the session aggregate, matching its cumulative In/Out/Cache accounting.
- Tests are re-baselined: metrics unit tests cover the aggregate value, the latest/fallback semantics, and the empty-prompt flicker case; footer/sidebar/settings fixtures gain the new field with distinct values so the split is observable.

## Capabilities

### New Capabilities

- `usage-metrics`: Session usage aggregation contract — cumulative token/cost totals over assistant messages, plus the two cache-hit rates (session aggregate and latest-request with stable fallback) that the footer and sidebar render.

### Modified Capabilities

(none — `openspec/specs/` has no established capabilities yet; this change introduces `usage-metrics`)

## Impact

- Code: `src/metrics.ts` (post-loop percentage computation, latest-tracking with fallback), `src/types.ts` (`AtelierMetrics.latestCacheHitPercent?: number`), `src/footer.ts` (`hit` detail reads `latestCacheHitPercent`), `src/settings-workspace.ts` (preview sample metrics gain the new field).
- Tests: `tests/metrics.test.ts` (aggregate re-baseline + latest/fallback/flicker cases), `tests/footer.test.ts` (cache/hit split with distinct fixture values), `tests/sidebar.test.ts` (fixture gains a distinct latest value; `Hit` display stays aggregate), `tests/settings-workspace.test.ts` (preview assertions).
- Docs: `CHANGELOG.md` entry under Unreleased.
- Compatibility: additive — `AtelierMetrics` gains one optional field; no config, protocol, dependency, or peer-range changes. No breaking changes.
