# TopoMosaic V1 Product Specification

## 1. Product promise

A player reconstructs a meaningful picture, animation, object, material structure, or evolving 3D model by satisfying ordered colored-run constraints along every active spatial direction and, in +Time modes, along time.

The product must remain understandable as geometry becomes more complex. Dimensionality may increase the deduction space, but it must not turn visibility or camera control into the main puzzle.

## 2. V1 audience

- Casual nonogram players entering through square and hexagonal 2D puzzles.
- Puzzle enthusiasts interested in animation and volumetric logic.
- Students exploring lattice geometry and crystal structures.
- Topoboard users who expect the same rule to remain comparable across spaces.

## 3. Required modes

### 2D

The state is `S(cell)`. Spatial track families come from the chosen tiling.

### 2D + Time

The state is `S(cell, frame)`. Every frame contains all spatial tracks. Every cell owns one temporal track. The player sees one frame at a time plus a timeline and a temporal strip for the selected cell.

### 3D

The state is `S(cell)`. Cells are displayed as shrink-gapped Voronoi/Wigner–Seitz polycells. Model, Slice, and Track views share one selection and one game state.

### 3D + Time

The state is `S(cell, frame)`. The viewer displays one 3D frame while the selected cell's temporal strip exposes all frames. Previous-frame ghosting uses only player-entered information and never reveals the hidden solution.

## 4. Clue grammar

A clue chip contains color, a non-color identifier, and length. Example:

```text
[Y 2] [B 3] [Y 1]
```

Rules:

1. Runs occur in the displayed order.
2. Every run is contiguous along its ordered track.
3. Runs of the same color require one or more empty cells between them.
4. Runs of different colors may touch.
5. Cells not covered by a run are empty.
6. Color must never be the only carrier of clue meaning; chips also expose a letter/pattern.

## 5. Lattice adapters

A lattice adapter returns:

```ts
interface Lattice {
  kind: string;
  dimension: 2 | 3;
  cells: Cell[];
  tracks: Track[];
  sliceFamilies: SliceFamily[];
  metadata: object;
}
```

Each cell has a stable integer `index`, a lattice key/coordinate, a world position, and either a 2D polygon or a 3D basis identifier.

The solver receives only `Track.variables`, never geometric coordinates.

## 6. 3D visibility requirements

A valid 3D UI must always provide all of the following:

1. a complete model view;
2. a one-action Fit/Reset operation;
3. slice family and layer selection;
4. exact active-track isolation;
5. a flattened, keyboard-operable track strip;
6. visible selection even when an edited cell is empty;
7. separate camera and edit modes;
8. no requirement to rotate the camera merely to mark a logically known cell;
9. explicit frame controls in 3D + Time;
10. a graceful non-WebGL editing path through the track strip.

## 7. Semantic structures

A solution variable may contain `semanticPartId`. Semantic metadata is separate from puzzle color because multiple parts can share a color and a part can change color across time.

V1 reveals a part name only after the player correctly fills the selected variable. Completion reveals the full part legend. This prevents educational labels from leaking the answer.

## 8. Difficulty and correctness

V1 stores the answer in the client because it is an offline single-player prototype. Correctness modes are:

- Soft: allow any mark; Check reports disagreement count.
- Strict: reject a mark that differs from the authored answer.

Production community puzzles should validate on ingestion and may store a signed solution hash or server-side answer rather than exposing an unobfuscated solution in public competitive modes.

## 9. Performance targets

V1 samples remain below roughly 500 variables. The main thread performs rendering and interaction. Solver hints use a Web Worker where supported. Three-dimensional rendering is event-driven rather than a permanent animation loop.

Before increasing puzzle sizes, migrate repeated 3D cells to `InstancedMesh`, move generation/validation fully off-thread, and add chunked visibility updates.

## 10. Acceptance gates before V2

Proceed to creator/import tools only after tests show:

- at least 80% of first-time players correctly explain a temporal clue after the tutorial;
- at least 80% can reach an internal 3D cell using Slice or Track without assistance;
- fewer than 5% of cell edits are unintended camera gestures;
- players use Track view as a precision tool rather than treating it as a workaround for a broken model view;
- median completion time and abandonment are measured separately by lattice and mode.
