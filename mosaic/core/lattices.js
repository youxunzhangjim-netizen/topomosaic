const SQRT3 = Math.sqrt(3);

function centerCells(cells) {
  if (!cells.length) return cells;
  const mean = cells.reduce(
    (sum, cell) => [
      sum[0] + cell.position[0],
      sum[1] + cell.position[1],
      sum[2] + (cell.position[2] || 0),
    ],
    [0, 0, 0],
  ).map((value) => value / cells.length);

  for (const cell of cells) {
    cell.position = [
      cell.position[0] - mean[0],
      cell.position[1] - mean[1],
      (cell.position[2] || 0) - mean[2],
    ];
    if (cell.polygon) {
      cell.polygon = cell.polygon.map(([x, y]) => [x - mean[0], y - mean[1]]);
    }
  }
  return cells;
}

function finalizeTracks(cells, tracks) {
  const seen = new Set();
  return tracks
    .filter((track) => track.cells.length > 0)
    .map((track, index) => {
      const key = track.cells.join(',');
      if (seen.has(`${track.family}:${key}`)) {
        throw new Error(`Duplicate track in family ${track.family}: ${key}`);
      }
      seen.add(`${track.family}:${key}`);
      return {
        id: track.id || `${track.family}:${index}`,
        family: track.family,
        familyLabel: track.familyLabel || track.family,
        lineLabel: track.lineLabel || String(index + 1),
        cells: track.cells,
      };
    });
}

function squareLattice({ width = 8, height = width } = {}) {
  const cells = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = cells.length;
      cells.push({
        id: `sq:${x},${y}`,
        index,
        key: `${x},${y}`,
        coord: { x, y },
        position: [x, -y, 0],
        polygon: [
          [x - 0.46, -y - 0.46],
          [x + 0.46, -y - 0.46],
          [x + 0.46, -y + 0.46],
          [x - 0.46, -y + 0.46],
        ],
      });
    }
  }

  const indexOf = (x, y) => y * width + x;
  const tracks = [];
  for (let y = 0; y < height; y += 1) {
    tracks.push({
      family: 'row',
      familyLabel: 'Rows',
      lineLabel: `Y${y + 1}`,
      cells: Array.from({ length: width }, (_, x) => indexOf(x, y)),
    });
  }
  for (let x = 0; x < width; x += 1) {
    tracks.push({
      family: 'column',
      familyLabel: 'Columns',
      lineLabel: `X${x + 1}`,
      cells: Array.from({ length: height }, (_, y) => indexOf(x, y)),
    });
  }

  centerCells(cells);
  return {
    kind: 'square',
    dimension: 2,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [],
    metadata: { width, height },
  };
}

function hexPolygon(cx, cy, radius = 0.98) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

function hexLattice({ radius = 3 } = {}) {
  const cells = [];
  const map = new Map();
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > radius) continue;
      const x = SQRT3 * (q + r / 2);
      const y = -1.5 * r;
      const index = cells.length;
      const key = `${q},${r}`;
      cells.push({
        id: `hex:${key}`,
        index,
        key,
        coord: { q, r, s },
        position: [x, y, 0],
        polygon: hexPolygon(x, y),
      });
      map.set(key, index);
    }
  }

  const tracks = [];
  const families = [
    { family: 'hex-q', label: 'Q direction', group: (cell) => cell.coord.q, order: (cell) => cell.coord.r },
    { family: 'hex-r', label: 'R direction', group: (cell) => cell.coord.r, order: (cell) => cell.coord.q },
    { family: 'hex-s', label: 'S direction', group: (cell) => cell.coord.s, order: (cell) => cell.coord.q },
  ];

  for (const family of families) {
    const groups = new Map();
    for (const cell of cells) {
      const key = family.group(cell);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(cell);
    }
    for (const [line, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      group.sort((a, b) => family.order(a) - family.order(b));
      tracks.push({
        family: family.family,
        familyLabel: family.label,
        lineLabel: `${family.family.at(-1).toUpperCase()}${line >= 0 ? '+' : ''}${line}`,
        cells: group.map((cell) => cell.index),
      });
    }
  }

  centerCells(cells);
  return {
    kind: 'hex',
    dimension: 2,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [],
    metadata: { radius },
  };
}

function triangleLattice({ width = 5, height = 5 } = {}) {
  const cells = [];
  const a = [1, 0];
  const b = [0.5, SQRT3 / 2];
  const toDisplayPoint = ([x, y]) => [x - y / SQRT3, -y];

  function addCell(i, j, orientation) {
    const p = [i * a[0] + j * b[0], i * a[1] + j * b[1]];
    const pa = [p[0] + a[0], p[1] + a[1]];
    const pb = [p[0] + b[0], p[1] + b[1]];
    const pab = [p[0] + a[0] + b[0], p[1] + a[1] + b[1]];
    const polygon = orientation === 'up' ? [p, pa, pb] : [pab, pb, pa];
    const displayPolygon = polygon.map(toDisplayPoint);
    const center = displayPolygon.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
      .map((value) => value / 3);
    const index = cells.length;
    cells.push({
      id: `tri:${i},${j},${orientation}`,
      index,
      key: `${i},${j},${orientation}`,
      coord: { i, j, orientation },
      position: [center[0], center[1], 0],
      polygon: displayPolygon,
    });
  }

  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      addCell(i, j, 'up');
      addCell(i, j, 'down');
    }
  }

  const tracks = [];
  const families = [
    {
      family: 'tri-a',
      label: 'A zigzag',
      group: (cell) => cell.coord.j,
      order: (cell) => cell.coord.i * 2 + (cell.coord.orientation === 'down' ? 1 : 0),
    },
    {
      family: 'tri-b',
      label: 'B zigzag',
      group: (cell) => cell.coord.i,
      order: (cell) => cell.coord.j * 2 + (cell.coord.orientation === 'down' ? 1 : 0),
    },
    {
      family: 'tri-c',
      label: 'C zigzag',
      group: (cell) => cell.coord.i + cell.coord.j + (cell.coord.orientation === 'down' ? 1 : 0),
      order: (cell) => cell.coord.j * 2 + (cell.coord.orientation === 'down' ? 1 : 0),
    },
  ];

  for (const family of families) {
    const groups = new Map();
    for (const cell of cells) {
      const line = family.group(cell);
      if (!groups.has(line)) groups.set(line, []);
      groups.get(line).push(cell);
    }
    for (const [line, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      group.sort((left, right) => family.order(left) - family.order(right));
      tracks.push({
        family: family.family,
        familyLabel: family.label,
        lineLabel: `${family.family.at(-1).toUpperCase()}${line + 1}`,
        cells: group.map((cell) => cell.index),
      });
    }
  }

  centerCells(cells);
  return {
    kind: 'triangle',
    dimension: 2,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [],
    metadata: { width, height },
  };
}

function coordKey(coord) {
  return coord.join(',');
}

function tracksBySteps(cells, directions) {
  const map = new Map(cells.map((cell) => [coordKey(cell.coordArray), cell.index]));
  const tracks = [];

  for (const direction of directions) {
    const predecessor = direction.step.map((value) => -value);
    const starts = cells.filter((cell) => {
      const previous = cell.coordArray.map((value, index) => value + predecessor[index]);
      return !map.has(coordKey(previous));
    });

    starts.sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true }));
    let lineNumber = 1;
    for (const start of starts) {
      const line = [];
      let cursor = start.coordArray.slice();
      while (map.has(coordKey(cursor))) {
        line.push(map.get(coordKey(cursor)));
        cursor = cursor.map((value, index) => value + direction.step[index]);
      }
      tracks.push({
        family: direction.id,
        familyLabel: direction.label,
        lineLabel: `${direction.short || direction.id.toUpperCase()}${lineNumber}`,
        cells: line,
      });
      lineNumber += 1;
    }
  }

  return tracks;
}

function simpleCubicLattice({ size = 5 } = {}) {
  const cells = [];
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const coordArray = [x, y, z];
        const index = cells.length;
        cells.push({
          id: `sc:${coordKey(coordArray)}`,
          index,
          key: coordKey(coordArray),
          coord: { x, y, z },
          coordArray,
          position: [x, y, z],
          basis: 0,
        });
      }
    }
  }
  const directions = [
    { id: 'sc-x', label: 'X tracks', short: 'X', step: [1, 0, 0] },
    { id: 'sc-y', label: 'Y tracks', short: 'Y', step: [0, 1, 0] },
    { id: 'sc-z', label: 'Z tracks', short: 'Z', step: [0, 0, 1] },
  ];
  const tracks = tracksBySteps(cells, directions);
  centerCells(cells);
  return {
    kind: 'sc',
    dimension: 3,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [
      { id: 'slice-x', label: 'X layers', normal: [1, 0, 0] },
      { id: 'slice-y', label: 'Y layers', normal: [0, 1, 0] },
      { id: 'slice-z', label: 'Z layers', normal: [0, 0, 1] },
    ],
    metadata: { size },
  };
}

function fccLattice({ size = 3 } = {}) {
  const limit = 2 * (size - 1);
  const cells = [];
  for (let z = 0; z <= limit; z += 1) {
    for (let y = 0; y <= limit; y += 1) {
      for (let x = 0; x <= limit; x += 1) {
        if ((x + y + z) % 2 !== 0) continue;
        const coordArray = [x, y, z];
        const index = cells.length;
        cells.push({
          id: `fcc:${coordKey(coordArray)}`,
          index,
          key: coordKey(coordArray),
          coord: { x, y, z },
          coordArray,
          position: [x / 2, y / 2, z / 2],
          basis: (x % 2) * 2 + (y % 2),
        });
      }
    }
  }
  const directions = [
    { id: 'fcc-110', label: '[110]', short: 'A', step: [1, 1, 0] },
    { id: 'fcc-1m10', label: '[1-10]', short: 'B', step: [1, -1, 0] },
    { id: 'fcc-101', label: '[101]', short: 'C', step: [1, 0, 1] },
    { id: 'fcc-10m1', label: '[10-1]', short: 'D', step: [1, 0, -1] },
    { id: 'fcc-011', label: '[011]', short: 'E', step: [0, 1, 1] },
    { id: 'fcc-01m1', label: '[01-1]', short: 'F', step: [0, 1, -1] },
  ];
  const tracks = tracksBySteps(cells, directions);
  centerCells(cells);
  return {
    kind: 'fcc',
    dimension: 3,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [
      { id: 'fcc-100', label: '{100} X planes', normal: [1, 0, 0] },
      { id: 'fcc-010', label: '{100} Y planes', normal: [0, 1, 0] },
      { id: 'fcc-001', label: '{100} Z planes', normal: [0, 0, 1] },
      { id: 'fcc-111', label: '{111} close-packed planes', normal: [1, 1, 1] },
    ],
    metadata: { size },
  };
}

function bccLattice({ size = 3 } = {}) {
  const limit = 2 * (size - 1);
  const cells = [];
  for (let z = 0; z <= limit; z += 1) {
    for (let y = 0; y <= limit; y += 1) {
      for (let x = 0; x <= limit; x += 1) {
        const sameParity = (x % 2 === y % 2) && (y % 2 === z % 2);
        if (!sameParity) continue;
        const coordArray = [x, y, z];
        const index = cells.length;
        cells.push({
          id: `bcc:${coordKey(coordArray)}`,
          index,
          key: coordKey(coordArray),
          coord: { x, y, z },
          coordArray,
          position: [x / 2, y / 2, z / 2],
          basis: x % 2,
        });
      }
    }
  }
  const directions = [
    { id: 'bcc-111', label: '[111]', short: 'A', step: [1, 1, 1] },
    { id: 'bcc-11m1', label: '[11-1]', short: 'B', step: [1, 1, -1] },
    { id: 'bcc-1m11', label: '[1-11]', short: 'C', step: [1, -1, 1] },
    { id: 'bcc-m111', label: '[-111]', short: 'D', step: [-1, 1, 1] },
    { id: 'bcc-100', label: '[100] secondary', short: 'X', step: [2, 0, 0] },
    { id: 'bcc-010', label: '[010] secondary', short: 'Y', step: [0, 2, 0] },
    { id: 'bcc-001', label: '[001] secondary', short: 'Z', step: [0, 0, 2] },
  ];
  const tracks = tracksBySteps(cells, directions);
  centerCells(cells);
  return {
    kind: 'bcc',
    dimension: 3,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [
      { id: 'bcc-100-plane', label: '{100} X planes', normal: [1, 0, 0] },
      { id: 'bcc-010-plane', label: '{100} Y planes', normal: [0, 1, 0] },
      { id: 'bcc-001-plane', label: '{100} Z planes', normal: [0, 0, 1] },
      { id: 'bcc-111-plane', label: '{111} diagonal planes', normal: [1, 1, 1] },
    ],
    metadata: { size },
  };
}

function hcpLattice({ nx = 4, ny = 4, nz = 3 } = {}) {
  const a1 = [1, 0, 0];
  const a2 = [0.5, SQRT3 / 2, 0];
  const c = [0, 0, Math.sqrt(8 / 3)];
  const basisOffset = [
    [0, 0, 0],
    [(a1[0] + a2[0]) / 3, (a1[1] + a2[1]) / 3, c[2] / 2],
  ];
  const cells = [];

  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        for (let basis = 0; basis < 2; basis += 1) {
          const position = [
            i * a1[0] + j * a2[0] + k * c[0] + basisOffset[basis][0],
            i * a1[1] + j * a2[1] + k * c[1] + basisOffset[basis][1],
            i * a1[2] + j * a2[2] + k * c[2] + basisOffset[basis][2],
          ];
          const index = cells.length;
          cells.push({
            id: `hcp:${i},${j},${k},${basis}`,
            index,
            key: `${i},${j},${k},${basis}`,
            coord: { i, j, k, basis },
            coordArray: [i, j, k, basis],
            position,
            basis,
          });
        }
      }
    }
  }

  const familyDefinitions = [
    {
      family: 'hcp-a1', familyLabel: 'Basal a₁', line: (cell) => `${cell.coord.j},${cell.coord.k},${cell.basis}`, order: (cell) => cell.coord.i,
    },
    {
      family: 'hcp-a2', familyLabel: 'Basal a₂', line: (cell) => `${cell.coord.i},${cell.coord.k},${cell.basis}`, order: (cell) => cell.coord.j,
    },
    {
      family: 'hcp-a3', familyLabel: 'Basal a₃', line: (cell) => `${cell.coord.i + cell.coord.j},${cell.coord.k},${cell.basis}`, order: (cell) => cell.coord.i,
    },
    {
      family: 'hcp-c', familyLabel: 'Axial c', line: (cell) => `${cell.coord.i},${cell.coord.j},${cell.basis}`, order: (cell) => cell.coord.k,
    },
  ];

  const tracks = [];
  for (const definition of familyDefinitions) {
    const groups = new Map();
    for (const cell of cells) {
      const line = definition.line(cell);
      if (!groups.has(line)) groups.set(line, []);
      groups.get(line).push(cell);
    }
    let lineNumber = 1;
    for (const group of groups.values()) {
      group.sort((left, right) => definition.order(left) - definition.order(right));
      tracks.push({
        family: definition.family,
        familyLabel: definition.familyLabel,
        lineLabel: `${definition.family.replace('hcp-', '').toUpperCase()}${lineNumber}`,
        cells: group.map((cell) => cell.index),
      });
      lineNumber += 1;
    }
  }

  centerCells(cells);
  return {
    kind: 'hcp',
    dimension: 3,
    cells,
    tracks: finalizeTracks(cells, tracks),
    sliceFamilies: [
      { id: 'hcp-basal', label: 'Basal (0001) layers', normal: [0, 0, 1] },
      { id: 'hcp-prism-a1', label: 'Prismatic A layers', normal: [0, 1, 0] },
      { id: 'hcp-prism-a2', label: 'Prismatic B layers', normal: [SQRT3 / 2, -0.5, 0] },
    ],
    metadata: { nx, ny, nz, a1, a2, c, basisOffset },
  };
}

export function buildLattice(kind, params = {}) {
  switch (kind) {
    case 'square': return squareLattice(params);
    case 'hex': return hexLattice(params);
    case 'triangle': return triangleLattice(params);
    case 'sc': return simpleCubicLattice(params);
    case 'fcc': return fccLattice(params);
    case 'bcc': return bccLattice(params);
    case 'hcp': return hcpLattice(params);
    default: throw new Error(`Unsupported lattice kind: ${kind}`);
  }
}

export const LATTICE_OPTIONS = Object.freeze({
  2: [
    { id: 'square', label: 'Square cells' },
    { id: 'hex', label: 'Hexagonal cells' },
    { id: 'triangle', label: 'Triangular cells' },
  ],
  3: [
    { id: 'sc', label: 'Simple cubic cells' },
    { id: 'fcc', label: 'FCC Voronoi cells' },
    { id: 'bcc', label: 'BCC Voronoi cells' },
    { id: 'hcp', label: 'HCP Voronoi cells' },
  ],
});
