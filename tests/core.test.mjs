import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY,
  encodeRuns,
  generateLinePatterns,
  minimumLineLength,
} from '../mosaic/core/clues.js';
import { buildLattice } from '../mosaic/core/lattices.js';

test('encodeRuns keeps ordered colored runs and ignores empty cells', () => {
  assert.deepEqual(
    encodeRuns([0, 1, 1, 0, 2, 2, 2, 1, 0]),
    [
      { colorId: 1, length: 2 },
      { colorId: 2, length: 3 },
      { colorId: 1, length: 1 },
    ],
  );
});

test('different colors may touch but equal colors require a gap', () => {
  const different = generateLinePatterns(3, [
    { colorId: 1, length: 1 },
    { colorId: 2, length: 2 },
  ]);
  assert.deepEqual(different, [[1, 2, 2]]);

  const same = generateLinePatterns(3, [
    { colorId: 1, length: 1 },
    { colorId: 1, length: 1 },
  ]);
  assert.deepEqual(same, [[1, EMPTY, 1]]);
  assert.equal(minimumLineLength([
    { colorId: 1, length: 1 },
    { colorId: 1, length: 1 },
  ]), 3);
});

test('every 2D cell belongs to three spatial tracks on hex and triangle tilings', () => {
  for (const kind of ['hex', 'triangle']) {
    const lattice = buildLattice(kind, kind === 'hex' ? { radius: 2 } : { width: 4, height: 3 });
    const memberships = Array(lattice.cells.length).fill(0);
    for (const track of lattice.tracks) {
      for (const cellIndex of track.cells) memberships[cellIndex] += 1;
    }
    assert.ok(memberships.every((count) => count === 3), `${kind}: ${memberships.join(',')}`);
  }
});

test('hex cells render as a connected tiling with only a fine stroke gap', () => {
  const lattice = buildLattice('hex', { radius: 1 });
  const center = lattice.cells.find((cell) => cell.coord.q === 0 && cell.coord.r === 0);
  const neighbor = lattice.cells.find((cell) => cell.coord.q === 1 && cell.coord.r === 0);
  const centerMaxX = Math.max(...center.polygon.map(([x]) => x));
  const neighborMinX = Math.min(...neighbor.polygon.map(([x]) => x));
  assert.ok(neighborMinX - centerMaxX < 0.08);
});

test('triangle pictures render in a roughly square display footprint', () => {
  const lattice = buildLattice('triangle', { width: 5, height: 5 });
  const points = lattice.cells.flatMap((cell) => cell.polygon);
  const width = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
  const height = Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y));
  const aspect = width / height;
  assert.ok(aspect > 0.85 && aspect < 1.35, `triangle aspect ${aspect}`);
});

test('FCC, BCC, and HCP create finite cells and non-empty ordered tracks', () => {
  const specs = [
    ['fcc', { size: 3 }],
    ['bcc', { size: 3 }],
    ['hcp', { nx: 3, ny: 3, nz: 2 }],
  ];
  for (const [kind, params] of specs) {
    const lattice = buildLattice(kind, params);
    assert.ok(lattice.cells.length > 0);
    assert.ok(lattice.tracks.length > 0);
    assert.ok(lattice.tracks.every((track) => track.cells.length > 0));
  }
});

import { latticeVoronoiVertices } from '../mosaic/render/voronoi.js';

test('Voronoi cells have the expected convex-polyhedron vertex counts', () => {
  assert.equal(latticeVoronoiVertices('sc').length, 8);
  assert.equal(latticeVoronoiVertices('fcc').length, 14);
  assert.equal(latticeVoronoiVertices('bcc').length, 24);
  assert.ok(latticeVoronoiVertices('hcp', 0).length >= 12);
  assert.equal(latticeVoronoiVertices('hcp', 0).length, latticeVoronoiVertices('hcp', 1).length);
});
