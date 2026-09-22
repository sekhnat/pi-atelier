# Pi Atelier

A responsive status rail and activity sidebar for [Pi](https://pi.dev).

[![Pi Atelier demo](https://raw.githubusercontent.com/michaelmjhhhh/pi-atelier/main/docs/demo.png?v=0.10.0)](https://github.com/michaelmjhhhh/pi-atelier/releases/download/v0.10.0/demo.mp4)

[Watch the demo](https://github.com/michaelmjhhhh/pi-atelier/releases/download/v0.10.0/demo.mp4)

## Features

- Responsive one-line status rail
- Live agent, tool, context, workspace, usage, and TODO information, kept compact while a Turn is running
- Model, thinking-level, and tool controls
- Configurable display presets, segments, and sidebar panels
- Session details, rename, and compaction actions
- Completion notifications on macOS and Windows
- Opt-in session ribbon for the composer with Nerd Font prompt icons and compact telemetry (off by default)
- No telemetry or external network requests

## Requirements

- Pi 0.84.0 or newer
- Node.js 22.19.0 or newer
- Interactive TUI mode


Optional: a [Nerd Font](https://www.nerdfonts.com) selected in your terminal, only if you enable the session ribbon (see [Session ribbon](#session-ribbon)).

## Install

```bash
pi install npm:pi-atelier
```

Run a local checkout without installing it:

```bash
pi -e ./pi-atelier
```

Pi packages run with your system permissions. Review third-party source before installation.

## Use

Open the control center:

```text
/atelier
```

Default shortcut: `alt+a`

The control center includes display settings, sidebar controls, model and tool selection, session details, rename, and compaction.

Commands:

```text
/atelier display            # display settings
/atelier sidebar            # toggle sidebar
/atelier sidebar on|off     # set sidebar visibility
/atelier sidebar tools      # toggle tool names
/atelier enable|disable     # set extension state
```


`/atelier disable` hides Atelier's UI and suspends its background work: sidebar and footer renders, usage-history scans, TODO reconstruction, streaming token estimates, Workspace Pulse Git inspection, and completion notifications. Pending workspace work is cancelled and nothing disabled-period is published. `/atelier enable` reconciles once from current session state; the sidebar stays hidden until you show it again.

The sidebar starts visible and hides when the terminal is too narrow. Press `Ctrl+Shift+R` to resize it.

In Pi fullscreen TUI mode, the sidebar is rendered as a separate split-layout child so transcript selection and copy stay scoped to Pi output; when a mouse selection starts outside the transcript — in the editor or the sidebar — the highlighted and copied range stops at the main-pane boundary. Capturing overlays keep Pi's native selection behavior. Regular TUI mode remains terminal-native, so a rectangular terminal selection can still include sidebar text.


The TODO panel supports Pi `todo` results and the optional `@juicesharp/rpiv-todo` extension.

## Extension contributions

Other extensions can publish structured panels through Pi's event bus on the `pi-atelier:sidebar-panels` channel. Panels are namespaced (`vendor:id`), sanitized (ANSI and control characters are stripped, titles and rows are bounded), and theme-aware via semantic row roles.

Discovery events advertise host capabilities; a defaults-capable host advertises `panel-defaults-v1`. A contribution with `defaults: { "visible": true, "after": "usage" }` appears beside the built-in panels immediately after the Usage panel the first time it registers — no manual Settings step and no configuration rewrite. Explicit entries in Settings always override a contribution's defaults.

Status rail presets:

- **editorial**: default layout
- **minimal**: compact layout
- **classic**: detailed telemetry

The composer uses a rounded frame with inner padding. Thinking-level and bash-mode still color that frame through Pi.

Pi supports one custom footer and one custom editor at a time. Extension load order determines which chrome is visible.

## Session ribbon

The session ribbon is an optional replacement for the composer's status presentation, disabled by default. When enabled through **Settings** or user configuration, the composer's top border holds activity, model/thinking, workspace and Git (controlled by the Git segment), and context percentage/capacity in one continuous strip with Nerd Font prompt icons, and a quieter row below shows measured token usage, cache, cost, and response timing. Display presets, visibility, and ordering still apply within each row.

The complete plain Status Rail renders instead whenever the ribbon cannot: the composer editor is unavailable or replaced by a Pi selector, the terminal is below 12 rows, the editor is too narrow, or the editor installation fails. Turning the preference off restores the plain rail on the next render.

### Terminal font

The session ribbon's icons require a [Nerd Font](https://www.nerdfonts.com/font-downloads) selected in your terminal — for example JetBrainsMono Nerd Font Mono or FiraCode Nerd Font Mono. Install the font, then select it in your terminal's font settings; installing it alone does not select it.

Atelier does not bundle or install fonts or change terminal settings. There is no plain-text icon fallback; unsupported glyphs may appear as boxes or missing symbols. The default configuration never requires a Nerd Font.


## Configuration

User configuration:

```text
~/.pi/agent/pi-atelier.json
```

Trusted project configuration:

```text
<project>/.pi/pi-atelier.json
```

Project settings override user settings. Session changes override both. Global sidebar and notification preferences remain user-only, as does the session ribbon: project and session values are validated but never enable or disable it.

```json
{
  "preset": "editorial",
  "shortcut": "alt+a",
  "density": "comfortable",
  "contextWarning": 70,
  "contextDanger": 90,
  "showSidebarOnStartup": true,
  "showSidebarToolNames": false,
  "completionNotifications": true,
  "showSessionRibbon": false
}
```

Use **Settings → Display** to reorder or hide status rail segments and sidebar panels. Undo restores the latest Display or Sidebar edit, including a Display Revert.

## Privacy

Pi Atelier:

- Does not collect telemetry or analytics
- Does not store prompts, responses, credentials, or session content
- Uses read-only Git inspection for workspace status only after the project is trusted
- Does not read untracked file contents
- Reads project configuration only for trusted projects
- Does not include prompts or responses in notifications

## Troubleshooting

- Shortcut unavailable: use `/atelier`, change `shortcut`, then run `/reload`.
- Status rail missing: use TUI mode and check for another custom footer.
- Metric mismatch: token and cost totals cover the session; context usage covers the current model context.

## Development

```bash
git clone https://github.com/michaelmjhhhh/pi-atelier.git
cd pi-atelier
npm install
npm run check
npx --no-install pi -e .
```

See [CONTRIBUTING.md](https://github.com/michaelmjhhhh/pi-atelier/blob/main/CONTRIBUTING.md).

## License

MIT
