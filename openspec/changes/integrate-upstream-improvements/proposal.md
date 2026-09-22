# Proposal

## Why

This fork diverged from upstream at `18f3b22`; upstream has since reached `7e692d5` with several correctness, terminal-integration, and performance improvements that are still absent here. A selective port is needed because a direct merge would overwrite fork-specific work such as contributed-panel defaults, cache semantics, monotonic timing, Pi 0.85 overlay compatibility, and enforced lint/CI gates.

## What Changes

- Keep inline transcript images visible beside the Sidebar, and temporarily suppress visible images behind capturing overlays so dialogs remain readable and images return after close.
- Keep fullscreen screen-selection and OSC 52 copy operations out of the Sidebar when a drag begins outside the transcript, without changing transcript selection, scrolling, modal selection, or regular-mode terminal selection.
- Make `/atelier disable` suspend expensive producers: usage/history scans, streaming estimates, TODO reconstruction, renders, notifications, and Git inspections; cancel pending/in-flight workspace work and reconcile once on re-enable while retaining minimal run/tool bookkeeping.
- Avoid redundant Workspace Pulse `HEAD` and diff commands when no tracked files changed, while preserving branch and untracked-file reporting.
- Fit Sidebar content by measuring row metadata rather than repeatedly rendering candidate panel sets, preserving panel order, chrome, and drop priorities.
- Correct Display/Sidebar one-step Undo so the newest edit is the only undo target and Display Revert cannot restore an older Sidebar edit.
- Add the upstream composer session ribbon as an explicit, user-only opt-in that defaults off. When enabled, it uses Nerd Font prompt icons and compact telemetry, but the existing complete Status Rail remains the fallback when the custom editor, terminal height, or available width cannot support the ribbon.
- Preserve fork-only behavior and quality gates; do not import upstream release bookkeeping, agent-document cleanup, disabled linting, or unrelated refactors that provide no retained behavior.

## Capabilities

### New Capabilities
- `terminal-integration`: Inline-image compositing, fullscreen selection boundaries, and the opt-in composer session ribbon with safe fallback behavior.
- `runtime-suspension`: Work that stops while Atelier is disabled and the state that is reconciled when it is re-enabled.
- `workspace-pulse`: Observable Workspace Pulse inspection results and its clean/untracked-only fast path.
- `sidebar-rendering`: Height fitting that preserves Sidebar composition while avoiding rendering discarded candidates.
- `display-settings`: Single-level Undo semantics shared by Display and Sidebar edits.

### Modified Capabilities

None. Existing `usage-metrics` aggregation and cache-display semantics remain unchanged.

## Impact

- Runtime and lifecycle wiring in `extensions/index.ts`, `src/state.ts`, `src/run-activity.ts`, and `src/workspace-pulse.ts`.
- Terminal seams in `src/split-pane.ts`, a new image-compositor module, `src/editor.ts`, and `src/footer.ts`.
- Configuration and settings types, loading, controls, and documentation for the default-off ribbon preference.
- Sidebar composition and Display Settings Undo internals.
- Focused regression tests, performance benchmarks where retained, package-file verification, README/CHANGELOG updates, and the full `npm run check` gate.
- No peer-dependency floor change is intended; Pi 0.84 remains supported while the fork's Pi 0.85 overlay-handle compatibility is preserved.
