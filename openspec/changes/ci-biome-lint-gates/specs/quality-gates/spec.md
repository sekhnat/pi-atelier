## Purpose

Defines the repository's enforcement surface: which files the Biome-based gate selects, which lint ruleset `npm run lint` enforces, and which CI checks must run so the gate is verified across supported Node versions and against new upstream Pi releases.

## ADDED Requirements

### Requirement: Biome file selection follows VCS ignore rules
The repository's Biome configuration SHALL enable VCS integration with client kind `git` and `useIgnoreFile` enabled, so Biome checks the files Git tracks rather than a hand-maintained list. The configuration SHALL NOT re-express `.gitignore` decisions as manual include entries for files Git already ignores.

#### Scenario: Gate passes on a checkout containing gitignored runtime state
- **WHEN** a checkout contains gitignored runtime state under `.pi/` (for example `.pi/fabric/*.json`) and `npm run check` runs
- **THEN** the command completes without Biome reporting lint or format findings for the gitignored files

#### Scenario: Mirrored exclusions are removed
- **WHEN** the Biome configuration is inspected after this change
- **THEN** `vcs` is enabled for git with `useIgnoreFile: true`, and `files.includes` no longer contains the manual `!.pi-subagents` and `!*.tgz` entries

### Requirement: Lint enforces the recommended ruleset
The `npm run lint` script SHALL run the Biome linter with the `recommended` preset so that preset findings in tracked sources fail the command with a nonzero exit. Any rule relaxation SHALL be an override scoped to test files only; non-test sources SHALL be checked under the unmodified preset.

#### Scenario: Findings fail the command
- **WHEN** `npm run lint` runs against a tracked file containing a `recommended`-preset finding
- **THEN** the command exits nonzero and reports the finding with its file location

#### Scenario: Clean tree passes
- **WHEN** `npm run lint` runs on the repository after this change lands
- **THEN** the command exits zero with no findings

#### Scenario: Test-only relaxations stay scoped
- **WHEN** a lint rule is relaxed for tests
- **THEN** the override applies only to test files, and corresponding `src/` files remain fully checked under the preset

### Requirement: CI runs the repository gate on pull requests and pushes
The repository SHALL contain a CI workflow that runs on every pull request and on pushes to the default branch, installs dependencies with `npm ci`, and runs `npm run check` on a Node.js matrix that includes the minimum supported version (`22.19`), the current LTS line (`24`), and `latest`.

#### Scenario: Gate runs on contribution
- **WHEN** a pull request is opened or a push lands on the default branch
- **THEN** the workflow runs `npm ci` followed by `npm run check` on every matrix entry and reports the results on the run

#### Scenario: Matrix failure fails the run
- **WHEN** `npm run check` fails on any matrix entry
- **THEN** the workflow run is marked failed

### Requirement: Weekly canary detects upstream Pi breakage
The CI workflow SHALL include a weekly scheduled canary job that installs the latest published `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` over a fresh `npm ci` and runs the repository check suite against them, and SHALL allow the same job to be dispatched manually.

#### Scenario: Scheduled canary run
- **WHEN** the weekly schedule triggers
- **THEN** a fresh install is upgraded to the latest `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`, `npm run check` runs against them, and a failure marks the run failed

#### Scenario: Manual canary run
- **WHEN** a maintainer dispatches the canary manually
- **THEN** the same upgrade-and-check job runs on demand
