## Why

The repository's only enforcement surface is `npm run check` — the mandatory gate CONTRIBUTING requires for every PR — and it is broken in two ways. First, `biome.json` never enables `vcs.useIgnoreFile`, so Biome also checks gitignored runtime state such as `.pi/fabric/*.json`: the gate fails on any checkout where pi has run inside the repo, which CONTRIBUTING itself instructs contributors to do (`npx --no-install pi -e .`). The manual `!.pi-subagents` / `!*.tgz` entries in `files.includes` show this bug class has been patched piecemeal instead of fixed at the root. Second, the linter runs with `preset: none`, so `npm run lint` — advertised in CONTRIBUTING as part of the gate — is a no-op. Beyond Biome, the repository has no CI at all: the gate only ever runs on the maintainer's Node 26, the `engines` floor of `22.19` is never verified, and a new `@earendil-works/pi-coding-agent` release can break the extension without anyone noticing until a user reports it.

## What Changes

- Enable Biome VCS integration (`vcs: { enabled: true, clientKind: "git", useIgnoreFile: true }`) so Biome's file selection follows `.gitignore`; gitignored runtime state (`.pi/`, `.pi-subagents/`, `*.tgz`, `.worktrees/`, …) stops being linted and format-checked.
- Drop the now-redundant manual exclusions `!.pi-subagents` and `!*.tgz` from `biome.json` `files.includes`.
- Switch the Biome linter from `preset: none` to `preset: recommended` and fix all resulting findings across `src/` and `tests/` (a test-scoped override for `noExplicitAny` only if genuinely needed).
- Add one GitHub Actions workflow that runs `npm ci` + `npm run check` on every pull request and push, across Node `22.19`, `24`, and `latest` (the supported engines floor through current latest).
- Add a weekly scheduled canary job to the same workflow that installs the latest `@earendil-works/pi-coding-agent` (with its matching `@earendil-works/pi-tui`) and runs the check suite, so upstream Pi releases that break the extension surface within days instead of at a user's install.

## Capabilities

### New Capabilities

- `quality-gates`: The repository's enforcement surface — which files Biome selects (VCS/`.gitignore`-driven), which lint ruleset `npm run lint` enforces, and which CI checks must run (PR/push gate across the Node matrix, weekly upstream Pi canary).

### Modified Capabilities

(none — `openspec/specs/` has no existing capabilities)

## Impact

- Config: `biome.json` (new `vcs` block, linter preset, pruned `files.includes`). `.gitignore` is unchanged.
- Code: small mechanical fixes across `src/` and `tests/` to satisfy the `recommended` ruleset; no runtime behavior changes intended.
- CI: new `.github/workflows/ci.yml`; no publish, tag, or release permissions are granted to it.
- Dependencies: version ranges unchanged; the canary job upgrades only the two `@earendil-works/*` packages inside an ephemeral CI install.
- Docs: a `CHANGELOG.md` entry under `Unreleased` (dev-facing tooling change; README is unaffected).
