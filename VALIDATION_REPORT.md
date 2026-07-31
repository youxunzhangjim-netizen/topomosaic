# TopoMosaic V1 Validation Report

**Validation date:** 2026-07-26  
**Release:** 0.1.0

## Result summary

| Gate | Result |
|---|---|
| Core unit tests | **PASS — 5/5** |
| Bundled puzzle validation | **PASS — 14/14** |
| Static import, DOM, and service-worker path checks | **PASS** |
| Standalone HTTP smoke test | **PASS** |
| Desktop 2D / 2D+Time UI interaction test | **PASS** |
| Mobile layout and clue-drawer interaction test | **PASS** |
| Topoboard integration idempotence test | **PASS** |
| Three.js WebGL end-to-end rendering in this container | **Not executed; see limitation below** |

## Core unit tests

Command:

```bash
npm test
```

Verified:

1. ordered colored-run encoding;
2. different-color touching and same-color separation;
3. three-track membership for hexagonal and triangular 2D cells;
4. finite FCC, BCC, and HCP cell/track generation;
5. expected SC, FCC, BCC, and HCP Voronoi vertex counts.

Result: **5 passed, 0 failed**.

## Puzzle catalog validation

Command:

```bash
npm run validate
```

Every puzzle below produced exactly one checked solution, matched the authored answer, and was fully forced by constraint propagation from its authored givens without a search branch.

| Puzzle | Variables | Tracks | Givens | Forced initially | Unique | Match |
|---|---:|---:|---:|---:|---|---|
| square-sunflower | 81 | 18 | 4 | 77 | Yes | Yes |
| square-time-flower | 405 | 171 | 12 | 393 | Yes | Yes |
| hex-bloom | 37 | 21 | 2 | 35 | Yes | Yes |
| hex-time-bloom | 148 | 121 | 5 | 143 | Yes | Yes |
| triangle-sailboat | 50 | 20 | 3 | 47 | Yes | Yes |
| triangle-time-sail | 200 | 130 | 8 | 192 | Yes | Yes |
| sc-fruit-tree | 64 | 48 | 3 | 61 | Yes | Yes |
| sc-time-tree | 256 | 256 | 7 | 249 | Yes | Yes |
| fcc-alloy | 63 | 138 | 3 | 60 | Yes | Yes |
| fcc-time-nucleation | 252 | 615 | 6 | 246 | Yes | Yes |
| bcc-defect | 35 | 115 | 2 | 33 | Yes | Yes |
| bcc-time-pulse | 140 | 495 | 5 | 135 | Yes | Yes |
| hcp-stacking | 36 | 62 | 4 | 32 | Yes | Yes |
| hcp-time-growth | 144 | 284 | 5 | 139 | Yes | Yes |

The validator limits enumeration to two solutions because only existence and uniqueness are needed. None of the samples reached the search limit.

## Static application checks

Command:

```bash
node scripts/check-static.mjs
```

Result:

```text
Checked 16 app files, 65 DOM references, and 16 cache paths.
```

The check verifies local JavaScript imports, referenced DOM IDs, and service-worker cache entries.

## HTTP smoke test

The no-build server was started at `127.0.0.1:4173`. The test fetched and inspected:

- `/`;
- a query-parameter route for `dimension=3&time=1&lattice=fcc`;
- `/app.js`;
- `/render/board3d.js`.

Result: **PASS**.

## UI interaction checks

A browser test harness loaded the local HTML, CSS, and ES modules into Chromium without navigating to a blocked local URL.

Desktop checks:

- application initialization with no console or page errors;
- 2D+Time square puzzle load;
- switch to hexagonal cells;
- timeline visibility;
- colored track-cell edit and undo;
- desktop responsive layout.

Mobile checks at 390×844 CSS pixels:

- mobile toolbar displayed;
- clue drawer opened;
- track-strip cell edited inside the drawer;
- document width remained exactly 390 CSS pixels;
- no element overflowed the viewport.

The UI checks found and fixed two pre-release CSS issues: hidden slice controls being overridden by author styles and a partially visible inactive toast. Preview captures are stored in `docs/preview-desktop.png` and `docs/preview-mobile.png`.

## Integration test

The integration script was run twice against a compatible synthetic Topoboard checkout.

Verified after the second run:

- exactly four launcher links;
- exactly one `mosaic/` build-copy instruction;
- English and Traditional Chinese entries each present once;
- `mosaic/index.html` copied successfully.

Result: **PASS; script is idempotent for the tested launcher/build structure**.

## Environment limitation

This container applies an administrator navigation policy that blocks Chromium from opening localhost, file URLs, and intercepted test origins. The 2D interface was still tested through an in-memory module harness, but the real Three.js WebGL module could not be fetched or opened end-to-end here. The 3D source passed static checks, lattice/Voronoi tests, and HTTP delivery checks. A final manual WebGL smoke test should therefore be run after the module is placed in the actual Topoboard checkout or deployed environment.
