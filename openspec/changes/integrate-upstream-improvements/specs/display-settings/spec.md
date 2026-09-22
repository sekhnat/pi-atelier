# Spec Delta

## Purpose

Defines the single-level Undo contract shared by live Display mutations and draft Sidebar layout edits in Atelier settings.

## ADDED Requirements

### Requirement: Undo targets only the most recent settings mutation
The Display Settings workspace SHALL keep one typed undo record representing either the most recent Display mutation or the most recent Sidebar draft mutation. Activating Undo SHALL restore that record once, clear it, and SHALL NOT fall through to an older mutation from the other domain.

#### Scenario: Sidebar edit follows a Display edit
- **WHEN** the user changes Display settings and then changes the Sidebar draft
- **THEN** Undo restores only the Sidebar draft change and a second Undo reports that nothing remains to undo

#### Scenario: Display edit follows a Sidebar edit
- **WHEN** the user changes the Sidebar draft and then changes Display settings
- **THEN** Undo restores only the Display session override and does not restore the older Sidebar draft state

#### Scenario: Display Revert follows a Sidebar edit
- **WHEN** the user edits the Sidebar draft and then activates Display Revert
- **THEN** Undo restores the Display session override captured by Revert and does not apply the older Sidebar undo record

#### Scenario: No undo record
- **WHEN** the user activates Undo before a mutation or after the single record was consumed
- **THEN** the workspace reports that there is nothing to undo and leaves Display and Sidebar state unchanged

### Requirement: Save handling preserves valid undo state
A successful save SHALL clear an outstanding Sidebar undo record only when the saved Sidebar draft is the mutation that record describes. A failed save SHALL preserve the current undo record and draft/session state.

#### Scenario: Successfully save a Sidebar draft
- **WHEN** the newest mutation is a Sidebar draft edit and saving the user default succeeds
- **THEN** the draft becomes clean and the Sidebar undo record is cleared

#### Scenario: Successfully save with a Display undo record
- **WHEN** the current undo record describes a Display mutation and a Sidebar draft is also saved
- **THEN** the Display undo record remains available because the Sidebar save did not replace it

#### Scenario: Save fails
- **WHEN** persisting Display or Sidebar defaults fails
- **THEN** the workspace reports the failure and preserves the pending one-step Undo target

#### Scenario: Newly discovered contributed panel
- **WHEN** a contributed panel is inserted into the effective Sidebar draft before or after an edit
- **THEN** Undo preserves valid panel identity, effective default visibility, and unavailable configured entries while restoring the recorded draft mutation
