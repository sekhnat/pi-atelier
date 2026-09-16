## 1. Dependency target

- [x] 1.1 Bump devDependencies `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` from `0.84.0` to `0.85.1` and run `npm install` (lockfile refreshed); verify `npm run typecheck` reports exactly the known handle-surface error at the fullscreen overlay wrapper and nothing else.

## 2. Overlay handle compatibility

- [x] 2.1 Add `getBounds` delegation to the fullscreen overlay adapter's returned handle (optional call on the wrapped handle, returning `undefined` when absent); verify `npm run typecheck` exits 0 with the 0.85.1 devDeps.
- [x] 2.2 Add regression coverage: the adapter's handle delegates `getBounds` to the wrapped handle when it exists and returns `undefined` (without throwing) when the wrapped handle predates `getBounds`; verify `npm test` passes.

## 3. Documentation and gate

- [x] 3.1 Add a `CHANGELOG.md` entry under `Unreleased` describing Pi 0.85 overlay-handle compatibility and the dev type-target bump; verify it matches the existing entry style.
- [x] 3.2 Run the complete repository gate `npm run check` (now typechecking against Pi 0.85.1) and confirm exit 0; after merge, `workflow_dispatch` the canary once and confirm it goes green against latest Pi.
