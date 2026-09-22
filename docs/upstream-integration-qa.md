# Upstream integration: smoke probes and remaining manual checks

## Scope

Task 5.4 of `integrate-upstream-improvements`. This environment has no
interactive terminal, so pixel-level visual confirmation in a real terminal
remains a maintainer checklist (below). What was verified here: in-process
probes against Pi's **actual** `TuiMainScreen` and `TuiAltScreen` renderers
with the real `src/image-compositor.ts`, `src/editor.ts`, and the
split-pane/selection adapter behavior.

Run the probes:

```bash
node scripts/smoke-compositor.mjs
```

## Probe results (all passing)

- **Regular mode, Kitty multipart image beside a frame**: the multipart
  graphics command survives text compositing byte-for-byte, is redrawn at its
  original column (`ESC[5G`), and the sidebar client's cells are composited
  into the image row before text composition.
- **Adapter restoration**: releasing the compositor restores the concrete
  renderer's own `compositeOverlays`.
- **Fullscreen capturing overlay**: a visible capturing overlay suppresses the
  Kitty image (no graphics bytes in the composed frame); closing the overlay
  restores the image on the next composite. Reserved rows stay in the
  compositor's text; Pi's base compositing may pad the frame to the overlay's
  height, which is normal frame geometry.
- **iTerm2 images**: suppressed under a capturing overlay without a deletion
  sequence (Pi erases the dirty cells).
- **Fullscreen screen selection**: the selection adapter clamps the screen
  selection's end column to the main pane (`end=56` for a 100-column terminal
  with a 44-column sidebar); transcript ScrollView selection is unaffected.
- **Editor top-rule handshake**: with fewer than 12 terminal rows the status
  callback returns empty and `statusLineVisible` is false (the complete footer
  renders); with a tall terminal the status is inset into the top rule and
  `statusLineVisible` is true.

## Default configuration remains visually unchanged

The plain Status Rail path is byte-identical to the pre-change implementation:
`renderFooterLine`'s signature and output are unchanged, no ribbon glyph
appears outside the ribbon surfaces, and `showSessionRibbon` defaults to
`false` with user-only resolution (project/session values are validated but
never applied). All footer, sidebar, editor, extension, and menu snapshot and
content tests pass without modification to their expectations.

## Maintainer checklist (interactive terminal required)

Run from the repository root:

```bash
pi --no-session --no-extensions -e "$PWD/extensions/index.ts" --tui-mode regular
```

Repeat with `--tui-mode fullscreen` in a Kitty-capable terminal, and in iTerm2.

- [ ] Enable the Sidebar (`/atelier sidebar on`), resize it (`Ctrl+Shift+R`, arrows, Escape/Enter), and confirm the rail stays readable at both width extremes.
- [ ] Ask Pi to read a tall portrait image and a wide image; confirm images stay inside the transcript pane and adjacent Sidebar rows/borders remain visible (regular and fullscreen).
- [ ] With an image visible, open `/atelier` and `/atelier display`; confirm the whole dialog is readable, images hide without collapsing their reserved rows, and images return at their original positions on close.
- [ ] In fullscreen, drag a selection from the editor across the sidebar: highlighting and copied text must stop at the main-pane boundary. Drag inside the transcript to confirm Pi's native transcript selection still works.
- [ ] `/atelier disable` hides the UI and stops updates; `/atelier enable` reconciles once and keeps the Sidebar hidden until shown.
- [ ] Enable the ribbon via **Settings** (Nerd Font terminal required): confirm the top-rule strip and telemetry row render, that shrinking the terminal or invoking a selector falls back to the complete Status Rail, and that turning the ribbon off restores the default presentation.
- [ ] `/reload` and `/new`: confirm exactly one Sidebar and one composer chrome, with no stale image or dialog placement.
