## Purpose

Defines reliable clock semantics for Pi Atelier's runtime response, agent-run, and tool elapsed metrics so durations remain precise and immune to wall-clock adjustments.

## ADDED Requirements

### Requirement: Runtime elapsed intervals use a monotonic clock
The system SHALL derive response TTFT and TPS windows, agent-run durations, and tool durations from a monotonic high-resolution clock. Changes to the system wall clock MUST NOT change an in-progress or completed elapsed interval.

#### Scenario: Wall clock changes during a response
- **WHEN** the wall clock moves forward or backward after a provider request starts while the monotonic clock advances normally
- **THEN** TTFT and TPS elapsed windows reflect only the monotonic time that passed

#### Scenario: Wall clock changes during a run or tool execution
- **WHEN** the wall clock changes while an agent run or tool execution is active
- **THEN** its live and completed duration reflects only monotonic elapsed time

### Requirement: All samples in an elapsed interval share one clock domain
The system SHALL compare start, live-current, and end samples only when they originate from the same monotonic clock domain.

#### Scenario: Live duration becomes completed duration
- **WHEN** an active run or tool transitions to a completed state
- **THEN** the displayed live duration and stored completed duration use compatible samples and do not jump because of a clock-domain change

#### Scenario: Concurrent active tools are ordered
- **WHEN** multiple tools start during one run
- **THEN** their ordering and live durations are derived from mutually comparable monotonic samples

### Requirement: Elapsed calculations retain fractional-millisecond precision
The system SHALL retain finite fractional-millisecond clock values through elapsed-time calculations and SHALL defer display rounding to the existing formatter. If an end sample precedes its start sample, the resulting elapsed duration SHALL be clamped to zero.

#### Scenario: Sub-millisecond response timing
- **WHEN** the first output or response completion occurs at a fractional-millisecond monotonic offset
- **THEN** TTFT and TPS calculations use the fractional value rather than truncating it to an integer millisecond

#### Scenario: End sample precedes start sample
- **WHEN** an explicitly supplied deterministic end sample is lower than its corresponding start sample
- **THEN** the calculated elapsed duration is zero rather than negative

### Requirement: Existing performance semantics remain compatible
Changing the elapsed-time clock SHALL NOT change the event boundaries, token numerators, response scope, reset behavior, estimated/final distinction, or user-facing formatting of existing TTFT, TPS, run-duration, and tool-duration metrics.

#### Scenario: Response performance is finalized
- **WHEN** an assistant response receives output-bearing updates and then ends with valid output usage
- **THEN** TTFT remains provider-dispatch-to-first-output time and final TPS remains final output tokens divided by first-output-to-response-end time

#### Scenario: Live TPS is estimated
- **WHEN** a response has received enough output-bearing updates for a live TPS value
- **THEN** the value remains marked as estimated until valid final usage replaces it

#### Scenario: A new provider request begins
- **WHEN** a provider request starts after a prior response completed
- **THEN** the prior response's TTFT and TPS are cleared according to the existing lifecycle behavior
