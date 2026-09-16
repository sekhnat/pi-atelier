## Why

The Status Rail (footer) already shows both cache-hit rates — the session aggregate in its cache headline and the latest request in its hit detail — but the Sidebar Usage panel shows only the aggregate. A user glancing at the Sidebar cannot see how the most recent request performed (for example, a cache re-write after a context change), so the two surfaces disagree about what is visible and the Sidebar hides information the extension already computes.

## What Changes

- Add the latest-request cache-hit percentage to the Sidebar's USAGE panel as a distinct, labeled value next to the existing session-aggregate hit value.
- Keep the aggregate value's semantics unchanged: the panel's existing `Hit` value continues to display the session cache-hit percentage.
- Render the latest value with the same formatting and unavailability handling as the aggregate (one decimal percent, unavailable marker when the underlying value is omitted or non-finite).
- Label the latest value `Last` so the two rates are distinguishable at a glance (assumption recorded below).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `usage-metrics`: the "Cache-hit display mapping" requirement currently pins the Sidebar usage panel's hit value to the session cache-hit percentage; it is modified to additionally require the panel to display the latest-request cache-hit percentage as a distinct labeled value with its own unavailable marker.

## Impact

- `src/sidebar.ts` — `usageRows()` gains one rendered value; no data plumbing changes (`latestCacheHitPercent` is already present on `AtelierMetrics`).
- `tests/sidebar.test.ts` — assertions for the new value, its label, and its unavailability marker.
- No changes to aggregation semantics (`src/metrics.ts`), configuration, the sidebar panel protocol, or the footer.
- Note: the CHANGELOG "Unreleased" entry for the cache-hit semantics split records that the Sidebar usage panel "keeps reporting the session aggregate"; this change supersedes that sidebar behavior once implemented.

## Assumptions

- The latest-request value is labeled `Last` (Sidebar panel labels are capitalized, e.g. `In`, `Out`, `Cache`, `Hit`, `Cost`); this keeps the aggregate `Hit` label and semantics stable per the existing spec.
- The value is added as an additional row in the USAGE panel; exact placement and width behavior are design decisions, not part of the proposal contract.
