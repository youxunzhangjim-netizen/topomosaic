# Puzzle Authoring Guide

V1 puzzles are authored in `mosaic/data/puzzles.js` and converted into the common schema by `createPuzzle`.

## Minimal static 2D example

```js
{
  id: 'my-picture',
  title: 'My Picture',
  titleZh: '我的圖像',
  lattice: 'square',
  board: { width: 8, height: 8 },
  palette: PALETTE,
  solution: ({ cell }) => {
    const { x, y } = cell.coord;
    return x === y ? 1 : 0;
  },
}
```

## Add time

```js
{
  id: 'my-animation',
  lattice: 'hex',
  board: { radius: 3 },
  frames: 5,
  palette: PALETTE,
  solution: ({ cell, frame }) => {
    const distance = Math.max(
      Math.abs(cell.coord.q),
      Math.abs(cell.coord.r),
      Math.abs(cell.coord.s),
    );
    return distance <= frame ? 2 : 0;
  },
}
```

Temporal tracks are generated automatically. Do not author temporal clues manually; the source of truth is the complete frame tensor.

## Semantic 3D example

```js
{
  id: 'semantic-model',
  lattice: 'sc',
  board: { size: 5 },
  palette: PALETTE,
  semanticParts: [
    { id: 'core', name: 'Core', nameZh: '核心', colorId: 4 },
    { id: 'shell', name: 'Shell', nameZh: '外殼', colorId: 2 },
  ],
  solution: ({ cell }) => {
    const { x, y, z } = cell.coord;
    if (x === 2 && y === 2 && z === 2) {
      return { colorId: 4, semanticPartId: 'core' };
    }
    return { colorId: 2, semanticPartId: 'shell' };
  },
}
```

Return `0` for empty. A filled return value can be either an integer color ID or `{ colorId, semanticPartId }`.

## Givens

A sparse onboarding puzzle may expose a small number of variables:

```js
given: ({ cell, frame }) => (cell.index + 7 * frame) % 23 === 0
```

Givens must never be editable. Use them to teach an unfamiliar geometry, not to hide an ambiguous generator.

## Validation workflow

After adding a puzzle:

```bash
npm run validate
```

Do not publish unless the validator reports:

- one solution;
- the solver solution matches the authored tensor;
- no search-limit termination;
- reasonable pattern counts and response time.

Uniqueness is necessary but not sufficient. A later human-style difficulty pass should measure propagation rounds, branching, clue density, number of cross-family dependencies, and whether the image/model remains recognizable.

## Content guidelines

- Use small frames and volumes first.
- Keep empty space around meaningful objects.
- Avoid color fragmentation that produces long unreadable clue lists.
- Choose a lattice because it supports the subject, not merely as a cosmetic skin.
- Use SC for anatomy/buildings when orthogonal slices are essential.
- Use FCC/BCC/HCP for crystal species, defects, stacking, growth, and phase-like transformations.
- In +Time content, make temporal clues informative; do not repeat an identical frame solely to claim a time mode.
