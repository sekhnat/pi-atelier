# Spec Delta

## Purpose

Defines how Atelier coexists with terminal graphics and selection while offering an optional, compatibility-safe composer session ribbon.

## ADDED Requirements

### Requirement: Inline transcript images coexist with Atelier surfaces
When the active Pi renderer supports inline graphics, the system SHALL keep visible transcript images and the Sidebar from obscuring one another in regular and fullscreen TUI modes. The system SHALL preserve the image's original terminal placement and reserved layout space.

#### Scenario: Image beside a visible Sidebar
- **WHEN** a transcript row contains a supported Kitty or iTerm2 inline image and the Sidebar is visible
- **THEN** the rendered frame contains the image at its original transcript position and the Sidebar content in its reserved columns

#### Scenario: Capturing overlay covers an image
- **WHEN** a capturing settings or menu overlay is visible over rows occupied by a transcript image
- **THEN** the image is temporarily suppressed without removing its transcript data or reserved layout space

#### Scenario: Capturing overlay closes
- **WHEN** the last capturing overlay closes after an image was suppressed
- **THEN** the image is restored by the next render at its original placement

#### Scenario: Unsupported compositor seam
- **WHEN** the current Pi renderer does not expose the supported image-compositing seam
- **THEN** Atelier continues to operate without failing startup or mutating global terminal behavior

### Requirement: Fullscreen selection excludes Sidebar text
In fullscreen mode, the system SHALL exclude visible Sidebar columns from screen selection highlighting and copied output when a drag begins outside the transcript ScrollView. It SHALL preserve Pi's transcript selection, scrolling, and capturing-overlay selection behavior.

#### Scenario: Drag begins in the editor
- **WHEN** a fullscreen mouse selection begins in the editor and extends across the Sidebar
- **THEN** the highlighted and copied range ends at the main-pane boundary and contains no Sidebar text

#### Scenario: Drag begins in the Sidebar
- **WHEN** a fullscreen mouse selection begins in the Sidebar while no capturing overlay is visible
- **THEN** no Sidebar text is included in the copied screen-selection range

#### Scenario: Transcript selection remains native
- **WHEN** a fullscreen selection begins inside the transcript ScrollView
- **THEN** Pi's native transcript-scoped selection and scrolling behavior is unchanged

#### Scenario: Capturing overlay selection remains native
- **WHEN** a capturing overlay is visible during fullscreen selection
- **THEN** Pi's native overlay selection behavior is not clamped to the main-pane boundary

#### Scenario: Regular mode remains terminal-native
- **WHEN** the TUI runs in regular mode
- **THEN** Atelier does not alter the terminal's rectangular selection behavior

### Requirement: Session ribbon is an explicit user opt-in
The system SHALL expose `showSessionRibbon` as a boolean user preference that defaults to `false`. Only the user configuration layer SHALL be allowed to enable it; project and session configuration values SHALL be validated but SHALL NOT override the user value.

#### Scenario: Default configuration
- **WHEN** the user has not configured `showSessionRibbon`
- **THEN** the existing composer frame and complete Status Rail render without the session ribbon and no Nerd Font is required

#### Scenario: User enables the ribbon
- **WHEN** the user enables `showSessionRibbon` through Atelier settings or user configuration
- **THEN** the preference is persisted for the user and the current TUI updates to ribbon mode

#### Scenario: Project attempts to force the ribbon
- **WHEN** trusted project or session configuration sets `showSessionRibbon` to a value different from the user preference
- **THEN** the user preference remains authoritative

#### Scenario: Malformed ribbon preference
- **WHEN** any read configuration layer provides a non-boolean `showSessionRibbon` value
- **THEN** the system reports one actionable validation warning and retains the applicable default or user value

### Requirement: Enabled session ribbon preserves status information and fallbacks
When `showSessionRibbon` is enabled, the system SHALL render a prompt-style status strip in the composer's top border using Nerd Font prompt icons, with activity, model/thinking, workspace/Git, and context information selected according to the existing display configuration. Measured usage and response telemetry SHALL remain in a compact row below the composer. The system SHALL render the complete Status Rail instead whenever the ribbon cannot be rendered safely.

#### Scenario: Ribbon-capable layout
- **WHEN** the custom editor is installed, the terminal has at least 12 rows, and the status strip fits the available editor width
- **THEN** the composer shows one session ribbon and the footer shows the compact measured-telemetry row without duplicating the complete Status Rail

#### Scenario: Editor is unavailable or temporarily replaced
- **WHEN** Atelier cannot install its custom editor or Pi temporarily replaces that editor with a selector
- **THEN** the complete Status Rail remains available below the composer

#### Scenario: Terminal is short or editor is narrow
- **WHEN** the terminal has fewer than 12 rows or the ribbon cannot fit the available editor width
- **THEN** the composer retains its normal framed border and the complete Status Rail renders below it

#### Scenario: Display visibility still applies
- **WHEN** ribbon mode is active and the user changes preset, ordering, or visibility for an existing Status Rail segment
- **THEN** the corresponding ribbon or telemetry content follows that effective display configuration while required metrics and context information retain their existing guarantees

#### Scenario: Unsupported Nerd Font glyphs
- **WHEN** ribbon mode is enabled in a terminal whose selected font lacks the documented Nerd Font glyphs
- **THEN** Atelier does not install fonts or change terminal settings and continues rendering the configured ribbon without crashing
