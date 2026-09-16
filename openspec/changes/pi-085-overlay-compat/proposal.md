## Why

The weekly canary run against the latest published Pi failed its first-ever check: Pi 0.85.1 added a required `getBounds()` member to the TUI's `OverlayHandle`, and the fullscreen sidebar overlay adapter returns a handle without it (`src/split-pane.ts(262,3)` — the only type error). Since the extension declares Pi compatibility `>=0.84.0`, users on Pi 0.85 get an overlay handle missing part of its contract; the pinned-version gate never sees it because the dev dependencies still typecheck against 0.84.0.

## What Changes

- Implement `getBounds()` on the overlay handle returned by the fullscreen overlay adapter, delegating to the wrapped Pi handle and returning `undefined` when the wrapped handle predates `getBounds` (Pi 0.84).
- Bump devDependencies `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` from `0.84.0` to `0.85.1` so the type gate checks the newest contract.
- Add regression coverage for the delegation (bounds passthrough; `undefined` on pre-`getBounds` handles).
- No peer-range change: the supported Pi floor stays `0.84.0`; the weekly canary against latest Pi is expected to go green after this lands.

## Capabilities

### New Capabilities

- `overlay-adapter`: The fullscreen sidebar's overlay integration contract with the Pi TUI overlay system — the handle surface the adapter must satisfy for every supported Pi version, including `getBounds` delegation.

### Modified Capabilities

(none — no existing capability's requirements change; `quality-gates` already requires the weekly canary that detected this)

## Impact

- Code: `src/split-pane.ts` (the adapter's returned handle gains `getBounds` delegation); no other sites — the passthrough return path already yields Pi's own handle.
- Dependencies: `package.json` devDependencies + lockfile (0.84.0 → 0.85.1 type target). Peer ranges unchanged.
- Tests: new regression coverage for the delegation paths.
- Docs: `CHANGELOG.md` entry under `Unreleased`.
- CI: no workflow change; the weekly canary is the acceptance harness for this change (expected green after merge + dispatch).
