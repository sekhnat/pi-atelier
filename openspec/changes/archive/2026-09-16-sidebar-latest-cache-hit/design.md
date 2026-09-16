## Context

`aggregateMetrics` (src/metrics.ts) already produces both rates on `AtelierMetrics`: `cacheHitPercent` (session aggregate) and `latestCacheHitPercent` (latest request, stable fallback). The Status Rail renders both; the Sidebar's `usageRows()` (src/sidebar.ts) renders only the aggregate as `Hit <pct>%`, paired inline with `Cache <tokens>` via `metricPairRows`, with `—` + dim paint as the unavailable marker. A solo row idiom already exists in the panel (`Cost` is rendered alone via `metricValue`). See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**
- Show both cache-hit rates in the USAGE panel as distinct, labeled values.
- Preserve every existing row of the panel and the aggregate `Hit` semantics pinned by the spec.
- Keep unavailable-value handling identical to the aggregate value's.

**Non-Goals:**
- No changes to aggregation or fallback semantics in `metrics.ts`.
- No changes to the footer, configuration surface, or the sidebar panel contribution protocol.
- No relabeling or reordering of the existing `In/Out` and `Cache/Hit` rows.

## Decisions

1. **Append a dedicated `Last` row after the `Cache/Hit` row, before `Cost`.** The row renders `Last <latest%>` via the existing `metricValue` idiom (the same pattern as the solo `Cost` row).
   - *Why not extend the Cache row to three segments?* `metricPairRows` handles exactly two values with a collapse-or-stack rule; generalizing it to N segments changes the spec-pinned Cache row and adds width-handling churn for no behavioral gain.
   - *Why not pair `Hit` and `Last` on their own row?* It would move the aggregate off the Cache row, altering two existing rows instead of adding one.
2. **Label the latest value `Last`.** Sidebar labels are capitalized single words (`In`, `Out`, `Cache`, `Hit`, `Cost`); `Last` is short, reads as "most recent request", and leaves `Hit` meaning the aggregate. Alternative `Latest` is longer with no added clarity; reusing `Hit` for both values would blur the distinction the change exists to make.
3. **Mirror the aggregate's formatting exactly**: ``${value.toFixed(1)}%``, `—` when `latestCacheHitPercent` is omitted or non-finite, dim paint for the placeholder, `cache` palette role for the numeric value. One shared helper renders either rate so the two cannot drift.
4. **Keep the `Last` label in compact layout.** A bare second percent (the compact treatment for the paired `Hit`) would be indistinguishable from the adjacent aggregate; the label is what makes the change legible. `Cost` already keeps its label in compact mode, so this is consistent.

## Risks / Trade-offs

- [One more row in a space-constrained Sidebar] → The value is a short labeled percent (≤ ~10 visible chars); the USAGE panel's existing `dropRank: 20` behavior and row stacking are otherwise untouched.
- [The two rates often look identical after several turns] → Accepted: the rates legitimately converge in long cache-friendly sessions; labels keep them readable, and hiding either value would reintroduce the original problem.
- [Test fixture drift] → The existing sidebar test fixture already carries `cacheHitPercent: 96` and `latestCacheHitPercent: 88`; assertions target rendered rows, not layout internals.

## Migration Plan

None required — a display-only addition with no persisted state, configuration, or protocol surface. Rollback is a plain revert.

## Open Questions

None.
