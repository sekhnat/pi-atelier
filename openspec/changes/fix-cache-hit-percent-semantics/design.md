## Context

`aggregateMetrics` (`src/metrics.ts`) walks every assistant message with valid usage, accumulating input/output/cache-read/cache-write/cost sums; `AtelierRuntime.refreshUsage()` re-runs it over the full session message list on every refresh (`src/state.ts`). Both the footer metrics segment (`src/footer.ts` — `cache` headline and `hit` detail) and the sidebar usage panel (`src/sidebar.ts` `usageRows` — `Hit`) render `cacheHitPercent`, which today is assigned inside the loop (`src/metrics.ts:53`), so the last usage-bearing message wins and an empty-prompt tail message blanks it. The settings overlay preview builds a footer from a sample metrics object (`src/settings-workspace.ts`). The project compiles with `exactOptionalPropertyTypes`, so optional metrics fields are omitted via spread rather than assigned `undefined` (`src/metrics.ts:64`). See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Two distinct, deliberately-labeled cache-hit rates: a session aggregate and a latest-request rate.
- Latest-request rate stable across refreshes: an empty-prompt tail message never blanks it.
- Both rates visible in footer slots that already exist, with no layout change.

**Non-Goals:**

- No new runtime state: `refreshUsage()` already re-aggregates the full session, so nothing is persisted across refreshes.
- No changes to token/cost totals, availability flags, or footer/sidebar segment layout.
- Not addressing IMPROVEMENTS.md item 21 (`refreshUsage` memoization) — orthogonal hot-path work.

## Decisions

**D1 — Keep `cacheHitPercent` as the session aggregate; add `latestCacheHitPercent`.** The existing name is already rendered as a session-level rate; correcting its semantics in place avoids relabeling every consumer. The latest-request value gets a new, explicitly-named optional field on `AtelierMetrics`. Alternative: rename the existing field and introduce a new aggregate name — rejected as pure churn (same number of edit sites, breaking every fixture, for no behavioral gain).

**D2 — Compute the aggregate once, after the loop, from the sums.** `promptTotal = input + cacheRead + cacheWrite`; `cacheHitPercent = promptTotal > 0 ? (cacheRead / promptTotal) * 100 : omitted`. No per-message assignment remains, so no single message can overwrite or blank the session rate.

**D3 — Latest-rate fallback is last-valid-assignment inside the aggregation pass, not persisted state.** Track the per-message rate only when that message's prompt is non-zero and keep the last such value; skip empty-prompt messages rather than overwriting with `undefined`. Because `refreshUsage()` re-aggregates the entire session message list on every refresh, "most recent message with a non-empty prompt" is observably identical to "last known good value across refreshes" — without adding mutable state to `AtelierRuntime` or special-casing session swap/teardown. Alternative: persist a last-known-value on the runtime and refresh it — rejected: extra state with identical observable output.

**D4 — Footer slots split: `cache` headline → session aggregate (0 decimals), `hit` detail → latest (1 decimal).** Today both footer slots render the same field twice (`src/footer.ts:239,245` — the fixture's 98.8 renders as both `cache 99%` and `hit 98.8%`), so the UI already has two percent slots duplicating one value; mapping each slot to a distinct rate gives both metrics a home with zero layout change. The sidebar usage panel's `Hit` keeps the session aggregate because that panel is cumulative session accounting (In/Out/Cache/Cost). Alternative: also surface latest in the sidebar — deferred; the panel reads well and has no natural extra row.

**D5 — Omit-when-undefined preserved.** Both rates stay optional and are omitted from the metrics object exactly as today (the `exactOptionalPropertyTypes` spread pattern), so existing "—" unavailable rendering keeps working; `percentValue` already guards non-finite values (footer tests include a `NaN` fixture).

## Risks / Trade-offs

- [Footer tests assert `cache 99%`/`hit 98.8%` from one field] → After the split, fixtures must carry **distinct** values (e.g. aggregate 98.8, latest 91.2) and assert both, or the tests would keep passing for the wrong reason.
- [Settings preview footer goes dark on `hit`] → Add `latestCacheHitPercent` to the sample metrics object so the previewed footer renders both rates.
- [Sessions where every prompt is empty legitimately omit both rates] → Displays show "—", identical to today's zero-usage path; sidebar already covers the "—" case in tests — no migration needed.
- [Aggregate lags recent requests] → A session that starts cold keeps a lower aggregate even after recent requests hit cache well; the footer's `hit` slot is the deliberate answer for "how is the current request doing" — noted in the CHANGELOG entry.

## Migration Plan

Single backwards-compatible PR: one additive optional type field, no config, protocol, or dependency changes. Rollback = revert the PR. No deployment ordering concerns (single-user TUI extension).
