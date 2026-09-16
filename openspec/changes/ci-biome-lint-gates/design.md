## Context

`npm run check` (`typecheck && lint && format:check && test && check:pack`) is the repository's entire gate. `biome.json` (Biome 2.5.4) enables the formatter but pins the linter to `preset: none`, and its `files.includes` hand-mirrors two `.gitignore` decisions (`!.pi-subagents`, `!*.tgz`) while never telling Biome about `.gitignore` at all — so `.pi/fabric/*.json` gets checked and fails the gate on any checkout where pi has run. There is no `.github/workflows/`. `engines` requires `>=22.19.0`; the two `@earendil-works/*` packages are pinned `0.84.0` with peer ranges `>=0.84.0`; tests run under Vitest. CONTRIBUTING mandates `npm run check` for every PR and interactive validation via `npx --no-install pi -e .`.

## Goals / Non-Goals

**Goals:**

- Derive Biome's file selection from `.gitignore` at the root, ending the piecemeal-mirror pattern.
- Make `npm run lint` meaningful: `recommended` preset, all findings fixed, overrides (if any) scoped to tests only.
- One workflow file with a matrix check job (22.19 / 24 / latest) and a weekly, manually dispatchable canary against the latest upstream Pi.

**Non-Goals:**

- No change to the composition of `npm run check`, to Vitest/TypeScript configs, or to release/publish automation.
- No OS matrix (ubuntu-latest only), no Dependabot/Renovate, no `.gitignore` edits.
- No runtime behavior changes in `src/` beyond mechanical lint fixes.

## Decisions

### D1 — Fix file selection at the root: `vcs.useIgnoreFile`

Add to `biome.json`:

```json
"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }
```

and remove exactly `!.pi-subagents` and `!*.tgz` from `files.includes` — the two entries that exist only to re-do `.gitignore`'s work. Keep `!node_modules`, `!coverage`, and `!package-lock.json`: the first two are redundant with `.gitignore` but harmless belt-and-braces for CI checkouts, and the lockfile is tracked so it still needs an explicit exclusion from formatting. Alternatives considered: adding `!.pi` to `includes` (a third instance of the same piecemeal patch, guaranteed to drift again) — rejected; enabling `vcs.enabled` without `useIgnoreFile` (only makes includes revision-aware, does not read ignores) — insufficient. Biome 2.x parses `.gitignore` natively, negations included, once `useIgnoreFile` is on.

### D2 — Linter preset: `recommended`, fixes over overrides

`"linter": { "enabled": true, "rules": { "preset": "recommended" } }`. `recommended` is Biome's curated default — the level the ecosystem treats as table stakes; `all` is too noisy for this codebase, `none` is exactly what is being removed. Process: run `npx biome lint .`, fix findings mechanically (unused imports/variables, `noExplicitAny`, suspicious patterns), keeping diffs small and grouped. If tests genuinely need `any` (Vitest fixtures, Pi internals not worth stubbing), add a single override scoped to `tests/**` disabling `noExplicitAny` and — per an apply-time decision approved by the user — `noNonNullAssertion` (55 test-only non-null assertions, no safe autofix); `src/**` stays fully checked. Formatter config is untouched, but tracked-file `format:check` failures may surface for the first time once gitignored files leave scope — fix them in the same pass.

### D3 — One workflow, two jobs

`.github/workflows/ci.yml`:

- `permissions: contents: read`; `concurrency` group per ref with `cancel-in-progress: true` so rapid pushes don't pile up runs.
- Job `check` — triggers `pull_request` + `push` to `main`. `actions/checkout@v4`, then `actions/setup-node@v4` with `node-version: ${{ matrix.node }}`, `cache: npm`, matrix `[22.19, 24, latest]`, then `npm ci` and `npm run check`. setup-node resolves `22.19` to the newest 22.19.x, so the engines floor is exercised exactly.
- Job `canary` — triggers `schedule` (weekly cron, proposed `0 9 * * 1`, Monday 09:00 UTC) + `workflow_dispatch`. `npm ci`, then `npm install --no-save @earendil-works/pi-coding-agent@latest @earendil-works/pi-tui@latest`, then `npm run check`.

One file because both jobs are the same concern — enforcing the repository gate — and a single workflow keeps one status signal to watch. `--no-save` keeps the canary's upgrade ephemeral: the matrix job always sees the committed lockfile. Peer ranges `>=0.84.0` accept `@latest` cleanly. If the pinned setup-node version rejects the `latest` alias at apply time, substitute the numeric current-latest for that matrix entry — the spec requires "latest", not a literal string.

### D4 — Canary signals, doesn't gate

The canary runs on schedule/manual dispatch only — it never appears on PRs, so it cannot block contribution. No `continue-on-error`: an upstream breaking release must turn the scheduled run red, which is the point. Triage cost is bounded (one job, one run a week).

## Risks / Trade-offs

- [Recommended preset surfaces a large findings backlog] → Fix in small mechanical commits grouped by rule; fall back to a documented per-file override only where a rule is genuinely wrong for this codebase, never a blanket relaxation.
- [`latest` alias or Node 22.19 resolution quirks] → Verify resolved versions in the first run; substitute a numeric pin for the `latest` entry if needed. The floor entry itself is pinned `22.19`.
- [Weekly canary noise when upstream breaks] → Scheduled-only, single job, red-on-failure. If it proves noisy, a follow-up can move the canary to a separate non-required status check — out of scope here.
- [Biome scope changes between maintainer machine and CI] → Both read the same `.gitignore` once `useIgnoreFile` is on; verify `npm run check` on this repo's own checkout, which contains `.pi/fabric` state — that is the target condition.

## Migration Plan

1. Land `biome.json` + lint fixes in one PR; run `npm run check` locally on a checkout containing `.pi/fabric` state (the fix's acceptance condition).
2. Merge the workflow; the resulting push run validates the matrix job end-to-end.
3. Immediately `workflow_dispatch` the canary once so that job path is validated the same week, not after up to seven days.
4. Rollback: revert the PR — config and workflow only, no data or runtime migration.

## Open Questions

- None material. The canary cron day/time (proposed Monday 09:00 UTC) is a preference, adjustable at apply time without touching specs or task breakdown.
