## MODIFIED Requirements

### Requirement: Cache-hit display mapping
The footer's cache headline SHALL display the session cache-hit percentage, the footer's hit detail SHALL display the latest-request cache-hit percentage, and the sidebar usage panel SHALL display both rates: its hit value SHALL display the session cache-hit percentage, and the panel SHALL additionally display the latest-request cache-hit percentage as a distinct, separately labeled value. Each slot SHALL render its unavailable marker when its underlying value is omitted or non-finite.

#### Scenario: Distinct rates are visible simultaneously
- **WHEN** the session aggregate and the latest-request cache-hit rates differ
- **THEN** the footer shows the session aggregate in its cache headline and the latest-request rate in its hit detail

#### Scenario: Sidebar shows both rates together
- **WHEN** the sidebar usage panel renders while a session cache-hit percentage and a latest-request cache-hit percentage are both available
- **THEN** the panel renders both rates at the same time as distinct labeled values, with the aggregate as its hit value

#### Scenario: Unavailable rates render placeholders
- **WHEN** a cache-hit percentage rendered by a display slot is omitted or non-finite
- **THEN** that slot renders its unavailable marker instead of a numeric value
