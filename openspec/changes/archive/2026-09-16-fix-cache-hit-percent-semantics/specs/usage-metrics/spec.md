## Purpose

Defines how pi-atelier aggregates session usage into the totals and cache-hit percentages the footer and sidebar render, so each displayed rate has deliberate, stable semantics.

## ADDED Requirements

### Requirement: Cumulative session usage totals
The system SHALL aggregate usage across all usage-bearing messages in the session into cumulative input, output, cache-read, and cache-write token totals plus cost, and SHALL skip messages whose usage is absent or malformed without failing the aggregation.

#### Scenario: Totals accumulate across messages
- **WHEN** the session contains multiple messages with valid usage
- **THEN** the reported input, output, cache-read, cache-write, and cost values are the sums across those messages

#### Scenario: Malformed usage is skipped, not fatal
- **WHEN** a message has absent or malformed usage data
- **THEN** that message contributes nothing to the totals and the aggregation completes without throwing

### Requirement: Session cache-hit percentage is aggregated
The system SHALL compute the session cache-hit percentage from session-wide totals — cache-read tokens divided by the sum of input, cache-read, and cache-write tokens — and SHALL NOT derive it from any single message's own rate.

#### Scenario: Aggregate differs from the latest message
- **WHEN** messages in the session have different individual cache-hit rates
- **THEN** the reported session cache-hit percentage reflects the session-wide token totals rather than the last message's rate

#### Scenario: Empty-prompt latest message cannot blank the session rate
- **WHEN** the most recent usage-bearing message has an empty prompt while earlier messages have non-zero token totals
- **THEN** the session cache-hit percentage is still reported from the session totals

#### Scenario: No computable session rate
- **WHEN** no usage-bearing message in the session has a non-empty prompt
- **THEN** the session cache-hit percentage is omitted and consumers render it as unavailable

### Requirement: Latest-request cache-hit percentage with stable fallback
The system SHALL expose a latest-request cache-hit percentage equal to the cache-read share of the prompt of the most recent usage-bearing message that has a non-empty prompt. It SHALL be omitted only when no such message exists in the session.

#### Scenario: Latest message has a non-empty prompt
- **WHEN** the most recent usage-bearing message has a non-empty prompt
- **THEN** the latest-request cache-hit percentage equals that message's own cache-read share of its prompt tokens

#### Scenario: Stable fallback on empty-prompt tail
- **WHEN** the most recent usage-bearing message has an empty prompt and an earlier message had a computable rate
- **THEN** the latest-request cache-hit percentage equals the most recent earlier computable rate and does not become unavailable

#### Scenario: No computable latest rate
- **WHEN** no message in the session has a non-empty prompt
- **THEN** the latest-request cache-hit percentage is omitted

### Requirement: Cache-hit display mapping
The footer's cache headline SHALL display the session cache-hit percentage, the footer's hit detail SHALL display the latest-request cache-hit percentage, and the sidebar usage panel's hit value SHALL display the session cache-hit percentage. Each slot SHALL render its unavailable marker when its underlying value is omitted or non-finite.

#### Scenario: Distinct rates are visible simultaneously
- **WHEN** the session aggregate and the latest-request cache-hit rates differ
- **THEN** the footer shows the session aggregate in its cache headline and the latest-request rate in its hit detail

#### Scenario: Unavailable rates render placeholders
- **WHEN** a cache-hit percentage rendered by a display slot is omitted or non-finite
- **THEN** that slot renders its unavailable marker instead of a numeric value
