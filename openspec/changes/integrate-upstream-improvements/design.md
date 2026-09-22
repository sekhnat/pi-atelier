# Design

## Context

See `proposal.md` for motivation. The last commit shared by this fork and upstream is `18f3b22`; upstream is currently at `7e692d5`. The histories are not merge-equivalent after that point:

- This fork added capability-negotiated contributed-panel defaults, separate session/latest cache-hit semantics, shared terminal sanitization, monotonic elapsed timing, Pi 0.85 overlay-handle delegation, and enforced Biome/CI gates.
- Upstream added image compositing, disable-time suspension, two rendering/Git fast paths, fullscreen selection clamping, a settings Undo fix, and a default-on Nerd Font session ribbon. It also made cleanup and release changes that conflict with this fork's choices, including disabling lint and replacing footer metric formatting in ways that would lose `latestCacheHitPercent`.
- The current split pane intentionally uses instance-local Pi 0.84 renderer seams and already adapts Pi 0.85 `OverlayHandle.getBounds`; every added terminal hook must preserve that ownership, fallback, and teardown model.
- `resolveConfig` is the fork's single configuration pipeline. Global-user-only preferences are validated in every layer but applied only from user configuration.

The delta specs under `specs/` are the behavior contract for this design.

## Goals / Non-Goals

**Goals:**

- Port selected upstream behavior with commit-level provenance while retaining the fork's public protocol, metrics, configuration, timing, compatibility, and quality-gate behavior.
- Keep the ribbon completely inert by default and make enabling it a deliberate user-level font/UI choice.
- Keep new terminal adapters instance-local, lifecycle-safe, and removable when Pi switches renderers or Atelier is disposed.
- Add focused regression evidence for every ported behavior before relying on the full repository gate.

**Non-Goals:**

- Merging or rebasing onto upstream wholesale.
- Importing upstream release/version commits, agent-document cleanup, package asset pruning, or the change that disables Biome lint.
- Replacing this fork's cache-hit mapping, shared sanitizer, monotonic elapsed clock, contributed-panel defaults, or Pi 0.85 overlay adapter.
- Detecting whether the user's selected terminal font contains Nerd Font glyphs or adding a second plain-text ribbon vocabulary.
- Raising the Pi 0.84 peer-dependency floor, adding a runtime dependency, or publishing a release as part of implementation.

## Decisions

### 1. Port behavior, not whole commits

Use upstream commits as references and manually adapt the smallest coherent behavior slices:

| Upstream source | Decision |
|---|---|
| `4cc2cef` | Port the instance-local image compositor and its footer/split-pane bindings. |
| `5bca63a` | Port only the typed single Undo record; do not replace the fork's config/runtime consolidation or panel-default handling. |
| `2cf8e77` | Port disable-time producer suspension and re-enable reconciliation, adapted to the fork's lifecycle, notifier, TODO, and monotonic activity code. |
| `6037768` | Port metadata-based Sidebar height measurement while retaining effective contributed-panel layout and drop priorities. |
| `8f07ca5` | Port the no-tracked-change Workspace Pulse fast path and cancellation checks. |
| `ee5d853` | Port the fullscreen selection adapter only; retain the fork's overlay delegation and sanitization architecture. |
| `8220df0`, `7e692d5` | Adapt the ribbon/editor handshake and coverage behind `showSessionRibbon`; do not replace the default footer. |
| `4169a76`, `ab434be`, release/docs commits | Do not port wholesale; take no cleanup whose only value is churn or that weakens local gates. |

This is preferred over cherry-picking because the functional commits are interleaved with upstream refactors and assumptions that no longer hold in the fork. The implementation should mention source commit hashes in focused commit messages or code comments only where a private seam needs provenance; source comments should explain invariants rather than narrate the fork history.

### 2. Add one shared, instance-local image compositor

Add `src/image-compositor.ts` based on `4cc2cef`:

- Parse Kitty multipart graphics commands and iTerm2 image commands from image-bearing rendered lines.
- Separate graphics commands from text, let Pi compose text overlays, repair Sidebar cells on fullscreen image rows, then reinsert untouched graphics commands at their original columns.
- Suppress images intersecting visible capturing overlays while preserving occupied rows; allow Pi's next diff/render to restore them after the overlay closes.
- Store the adapter under a private symbol on the concrete renderer, with a client set shared by the footer and split pane. Rebind when Pi's stable TUI proxy switches concrete renderers and restore the original compositor after the last client releases.
- Never patch a prototype or `terminal.write`, and degrade to a no-op binding when the required renderer methods are absent.

Bind one client around footer rendering and one client in the split-pane controller that can provide the current fullscreen Sidebar frame. Every footer/split-pane disposal path must release its client even if another disposer throws.

### 3. Extend the split-pane ownership model for fullscreen selection

Add a fourth owned renderer seam beside the regular render, fullscreen layout, and fullscreen overlay adapters. It captures the concrete fullscreen renderer's `getSelectionColumns` method, delegates to it first, and clamps the resulting columns to `terminalWidth - effectiveSidebarWidth` only when:

- the drag did not begin in a transcript ScrollView,
- the fullscreen Sidebar child is visible, and
- no capturing overlay is active.

Sync this adapter through the existing reconciliation path and restore only when the current owner token matches. Do not change regular mode, resize input ordering, overlay-handle prototype delegation, or the Pi 0.84 `getBounds` shim.

### 4. Treat enabled state as a producer lifecycle

Add an enabled flag to `AtelierRuntime` and a `setEnabled` transition rather than scattering only command-level guards:

- Runtime invalidation, usage refresh, and Workspace Pulse publication become inert while disabled.
- `createWorkspacePulseRefresh` gains `setEnabled` and a per-enabled-lifetime `AbortController`. Disabling clears its debounce timer, increments freshness, aborts the lifetime, releases flush waiters, and prevents late publication. Re-enabling creates a fresh controller.
- Pass the signal through inspection and `pi.exec` options, while also checking cancellation after status so an executor that resolves after abort cannot publish a clean fast-path result.
- Preserve the last successful workspace data privately; on enable, expose it as stale until one fresh inspection completes, or expose inspecting when none exists.

`extensions/index.ts` remains the policy boundary for event-specific behavior. Disable resets partial response timing, notifications, visible TODO state, footer/editor, and Sidebar; events skip expensive reconstruction, estimation, refresh, collapse, notification, and render paths. Run/turn/tool completion counters continue, but tool starts received while disabled omit arguments. Enable reconstructs TODOs from the current branch, enables the runtime, and installs the footer exactly once. It intentionally does not show the Sidebar.

### 5. Apply the Workspace Pulse fast path after authoritative status parsing

After repository discovery and valid porcelain-v2 parsing, initialize numeric diff totals to zero. Resolve `HEAD^{tree}` and run `git diff --numstat` only when `trackedFiles > 0`; conflicts and changed submodules already contribute tracked records in the parser. Clean, untracked-only, and unborn-without-tracked-change repositories return after discovery and status.

This location preserves every existing parser and not-repository rule while removing two commands from the common clean path. Tests will assert both result equality and executor call count, plus cancellation during status and retained diff behavior for ordinary tracked, conflict, and submodule records.

### 6. Measure Sidebar candidates without painting them

Replace the loop that calls themed `renderGroups` for each candidate set with a row-count helper. The helper counts every content row plus three chrome rows when a group starts a new contiguous panel (header, bottom border, and spacer). Recalculate after each removal because dropping a group can join two groups from the same panel.

Only the retained set is passed to `renderGroups`. Keep the fork's `resolveEffectiveSidebarPanelLayout`, capability-negotiated defaults, contribution sanitization, unavailable-panel retention, configured order, and existing drop ranks unchanged. Add equivalence tests across representative widths/heights and a render-pass spy or benchmark assertion showing discarded candidate sets are not painted.

### 7. Replace parallel Undo slots with one discriminated record

In the Display Settings workspace, replace `undo`/`sidebarUndo`, their booleans, and `lastUndo` with one optional union:

- `{ kind: "display", value: SessionDisplayOverride | undefined }`
- `{ kind: "sidebar", value: SidebarPanelLayout }`

Every mutation overwrites that one record. Undo consumes it before restoration, so no older cross-domain slot can become visible. A successful Sidebar save clears the record only when its kind is `sidebar`; failures do not clear it. Sidebar snapshots continue to include capability-default-inserted and unavailable configured entries.

### 8. Add the ribbon as a user-only preference while leaving the default footer untouched

Add `showSessionRibbon: boolean` to `AtelierConfig` with default `false`, include it in the declarative global-user-only field list, and validate malformed values in every read layer. Add a Settings row and menu action that applies the value immediately, persists it to user configuration, rolls back on save failure, and requests live/editor/footer rendering.

Do not copy upstream's global footer rewrite. Preserve the current plain `renderFooterLine` path, its shared sanitizer, currency formatting, and its distinct session/latest cache-hit mapping. Extend the footer component with two additional render surfaces used only when the preference is enabled:

- a Nerd Font header surface for activity, model/thinking, workspace/branch, and context, respecting effective segment order/visibility and width drop rules;
- a compact telemetry surface for measured usage/cache/cost/performance, preserving this fork's metric meanings.

Extend `AtelierEditor` with an optional top-rule status callback and a `statusLineVisible` result. The installation handshake follows the proven upstream pattern: the editor offers the header only when ribbon mode is enabled and the terminal is tall enough; it rejects empty/overflowing content and preserves Pi scroll hints. The footer emits telemetry only for a render cycle in which the custom editor actually rendered the header. Otherwise—including selectors replacing the editor, narrow width, short terminals, or editor installation failure—it renders the unchanged complete plain Status Rail. Turning the preference off removes the header/telemetry split on the next render without reinstalling Pi.

Add `workspaceLabel` only to the footer snapshot used by the header. No runtime usage semantics change. Document that enabling the feature requires a Nerd Font and that Atelier neither installs nor selects one.

### 9. Preserve package and quality contracts

The new source module is already included by the package's `"src"` files entry, but add it to `scripts/verify-pack.mjs`'s required list so accidental omission fails the package gate. Keep `biome.jsonc`, the `lint` script, CI matrix/canary, peer ranges, and package version unchanged.

Add or extend focused tests in the existing domain files, introducing a dedicated image-compositor test file only if it gives clearer protocol coverage. Run focused Vitest targets during implementation, then `npm run check`. README and CHANGELOG updates describe the default-off ribbon, font setup, image/copy behavior, disable semantics, and performance fixes without claiming a release version.

## Risks / Trade-offs

- **[Private Pi renderer seams change]** → Keep all adapters capability-detected, instance-owned, reversible, and covered against the stable proxy; retain the weekly latest-Pi canary.
- **[Image escape parsing differs across terminals]** → Limit support to the Kitty/iTerm2 forms Pi emits, preserve commands byte-for-byte, test multipart and row-span cases, and no-op on unknown seams.
- **[Ribbon/footer render order causes duplicate or missing status]** → Use the editor's per-render visibility flag plus a cycle-local handshake; cover selector replacement, short terminal, narrow editor, enable/disable, and teardown.
- **[Ribbon port regresses local cache semantics or sanitization]** → Add surfaces around the local footer data model instead of replacing it; assert both cache rates and hostile terminal text in ribbon-mode tests.
- **[Abort is advisory for an executor]** → Combine `AbortSignal` propagation with lifetime/version checks before publication and release waiters immediately on suspension.
- **[Metadata height calculation diverges from painted chrome]** → Keep the chrome count adjacent to the panel renderer contract and add equivalence tests for joined/split panels and required overflow.
- **[Large selective port is hard to review]** → Implement in isolated behavior slices with focused tests and avoid unrelated cleanup in the same change.

## Migration Plan

1. Land behavior slices with tests while `showSessionRibbon` remains default-off.
2. Add the preference and menu/documentation last, after header/telemetry fallbacks pass focused tests.
3. Run `npm run check` and manually smoke-test regular/fullscreen modes with Sidebar resize, inline images, a capturing menu, disable/enable, and ribbon on/off.
4. Release separately after review; existing users retain the current UI and configuration because the new key defaults to `false`.

Rollback is additive: set or default `showSessionRibbon` to `false` to disable the new UI surface, and revert individual image/selection/suspension/fast-path slices if a Pi compatibility issue appears. No persisted data migration or destructive configuration rewrite is required.
