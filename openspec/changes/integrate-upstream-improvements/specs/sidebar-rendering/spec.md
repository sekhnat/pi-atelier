# Spec Delta

## Purpose

Defines deterministic Sidebar height fitting that preserves visible content while avoiding repeated rendering of discarded candidates.

## ADDED Requirements

### Requirement: Sidebar height fitting preserves composition semantics
The system SHALL fit Sidebar groups to the available height using each group's content rows and the chrome required by contiguous panels. Groups belonging to the same adjacent panel SHALL share one header, bottom border, and inter-panel spacer. If content exceeds the height, optional groups SHALL be removed in existing drop-priority order while required groups remain.

#### Scenario: All groups fit
- **WHEN** the Sidebar height can contain every non-empty group and its panel chrome
- **THEN** all groups render in configured panel order with the same headers, borders, spacing, and row content as before the optimization

#### Scenario: Optional groups must be dropped
- **WHEN** the Sidebar height cannot contain every group
- **THEN** the lowest-priority optional group is removed until the retained composition fits or only required groups remain

#### Scenario: Removal joins adjacent groups
- **WHEN** dropping a group makes two retained groups from the same panel adjacent
- **THEN** the fit calculation counts one shared set of panel chrome for those adjacent groups

#### Scenario: Required content exceeds height
- **WHEN** required groups and their chrome exceed the available height
- **THEN** required groups remain selected and the existing bounded dock rendering determines the visible rows

### Requirement: Discarded candidate sets are not painted
For each Sidebar frame, the system SHALL determine the retained group set before performing the final themed panel rendering. It SHALL NOT repeatedly paint intermediate candidate sets solely to measure their height.

#### Scenario: Several groups are dropped
- **WHEN** fitting a short Sidebar requires multiple optional groups to be removed
- **THEN** the renderer performs the themed panel-rendering pass only for the final retained set

#### Scenario: Dynamic and contributed panels
- **WHEN** live activity rows or contributed panels change the candidate groups between frames
- **THEN** each frame independently preserves current order, visibility, defaults, sanitization, and drop priorities while using the non-painting fit calculation
