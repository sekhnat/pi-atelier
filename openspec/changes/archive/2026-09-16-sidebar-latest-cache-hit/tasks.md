## 1. Usage panel rendering

- [x] 1.1 In `src/sidebar.ts` `usageRows()`, render the latest-request rate as a `Last <pct>%` row after the Cache/Hit row and before Cost, using a shared rate-formatting helper that mirrors the aggregate's handling (`toFixed(1)%`, `—` + dim paint when omitted or non-finite, `cache` palette role) — verify: rendering the USAGE panel for the existing test snapshot shows both `Hit 96.0%` and `Last 88.0%`
- [x] 1.2 Keep the `Last` label in compact layout (design decision 4) — verify: rendering with a compact layout still shows the labeled `Last` value

## 2. Test coverage

- [x] 2.1 Extend `tests/sidebar.test.ts` to assert the USAGE panel renders both rates as distinct labeled values (`Hit` = session aggregate, `Last` = latest request) — verify: `npx vitest run tests/sidebar.test.ts` passes
- [x] 2.2 Add a case where `latestCacheHitPercent` is omitted while the aggregate is available and assert `Last` renders its `—` marker — verify: same vitest run passes

## 3. Full verification

- [x] 3.1 Run `npm run check` and confirm Biome and the full vitest suite pass
- [x] 3.2 Run `openspec validate sidebar-latest-cache-hit --strict` and confirm the change validates
