# Pi Atelier — System Analysis & Improvement List

Basis: full source review plus an executed quality gate on pi-atelier **v0.10.1** (commit `8c3223e`, Node v26.8.1, 2026-09-15). No code was changed during the analysis; dev dependencies were installed (`npm ci`) only to run the gate.

Use this document as a backlog: each numbered item is a candidate issue or PR, ordered by priority tier. P0 items are gate-blocking and small; the architecture batch (P1) is larger but mechanical.

## What this system is

Pi Atelier is a Pi TUI extension — roughly 8,200 lines of TypeScript across `src/` + `extensions/` and 10,000 lines of tests (18 files, 470 tests) — providing a responsive status rail and live activity sidebar, plus a public event-bus protocol through which other extensions can contribute sidebar panels.

```
extensions/index.ts (995)          <-- Pi lifecycle & event wiring
  |   (lifecycle tokens, candidate/active session swap, teardown)
  |
  +-> config.ts (483)                  layered user/project/session config
  |     +-> display.ts (153)           segment/preset normalization
  |
  +-> state.ts (327)                   AtelierRuntime hub: usage, display, activity
  |     +-> workspace-pulse.ts (320)   git porcelain=v2 + coalescing/serialization
  |     +-> metrics.ts (81)            usage aggregation
  |     +-> activity.ts (44)           working-phrase selection
  |
  +-> sidebar.ts (1426)                snapshot + 8 panel renderers + controller
  |     +-> split-pane.ts (563)        Pi 0.84 renderer adapters (symbols, proto wraps)
  |     +-> palette.ts (91)            semantic theming + NO_COLOR fallback
  |
  +-> menu.ts (823)                    control center + display settings overlays
  |     +-> settings-workspace.ts (698)
  |     +-> editor.ts (88), overlay-lifecycle.ts (121)
  |
  +-> sidebar-panels.ts (681)          PUBLIC panel protocol: sanitize, bounds,
  |                                   revisions, capability-negotiated defaults
  +-> completion-notifier.ts (202)     macOS/Windows native notifications
  |
  +== event bus channel "pi-atelier:sidebar-panels" ==> external extensions
      (pi-ollama-cloud, pi-hypercharm-provider, ...)
```

## Health-check evidence

`npm ci` was run, then every step of `npm run check` on this checkout:

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | PASS |
| `biome lint .` | Passes vacuously — `"preset": "none"` enables zero rules |
| `biome format .` | **FAILS** on `.pi/fabric/mcp-cache.json` and `.pi/fabric/mesh/state.json` |
| `vitest run` | PASS — 470/470 tests in ~1.4s (hermetic via temp `PI_CODING_AGENT_DIR`) |
| `check:pack` | PASS (26 files) |
| CI | **None** — `.github/` contains only a PR template |

## Strengths worth preserving

- **Security posture (verified, not assumed):** zero network calls in `src/`; the completion notifier spawns `osascript`/`powershell` with argv/env passing and static scripts (no shell-injection surface); contributed panel input is bounded at raw-code-unit level *before* sanitization, with strict namespaced-ID validation, panel/source caps, and revision ordering; user config writes are atomic with `0600` permissions.
- **Lifecycle rigor:** lifecycle tokens, retired snapshots, exception-safe teardown, inert post-dispose state (`src/state.ts`) — CHANGELOG 0.7.x–0.8.x shows each mechanism encodes a real past failure.
- **Test culture:** 470 fast, hermetic tests covering runtime seams (real renderer replacement, resize rollback), plus a package-contract test.
- **Workspace Pulse engineering:** `--porcelain=v2` parsing, coalescing/serialization, unborn-HEAD empty-tree baseline, per-exec timeouts, trust gating.
- **Docs discipline:** per-release CHANGELOG, CONTRIBUTING with evidence requirements, README privacy claims that check out under audit.

## Improvements

### P0 — The quality gate itself is broken (small effort, high leverage)

1. **Fix biome/gitignore interplay.** `biome.json` never enables `vcs.useIgnoreFile`, so biome checks gitignored runtime state (`.pi/fabric/*.json`) and `npm run check` — the "complete repository gate" per CONTRIBUTING — fails on any checkout where pi has run in the repo (which CONTRIBUTING itself instructs contributors to do). The manual `!.pi-subagents` / `!*.tgz` exclusions show this bug class has been patched piecemeal before. Fix: add `"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }`, then drop the mirrored exclusions.
2. **Enable real lint rules.** `"preset": "none"` makes `npm run lint` a no-op while CONTRIBUTING advertises "Biome linting" as part of the gate. Enable `recommended` (with a tests override for `noExplicitAny` if needed) and fix findings.
3. **Add CI.** One workflow: `npm ci` + `npm run check` on PRs and pushes, Node matrix `[22.19, 24, latest]` (the engines floor is 22.19; today everything is only ever tested on the maintainer's Node 26). Add a weekly canary job installing the latest `@earendil-works/pi-coding-agent` — see item 10.

### P1 — Correctness & architecture (medium effort)

4. **`src/metrics.ts` cache-hit semantics.** `cacheHitPercent` is recomputed per message inside the aggregation loop and the *last* usage-bearing message wins (`src/metrics.ts:53`): it is a "latest request" value masquerading as a session metric, and it flickers to `undefined` whenever the latest message has an empty prompt. Make it deliberately aggregate (`cacheRead / (input + cacheRead + cacheWrite)` across the session) or explicitly "latest" with a stable fallback.
5. **`scripts/verify-pack.mjs` Windows breakage.** `spawnSync("npm", ...)` throws `EINVAL` on Windows (Node >= 18.20 blocks `.cmd` without `shell: true`), yet the project explicitly supports Windows (the notifier has a win32 path). Use `process.execPath` + npm-cli.js, and handle `result.error` (currently swallowed as an empty exit).
6. **Package entry point for the panel protocol.** `tests/package.test.ts` asserts the "deliberate structured contribution contract from the package entrypoint", and `docs/superpowers/plans/…provider-usage-sidebar…` shows sibling extensions importing `registerSidebarPanel` — but `package.json` has no `main`/`exports`, so `import … from "pi-atelier"` cannot resolve under Node rules. Add an `exports` map with a lightweight `./protocol` subpath (→ `src/sidebar-panels.ts`) so consumers do not pull the whole extension entry; verify against pi's loader resolution.
7. **Consolidate the text sanitizers.** Identical implementations live at `src/footer.ts:58` and `src/sidebar.ts:132`, with further variants in `src/sidebar-panels.ts`, `src/run-activity.ts:393`, `src/menu.ts:363`, and `src/completion-notifier.ts`. The recent CSI-sequence fix (commit `d9d656a`) had to be applied twice — exactly the bug class a shared `src/sanitize.ts` (CSI strip + control-char collapse + bounded truncation, one test file) eliminates.
8. **Decompose the two monoliths.** `extensions/index.ts` (995 lines): extract `src/todos.ts` (guards/normalize/reconstruct, ~100 lines) and a session-lifecycle module (lifecycle tokens, ActiveSession, teardown) so the entry becomes pure wiring. `src/sidebar.ts` (1,426 lines): split the eight panel renderers into `src/panels/*` behind the existing row model. While there, derive `verify-pack`'s `required` list from git-tracked `src/` + `extensions/` files instead of the hardcoded list (it will silently rot during this split).
9. **Deduplicate config resolution.** `loadConfig` and `validateConfig` in `src/config.ts` run parallel copies of the same pipeline (applyNonDisplay → resolveDisplayLayers → resolveSidebarLayout → legacy compat); divergence here silently breaks a tested contract. Extract one shared resolver.
10. **Isolate the Pi-0.84 internal adapters.** `src/split-pane.ts` monkey-patches renderer internals via `PI_084_*` symbols and prototype wraps, with graceful fallback (good) — but the hacks are interleaved with controller logic. Concentrate all version-pinned seams in one `pi-084-adapters.ts` with a single `detectSupport()`; combined with the canary CI (item 3), the next Pi TUI release becomes a one-file, one-PR event. Longer term, upstream a supported split-pane API into pi-tui.
11. **Add coverage reporting.** 470 tests but no coverage configuration or threshold. Add `@vitest/coverage-v8` plus a `test:coverage` script to make panel-renderer branches and lifecycle paths visible.

### P2 — Docs & process (low effort, compounding value)

12. **Write `docs/architecture.md`.** The lifecycle-token design, split-pane adapter strategy, config layering, and panel protocol currently live only in CHANGELOG prose and test names — the biggest onboarding tax for contributors.
13. **Panel-protocol contributor doc + example.** The contribution protocol is the project's flagship extensibility feature (PR #1 shows external adoption) but has one README paragraph. A `docs/panel-protocol.md` with a minimal example extension (register + `defaults` + discovery replay) would drive adoption.
14. **Reconcile stale planning docs.** `docs/superpowers/plans/2026-09-15-provider-usage-sidebar-atelier.md` checkboxes are all unchecked though its tasks shipped (merged PRs); the repo's own 0.3.0 convention was removing completed plans. Update or archive.
15. **Decide the `openspec/` scaffold.** It is untracked (`?? openspec/`; empty `.gitkeep` tree + `config.yaml`). Commit it if adopting the openspec workflow here, otherwise remove or ignore it.
16. **Issue templates.** CONTRIBUTING is issue-first, but `.github/ISSUE_TEMPLATE/` does not exist. Add bug/feature templates matching `docs/agents/triage-labels.md`.
17. **Split the 2,700-line test monoliths** (`tests/extension.test.ts`, `tests/sidebar.test.ts`) by domain, and type the `any`-heavy harness fakes against `ExtensionAPI`/`ExtensionContext` so harness drift fails typecheck instead of surfacing at runtime.

### P3 — Micro-hygiene (batch into one cleanup PR)

18. **Freeze or factory `DEFAULT_CONFIG`** (`src/types.ts`) — a mutable exported object; every use site currently deep-clones it, so make that invariant structural.
19. **Hoist `VALID_TODO_STATUSES` to module scope** (`extensions/index.ts:198` — currently allocated per extension call).
20. **Whitelist keys in `saveUserConfigPatch`** so internal callers cannot persist unknown keys into user config.
21. **Hot paths:** memoize `refreshUsage()` by entry count (it re-aggregates all session messages on five event types); throttle the `message_update` → `estimateTokens` call (currently every streaming chunk).
22. **`timer.unref?.()`** in `src/completion-notifier.ts` — an optional call on a Node `Timeout` is dead defensiveness; simplify or comment why.

## Suggested order of attack

Items 1–3 together are the biggest single win: they make the existing (excellent) test suite and strict typecheck actually *enforced* on every PR and every contributor machine, which is currently not true anywhere. Then 4–7 as a correctness/packaging batch, 8–11 as the architecture batch, and the rest opportunistically.
