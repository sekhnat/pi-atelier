# Spec Delta

## Purpose

Defines Workspace Pulse inspection results, cancellation safety, and the command-saving fast path for clean or untracked-only worktrees.

## ADDED Requirements

### Requirement: Clean and untracked-only inspections avoid tracked diff work
After repository discovery and porcelain status parsing, the system SHALL skip HEAD-tree resolution and numstat diff commands when the status contains no tracked-file, conflict, or changed-submodule records. It SHALL still report branch identity and count untracked files accurately, including in an unborn repository.

#### Scenario: Clean repository
- **WHEN** porcelain status reports a valid branch with no tracked or untracked records
- **THEN** Workspace Pulse reports a clean snapshot after discovery and status without issuing HEAD-tree or diff commands

#### Scenario: Untracked-only repository
- **WHEN** porcelain status reports no tracked changes and one or more untracked files
- **THEN** Workspace Pulse reports the untracked count and zero tracked diff totals without issuing HEAD-tree or diff commands

#### Scenario: Unborn repository without tracked files
- **WHEN** porcelain status reports an initial branch with no tracked changes
- **THEN** Workspace Pulse returns the clean or untracked-only snapshot without requiring an empty-tree diff

### Requirement: Tracked changes retain complete diff accounting
The system SHALL continue resolving an appropriate baseline and running numstat diff inspection whenever status contains a tracked change, conflict, or changed submodule. Existing tracked-file, text-line, binary-file, conflict, submodule, rename, and branch semantics SHALL remain unchanged.

#### Scenario: Tracked file changed
- **WHEN** porcelain status contains a tracked file record
- **THEN** Workspace Pulse resolves the baseline, runs the diff, and reports tracked and line totals from the result

#### Scenario: Conflict or changed submodule
- **WHEN** porcelain status contains a conflict or changed-submodule record
- **THEN** Workspace Pulse retains conflict and submodule accounting and does not take the clean fast path

#### Scenario: Cancellation during status
- **WHEN** an inspection is cancelled before or while status completes
- **THEN** the system does not publish a clean or changed result from that cancelled inspection

#### Scenario: Git command failure
- **WHEN** a required discovery, status, baseline, or diff command fails, times out, or is killed
- **THEN** Workspace Pulse reports unavailable or retains the last data as stale according to the existing runtime state rules
