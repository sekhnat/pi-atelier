## Purpose

Defines the overlay-integration contract between the extension's fullscreen sidebar adapter and the Pi TUI overlay system: the overlay handle surface the adapter must satisfy for every supported Pi version, including the `getBounds` member introduced in Pi 0.85.

## ADDED Requirements

### Requirement: Overlay handle satisfies the installed Pi contract
The fullscreen sidebar's returned overlay handle SHALL provide the full overlay-handle surface required by the installed Pi version — including `getBounds()` on Pi releases that require it — by delegating to the wrapped base handle; the delegation SHALL return `undefined` when the wrapped handle predates `getBounds`.

#### Scenario: Gate typechecks against the newest Pi contract
- **WHEN** the repository gate runs with dependencies that require `getBounds` on overlay handles
- **THEN** typechecking passes without handle-surface errors

#### Scenario: Bounds delegate to the wrapped handle
- **WHEN** the wrapped base handle implements `getBounds` and returns rendered bounds
- **THEN** the adapter handle's `getBounds()` returns those same bounds

#### Scenario: Older Pi handles yield undefined without throwing
- **WHEN** the wrapped base handle has no `getBounds` (Pi 0.84)
- **THEN** the adapter handle's `getBounds()` returns `undefined` and does not throw

### Requirement: Supported Pi floor is unchanged
The change SHALL NOT narrow the supported Pi range: the Pi peer range SHALL continue to accept 0.84.0, and overlay behavior on Pi 0.84 SHALL be preserved.

#### Scenario: Floor stays open to Pi 0.84
- **WHEN** a consumer resolves Pi 0.84.0 against the extension's Pi peer range after this change
- **THEN** the range still accepts it, and the full repository gate passes against the declared dependency target
