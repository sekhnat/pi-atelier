## 1. Biome file selection

- [x] 1.1 Add `"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }` to `biome.json` and drop the mirrored `!.pi-subagents` and `!*.tgz` entries from `files.includes`; verify the config is accepted: `npx biome check .` completes without config errors.
- [x] 1.2 Confirm gitignored runtime state is out of scope: on this checkout (which contains `.pi/fabric/` state), `npm run format:check && npm run lint` reports zero findings for paths under `.pi/`, and no `.pi-subagents/` or `*.tgz` paths appear in Biome output.

## 2. Lint ruleset

- [x] 2.1 Switch the linter to `preset: "recommended"` in `biome.json`; verify the new ruleset is active by running `npm run lint` and observing that it now reports findings (nonzero exit is expected at this point).
- [x] 2.2 Fix all `recommended` findings across `src/` and `tests/` with mechanical changes (unused imports/variables, `noExplicitAny`, suspicious patterns), keeping `src/` runtime behavior intact; verify `npm run lint` exits 0 and `npm test` still passes.
- [x] 2.3 Only if tests still require `any` after 2.2: add a single override scoped to `tests/**` disabling `noExplicitAny` and `noNonNullAssertion` (widened per the apply-time decision approved by the user — 55 test-only non-null assertions have no safe autofix), with a comment explaining why; probe that `src/` remains fully checked (temporarily introduce a finding in a `src/` file, confirm lint fails, remove the probe); verify `npm run lint` exits 0.
- [x] 2.4 Fix any tracked-file formatting findings that surface once gitignored files leave Biome's scope; verify `npm run format:check` exits 0.

## 3. CI workflow

- [x] 3.1 Create `.github/workflows/ci.yml` with `permissions: contents: read`, per-event-name-and-ref `concurrency` with `cancel-in-progress: true` (apply-time correction: a canary dispatch was cancelled by the concurrent push run), a `check` job (`pull_request` + `push` to `main`; `actions/checkout@v4`; `actions/setup-node@v4` with `cache: npm` and matrix `[22.19, 24, latest]`; `npm ci` then `npm run check`), and a `canary` job (weekly cron `0 9 * * 1` plus `workflow_dispatch`; `npm ci`; `npm install --no-save @earendil-works/pi-coding-agent@latest @earendil-works/pi-tui@latest`; `npm run check`) per design D3/D4.
- [x] 3.2 Validate the workflow file: YAML parses (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` or `npx --yes yaml-lint .github/workflows/ci.yml`), triggers include `pull_request`/`push`/`schedule`/`workflow_dispatch`, and the canary steps match design D3/D4; note the Node versions setup-node resolves for the `22.19` and `latest` entries (substitute a numeric pin if the `latest` alias is rejected).

## 4. Documentation and full gate

- [x] 4.1 Add a `CHANGELOG.md` entry under `Unreleased` describing the dev-facing tooling change (Biome VCS integration, recommended lint preset, CI matrix + weekly canary); verify it matches the file's existing entry style.
- [x] 4.2 Run the complete repository gate on this checkout containing `.pi/fabric/` state — `npm run check` (typecheck, lint, format:check, test, check:pack) exits 0, which is the spec's target condition — and run `git diff --check` against the base branch for whitespace errors.
