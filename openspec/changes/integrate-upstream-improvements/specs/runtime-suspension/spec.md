# Spec Delta

## Purpose

Defines the work Atelier suspends while disabled and the single reconciliation performed when the user enables it again.

## ADDED Requirements

### Requirement: Disable suspends expensive and visible work
After `/atelier disable`, the system SHALL hide Atelier UI and suspend footer/sidebar renders, usage-history scans, TODO reconstruction, streaming token estimates, Workspace Pulse scheduling, and completion notifications. It SHALL cancel pending workspace timers and abort in-flight Git inspection so retired results cannot publish.

#### Scenario: Disable during idle operation
- **WHEN** the user runs `/atelier disable`
- **THEN** the footer and Sidebar are hidden and subsequent session, model, thinking, TODO, and workspace events do not trigger suspended producers or renders

#### Scenario: Disable during Git inspection
- **WHEN** the user disables Atelier while a Workspace Pulse inspection is pending or in flight
- **THEN** the pending work is cancelled or aborted and its eventual result does not update runtime state

#### Scenario: Disable during a response
- **WHEN** the user disables Atelier after provider dispatch but before response timing completes
- **THEN** the partial TTFT/TPS measurement is discarded and no partial response metric is later reported

#### Scenario: Notification event while disabled
- **WHEN** a turn settles or input becomes blocked while Atelier is disabled
- **THEN** no completion notification is emitted

### Requirement: Minimal bookkeeping continues without content retention
While disabled, the system SHALL retain only the small run/turn and tool completion bookkeeping needed to resume coherent activity state. It SHALL NOT retain tool arguments observed only during the disabled interval.

#### Scenario: Tool runs while disabled
- **WHEN** a tool starts and ends while Atelier is disabled
- **THEN** completion and failure counters remain coherent for later display but the disabled-period tool arguments are not retained

#### Scenario: Agent settles while disabled
- **WHEN** the agent settles while Atelier is disabled
- **THEN** the internal run state settles without requesting a render or notification

### Requirement: Enable reconciles once from authoritative session state
When `/atelier enable` transitions Atelier from disabled to enabled, the system SHALL reinstall the footer, reconstruct current-branch TODOs, refresh session usage, restart Workspace Pulse from a stale or inspecting state, and request one coherent reconciliation. It SHALL NOT automatically reopen a Sidebar hidden by disable, and a response spanning the disabled interval SHALL remain without TTFT/TPS until a later complete provider request.

#### Scenario: Re-enable after session changes
- **WHEN** session history, TODOs, model state, or workspace state changed while Atelier was disabled
- **THEN** enabling Atelier reconciles each displayed data source from current authoritative state rather than replaying every skipped event

#### Scenario: Re-enable after partial response
- **WHEN** a response began before disable and completed before or after re-enable
- **THEN** that response has no TTFT/TPS measurement and the next fully observed response can produce metrics normally

#### Scenario: Sidebar remains hidden
- **WHEN** Atelier is enabled after disable hid a previously visible Sidebar
- **THEN** the Status Rail returns but the Sidebar remains hidden until the user explicitly shows it

#### Scenario: Repeated enable or disable
- **WHEN** the user repeats the command for Atelier's current enabled state
- **THEN** no duplicate producers, footer installations, or reconciliation work are created
