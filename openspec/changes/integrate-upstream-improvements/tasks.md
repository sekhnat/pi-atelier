# Tasks

## 1. Runtime Suspension and Workspace Pulse

- [x] 1.1 Add enabled-lifetime cancellation to the Workspace Pulse refresh coordinator, propagate `AbortSignal` through inspection/execution, and verify debounce cancellation, flush release, stale-result rejection, re-enable, and disposal in `tests/workspace-pulse.test.ts`.
- [x] 1.2 Add `AtelierRuntime.setEnabled` so disabled runtimes suppress invalidation, usage scans, inspection scheduling, and publication while preserving last workspace data for stale-on-enable reconciliation; verify transitions and trusted/untrusted states in `tests/state.test.ts`.
- [x] 1.3 Add response-reset support without changing monotonic elapsed-time accounting, and wire `/atelier disable|enable` plus event guards for TODOs, estimates, notifications, renders, and argument-free tool bookkeeping; verify partial responses, idempotent transitions, sidebar-hidden behavior, and current-state reconciliation in `tests/run-activity.test.ts` and `tests/extension.test.ts`.
- [x] 1.4 Implement the no-tracked-change Workspace Pulse fast path after valid status parsing, and verify clean, untracked-only, unborn, tracked, conflict, submodule, failure, and cancelled-status cases plus Git command counts in `tests/workspace-pulse.test.ts`.

## 2. Sidebar Fitting and Settings Undo

- [x] 2.1 Replace repeated candidate painting with contiguous-panel row measurement, retaining effective contributed-panel defaults, order, sanitization, required groups, and drop ranks; verify output equivalence across representative heights and one final render pass in `tests/sidebar.test.ts` (and a focused benchmark only if needed).
- [x] 2.2 Replace parallel Display/Sidebar Undo slots with one discriminated record, preserving capability-default-inserted and unavailable panel entries; verify both cross-domain edit orders, Revert-after-Sidebar, single consumption, successful Sidebar save, and failed save in `tests/settings-workspace.test.ts`.

## 3. Image Compositing and Fullscreen Selection

- [x] 3.1 Add `src/image-compositor.ts` with instance-local shared ownership, Kitty multipart and iTerm2 extraction/reinsertion, capturing-overlay suppression, stable-renderer rebinding, and no-op fallback; verify byte-preserving placement, row spans, modal hiding/restoration, multiple clients, renderer switching, and teardown in `tests/image-compositor.test.ts`.
- [x] 3.2 Bind the image compositor to footer rendering and fullscreen Sidebar frames with exception-safe disposal; verify regular/fullscreen image coexistence, capturing-menu behavior, renderer replacement, and lifecycle cleanup in the compositor, split-pane, and extension tests.
- [x] 3.3 Add an owned fullscreen selection adapter that clamps non-transcript drags to the main pane while preserving transcript, modal, resize, regular-mode, and Pi 0.85 overlay-handle behavior; verify highlighting/OSC 52 copy and adapter restoration in `tests/fullscreen-copy-safe-sidebar.test.ts` and `tests/split-pane.test.ts`.

## 4. Opt-in Session Ribbon

- [x] 4.1 Add default-off `showSessionRibbon` typing and user-only configuration resolution, including malformed-value warnings and protection from project/session overrides; verify defaults, custom bases, layer precedence, and validation in `tests/config.test.ts`.
- [x] 4.2 Add a Settings control that applies and persists `showSessionRibbon`, rolls back after persistence failure, and requests live rendering; verify labels, success, rollback, lifecycle retirement, and unknown-config-key preservation in `tests/menu.test.ts` and `tests/config.test.ts`.
- [x] 4.3 Extend the footer component with opt-in Nerd Font header and measured-telemetry surfaces while leaving the complete plain Status Rail unchanged; verify width/drop behavior, segment visibility/order, session versus latest cache-hit mapping, shared terminal sanitization, cost formatting, and default-off snapshots in `tests/footer.test.ts`.
- [x] 4.4 Extend `AtelierEditor` with an optional top-rule status callback and visibility result that preserves scroll hints and rejects empty or overflowing headers; verify framed, narrow, scrolled, and plain-editor cases in `tests/editor.test.ts`.
- [x] 4.5 Wire the editor/footer render-cycle handshake, workspace label, toggle updates, fallback footer, and teardown in `extensions/index.ts`; verify enabled ribbon, selector replacement, fewer-than-12-row and narrow-width fallback, default-off behavior, disable/enable, failed editor installation, and session retirement in `tests/extension.test.ts`.

## 5. Package, Documentation, and Gates

- [x] 5.1 Require the new compositor module in `scripts/verify-pack.mjs` without changing package version, peer floors, asset policy, linting, or CI; verify `npm run check:pack` and `tests/package.test.ts` pass.
- [x] 5.2 Update README configuration, font opt-in/fallback guidance, image/copy behavior, and disable semantics plus Unreleased CHANGELOG entries; verify documentation contract assertions in `tests/package.test.ts` cover the default-off ribbon and Nerd Font requirement.
- [x] 5.3 Run the complete `npm run check` gate and verify typecheck, recommended Biome lint, formatting, all Vitest tests, and package verification pass with no upstream release or quality-gate regressions.
- [x] 5.4 Smoke-test regular and fullscreen TUI modes with Sidebar resize, Kitty/iTerm2 image fixtures, a capturing menu, editor/sidebar/transcript selection, disable/enable, and ribbon on/off; record results and verify the default configuration remains visually unchanged.
