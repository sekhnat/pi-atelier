## Context

The canary run 35116020007 failed typecheck against latest Pi 0.85.1: `src/split-pane.ts(262,3)` — Pi TUI 0.85 added a required `getBounds(): OverlayBounds | undefined` to `OverlayHandle` (terminal-relative `{ row, col, width, height }`), and the fullscreen sidebar overlay adapter's wrapper returns a custom handle without it. The wrapper's other return path passes Pi's own handle through unchanged (already compliant). `OverlayOptions` is unchanged in 0.85 — the canary typecheck flagged only the handle surface. Dev dependencies pin `0.84.0`; the peer range is `>=0.84.0`; the canary upgrades both `@earendil-works` packages to `@latest`.

## Goals / Non-Goals

**Goals:**

- The overlay handle returned by the fullscreen adapter satisfies the installed Pi's `OverlayHandle` contract on every supported version — `getBounds` on Pi ≥ 0.85, harmlessly absent-behaving on Pi 0.84.
- Type-gate against the newest published Pi so the next upstream divergence surfaces in a weekly canary run, not at a user's install.

**Non-Goals:**

- No change to the supported Pi floor (`peerDependencies` stays `>=0.84.0`) or to CONTRIBUTING/README minimum-version statements.
- No migration of `OverlayOptions` usage (unchanged in 0.85), no changes to the regular-render adapter (no `OverlayHandle` surface), no new CI requirements — the existing weekly canary already covers detection.

## Decisions

### D1 — Type target moves to 0.85.1; floor stays 0.84.0

Bump devDependencies `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` from `0.84.0` to `0.85.1` so `tsc` checks the newest contract. Alternatives rejected: keeping 0.84 types with local casts (never typechecks the new contract — the canary would miss the next divergence); raising the peer floor to `>=0.85.0` (drops 0.84 users for a one-member addition the runtime ignores).

### D2 — Defensive delegation for `getBounds`

The wrapper handle gains `getBounds: () => handle.getBounds?.()` — under 0.85 types it delegates to the wrapped base handle; at runtime on Pi 0.84, where the base handle has no `getBounds`, the optional call yields `undefined`, matching the declared `OverlayBounds | undefined`. Delegation is faithful: Pi's own handles return `undefined` for entries that are not currently rendered, and the wrapper's wrapped entry is intentionally non-visible (`visible: () => false`), so `undefined` is the correct steady-state answer. The passthrough return path needs no change.

## Risks / Trade-offs

- [Runtime drift beyond the type surface: Pi 0.85 may change overlay behavior the adapter depends on] → the canary runs the full test suite against latest Pi, not just typecheck; remaining drift surfaces there within a week.
- [`getBounds?.()` is a no-op cast under 0.85 types but load-bearing on 0.84 runtimes] → covered by a regression test asserting `undefined` when the wrapped handle predates the member.
- [0.85.x may release again mid-window with further `OverlayHandle` changes] → delegation keeps the wrapper in lockstep with the base handle; only base-contract changes (not handle passthrough) would need work.

## Migration Plan

1. Land the devDep bump + delegation + tests in one PR; `npm run check` must pass with 0.85.1 devDeps.
2. After merge, `workflow_dispatch` the canary once — it is expected to go green against latest Pi.
3. Rollback: revert the PR (dependency pins return to 0.84.0; the canary returns to its current red-by-signal state).

## Open Questions

- None. The delegation semantics (bounds of a non-visible entry → `undefined`) mirror Pi's own implementation.
