# TopoMosaic V1 QA Checklist

## Automated

- [ ] `npm test` passes.
- [ ] `npm run validate` reports PASS for every puzzle.
- [ ] Every local JavaScript file passes `node --check`.
- [ ] Every relative import resolves to an existing file.
- [ ] Service-worker cache entries exist.
- [ ] Integration script is idempotent.

## 2D interaction

- [ ] Square, hexagonal, and triangular hit-testing selects the intended cell.
- [ ] Active track is visibly highlighted.
- [ ] Pan/zoom does not paint cells in Move mode.
- [ ] Right click marks empty without opening the context menu.
- [ ] Track-strip buttons provide a non-drag alternative.
- [ ] Onion skin never uses hidden solution data.

## Time

- [ ] Timeline changes the current spatial frame.
- [ ] Time clue follows the selected cell.
- [ ] Temporal track strip switches frames and edits the correct variable.
- [ ] Playback does not overwrite player state.
- [ ] Undo restores both value and selected frame/cell context.

## 3D interaction

- [ ] Model view restores the complete object in one action.
- [ ] Slice families expose all cells at least once.
- [ ] Track view shows exactly the selected clue cells.
- [ ] Filled, unknown, empty, given, active-track, and selected states are visually distinguishable.
- [ ] Empty selected cells retain a visible outline.
- [ ] Camera gestures and edit gestures are not conflated.
- [ ] FCC cells appear as shrink-gapped rhombic dodecahedra.
- [ ] BCC cells appear as shrink-gapped truncated octahedra.
- [ ] HCP A/B cells have the intended alternating geometry/orientation.
- [ ] A failed Three.js load leaves track-strip solving functional.

## Accessibility

- [ ] All primary controls have at least a 44-pixel designed target.
- [ ] Visible keyboard focus is never clipped.
- [ ] Every clue includes a letter/pattern in addition to color.
- [ ] Every track cell is a keyboard-operable button.
- [ ] Dialogs can be closed with Escape.
- [ ] Status and errors are announced through an ARIA live region.
- [ ] Reduced-motion preference disables nonessential transitions.
- [ ] English and Traditional Chinese labels update consistently.

## Persistence and deployment

- [ ] Refresh restores state and frame.
- [ ] Reset clears saved progress.
- [ ] The four launcher routes open the intended mode.
- [ ] `mosaic/` is copied into the selected Topoboard edition output.
- [ ] GitHub Pages base paths retain relative module URLs.
- [ ] PWA install starts at the 2D + Time tutorial.
