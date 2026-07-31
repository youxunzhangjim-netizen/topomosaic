import { createPuzzle } from '../core/puzzle.js';

export const PALETTE = Object.freeze([
  { id: 1, key: 'yellow', name: 'Sun yellow', color: '#f2c94c', pattern: 'dots' },
  { id: 2, key: 'blue', name: 'Sky blue', color: '#4f8bd6', pattern: 'waves' },
  { id: 3, key: 'green', name: 'Leaf green', color: '#54a86b', pattern: 'diagonal' },
  { id: 4, key: 'red', name: 'Warm red', color: '#d96572', pattern: 'cross' },
  { id: 5, key: 'brown', name: 'Earth brown', color: '#8b6446', pattern: 'grid' },
]);

function gridSolution(rows) {
  const values = rows.map((row) => [...row].map((character) => Number(character)));
  return ({ cell }) => values[cell.coord.y]?.[cell.coord.x] ?? 0;
}

function sparseGiven(divisor, offset = 0) {
  return ({ cell, frame }) => ((cell.index + frame * 7 + offset) % divisor) === 0;
}

function squareFlowerStage({ cell, frame }) {
  const { x, y } = cell.coord;
  if (frame === 0) return (x === 4 && y === 7) ? 5 : 0;
  if (frame >= 1 && x === 4 && y >= 5 && y <= 7) return 3;
  if (frame >= 2 && ((x === 3 && y === 6) || (x === 5 && y === 5))) return 3;
  if (frame >= 3 && x === 4 && y === 3) return 5;
  if (frame >= 4) {
    const petal = (Math.abs(x - 4) + Math.abs(y - 3) === 1)
      || (Math.abs(x - 4) === 1 && Math.abs(y - 3) === 1);
    if (petal) return 1;
    if (x === 4 && y === 3) return 5;
  }
  return 0;
}

function hexBloom({ cell, frame = 3 }) {
  const { q, r, s } = cell.coord;
  const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
  if (q === 0 && r === 0) return 5;
  if (frame >= 1 && distance === 1) return 1;
  if (frame >= 2 && ((q === 0 && r === 2) || (q === -1 && r === 2))) return 3;
  if (frame >= 3 && ((q === 0 && r === 3) || (q === -1 && r === 3))) return 3;
  if (frame >= 3 && ((q === 2 && r === -1) || (q === -2 && r === 1))) return 2;
  return 0;
}

function triangleSailboat({ cell, frame = 3 }) {
  const { i, j, orientation } = cell.coord;
  if (j === 4) return 2;
  if (frame >= 1 && i === 2 && j >= 1 && j <= 3) return 5;
  if (frame >= 2 && j >= 1 && j <= 3 && i < 2 && i + j >= 2) return 1;
  if (frame >= 3 && j >= 2 && j <= 3 && i > 2 && i + j <= 7) return 4;
  if (j === 3 && i >= 1 && i <= 3 && orientation === 'down') return 5;
  return 0;
}

function scTree({ cell, frame = 3 }) {
  const { x, y, z } = cell.coord;
  const stage = Math.min(frame, 3);
  if (z <= Math.min(stage, 1) && x === 1 && y === 1) {
    return { colorId: 5, semanticPartId: 'trunk' };
  }
  if (stage >= 1 && z === 2 && Math.abs(x - 1.5) + Math.abs(y - 1.5) <= 1) {
    return { colorId: 3, semanticPartId: 'canopy' };
  }
  if (stage >= 2 && z === 3 && x >= 1 && x <= 2 && y >= 1 && y <= 2) {
    const isFruit = stage >= 3 && ((x === 1 && y === 1) || (x === 2 && y === 2));
    return { colorId: isFruit ? 4 : 3, semanticPartId: isFruit ? 'fruit' : 'canopy' };
  }
  if (stage >= 3 && z === 2 && ((x === 0 && y === 1) || (x === 3 && y === 2))) {
    return { colorId: 3, semanticPartId: 'canopy' };
  }
  return 0;
}

function fccCrystal({ cell, frame = 3 }) {
  const [x, y, z] = cell.coordArray;
  const px = x / 2 - 1;
  const py = y / 2 - 1;
  const pz = z / 2 - 1;
  const radius2 = px * px + py * py + pz * pz;
  const limit = [0.25, 0.8, 1.65, 3.1][Math.min(frame, 3)];
  if (radius2 > limit) return 0;
  if (x === 2 && y === 2 && z === 2) return 0; // vacancy at the nucleus centre
  const species = ((x + 2 * y + 3 * z) / 2) % 3;
  return {
    colorId: species === 0 ? 1 : species === 1 ? 2 : 4,
    semanticPartId: species === 0 ? 'species-a' : species === 1 ? 'species-b' : 'species-c',
  };
}

function bccCrystal({ cell, frame = 3 }) {
  const [x, y, z] = cell.coordArray;
  const px = x / 2 - 1;
  const py = y / 2 - 1;
  const pz = z / 2 - 1;
  const radius = Math.max(Math.abs(px), Math.abs(py), Math.abs(pz));
  const limit = [0.1, 0.55, 1.0, 1.5][Math.min(frame, 3)];
  if (radius > limit) return 0;
  if (x === 1 && y === 1 && z === 1 && frame >= 2) {
    return { colorId: 4, semanticPartId: 'impurity' };
  }
  return {
    colorId: cell.basis === 0 ? 2 : 1,
    semanticPartId: cell.basis === 0 ? 'corner-sublattice' : 'body-sublattice',
  };
}

function hcpStack({ cell, frame = 3 }) {
  const { i, j, k, basis } = cell.coord;
  const order = k * 2 + basis;
  if (order > Math.min(frame, 3)) return 0;
  if (i === 1 && j === 1 && k === 1 && basis === 0) return 0; // stacking vacancy
  const boundary = i === 0 || j === 0 || i === 2 || j === 2;
  return {
    colorId: basis === 0 ? (boundary ? 3 : 1) : (boundary ? 2 : 4),
    semanticPartId: basis === 0 ? 'layer-a' : 'layer-b',
  };
}

const semanticTree = [
  { id: 'trunk', name: 'Trunk', nameZh: '樹幹', description: 'Supports the canopy.', colorId: 5 },
  { id: 'canopy', name: 'Canopy', nameZh: '樹冠', description: 'The leaf-bearing crown.', colorId: 3 },
  { id: 'fruit', name: 'Fruit', nameZh: '果實', description: 'A semantic sub-part of the model.', colorId: 4 },
];

const SPECS = [
  {
    id: 'square-sunflower', title: 'Sunflower Portrait', titleZh: '向日葵圖像',
    description: 'A square-tiling color mosaic for learning ordered path-run clues.',
    descriptionZh: '用方格鋪砌的彩色馬賽克，熟悉有序路徑連段線索。',
    lattice: 'square', board: { width: 9, height: 9 }, palette: PALETTE,
    solution: gridSolution([
      '000010000',
      '001111100',
      '011151110',
      '001111100',
      '000030000',
      '000333000',
      '000030000',
      '000030000',
      '000030000',
    ]),
    given: sparseGiven(19, 3), difficulty: 'Starter',
  },
  {
    id: 'square-time-flower', title: 'A Flower Grows', titleZh: '花朵生長',
    description: 'Trace a growing flower by reading space paths in each frame and time paths through each tile.',
    descriptionZh: '閱讀每一幀的空間路徑與每個圖塊的時間路徑，追出花朵生長。',
    lattice: 'square', board: { width: 9, height: 9 }, frames: 5, palette: PALETTE,
    solution: squareFlowerStage, given: sparseGiven(31, 4), difficulty: 'Starter',
  },
  {
    id: 'hex-bloom', title: 'Hexagonal Blossom', titleZh: '六角花朵',
    description: 'A bloom on a hex topology, where every tile sits at three crossing path families.',
    descriptionZh: '六角拓撲上的花朵；每個圖塊都位在三組交會路徑上。',
    lattice: 'hex', board: { radius: 3 }, palette: PALETTE,
    solution: ({ cell }) => hexBloom({ cell, frame: 3 }), given: sparseGiven(17, 2), difficulty: 'Easy',
  },
  {
    id: 'hex-time-bloom', title: 'Opening Hex Flower', titleZh: '六角花開',
    description: 'A four-frame hex mosaic where petals and leaves emerge as time-path runs.',
    descriptionZh: '四幀六角馬賽克；花瓣與葉片沿時間路徑逐步浮現。',
    lattice: 'hex', board: { radius: 3 }, frames: 4, palette: PALETTE,
    solution: hexBloom, given: sparseGiven(29, 7), difficulty: 'Easy',
  },
  {
    id: 'triangle-sailboat', title: 'Triangular Sailboat', titleZh: '三角帆船',
    description: 'A sailboat built from triangular tiles and three woven path families.',
    descriptionZh: '由三角圖塊與三組編織路徑構成的帆船馬賽克。',
    lattice: 'triangle', board: { width: 5, height: 5 }, palette: PALETTE,
    solution: ({ cell }) => triangleSailboat({ cell, frame: 3 }), given: sparseGiven(13, 1), difficulty: 'Easy',
  },
  {
    id: 'triangle-time-sail', title: 'Raising the Sails', titleZh: '升起船帆',
    description: 'A temporal triangular mosaic where mast, sails, and water assemble across linked frames.',
    descriptionZh: '時間版三角馬賽克；桅杆、帆面與水面在連動幀中成形。',
    lattice: 'triangle', board: { width: 5, height: 5 }, frames: 4, palette: PALETTE,
    solution: triangleSailboat, given: sparseGiven(23, 5), difficulty: 'Medium',
  },
  {
    id: 'sc-fruit-tree', title: 'Voxel Fruit Tree', titleZh: '體素果樹',
    description: 'A voxel tree whose trunk, canopy, and fruit are resolved through lattice paths.',
    descriptionZh: '透過晶格路徑解出樹幹、樹冠與果實的體素馬賽克。',
    lattice: 'sc', board: { size: 4 }, palette: PALETTE,
    solution: ({ cell }) => scTree({ cell, frame: 3 }), given: sparseGiven(17, 2),
    semanticParts: semanticTree, difficulty: 'Easy',
  },
  {
    id: 'sc-time-tree', title: 'Growing Voxel Tree', titleZh: '生長中的體素樹',
    description: 'A four-frame lattice mosaic where every voxel carries both space and time paths.',
    descriptionZh: '四幀晶格馬賽克；每個體素同時承載空間與時間路徑。',
    lattice: 'sc', board: { size: 4 }, frames: 4, palette: PALETTE,
    solution: scTree, given: sparseGiven(37, 8), semanticParts: semanticTree, difficulty: 'Medium',
  },
  {
    id: 'fcc-alloy', title: 'FCC Ordered Alloy', titleZh: 'FCC 有序合金',
    description: 'An FCC lattice mosaic with three ordered species wrapped around a central void.',
    descriptionZh: 'FCC 晶格馬賽克；三種有序物種環繞中心留白。',
    lattice: 'fcc', board: { size: 3 }, palette: PALETTE,
    solution: ({ cell }) => fccCrystal({ cell, frame: 3 }), given: sparseGiven(19, 5), difficulty: 'Medium',
    semanticParts: [
      { id: 'species-a', name: 'Species A', nameZh: '原子 A', colorId: 1 },
      { id: 'species-b', name: 'Species B', nameZh: '原子 B', colorId: 2 },
      { id: 'species-c', name: 'Species C', nameZh: '原子 C', colorId: 4 },
    ],
    educationalNote: 'FCC path clues follow six face-diagonal families through the lattice mosaic.',
    educationalNoteZh: 'FCC 路徑線索沿六組面對角族穿過晶格馬賽克。',
  },
  {
    id: 'fcc-time-nucleation', title: 'FCC Crystal Nucleation', titleZh: 'FCC 晶核成長',
    description: 'A time-path FCC mosaic where an alloy nucleus expands around a persistent void.',
    descriptionZh: '時間路徑 FCC 馬賽克；合金核心圍繞持續留白逐幀擴張。',
    lattice: 'fcc', board: { size: 3 }, frames: 4, palette: PALETTE,
    solution: fccCrystal, given: sparseGiven(41, 6), difficulty: 'Advanced',
  },
  {
    id: 'bcc-defect', title: 'BCC Sublattices and Defect', titleZh: 'BCC 子晶格與缺陷',
    description: 'A BCC mosaic that separates corner paths, body-centre paths, and one impurity.',
    descriptionZh: 'BCC 馬賽克；分辨角點路徑、體心路徑與一個雜質。',
    lattice: 'bcc', board: { size: 3 }, palette: PALETTE,
    solution: ({ cell }) => bccCrystal({ cell, frame: 3 }), given: sparseGiven(13, 4), difficulty: 'Medium',
    semanticParts: [
      { id: 'corner-sublattice', name: 'Corner sublattice', nameZh: '角點子晶格', colorId: 2 },
      { id: 'body-sublattice', name: 'Body-centre sublattice', nameZh: '體心子晶格', colorId: 1 },
      { id: 'impurity', name: 'Impurity', nameZh: '雜質', colorId: 4 },
    ],
  },
  {
    id: 'bcc-time-pulse', title: 'BCC Ordering Pulse', titleZh: 'BCC 有序化脈衝',
    description: 'A body-centred time mosaic where the cluster expands and its core changes mark.',
    descriptionZh: '體心時間馬賽克；團簇逐幀擴張，核心標記隨之改變。',
    lattice: 'bcc', board: { size: 3 }, frames: 4, palette: PALETTE,
    solution: bccCrystal, given: sparseGiven(31, 9), difficulty: 'Advanced',
  },
  {
    id: 'hcp-stacking', title: 'HCP AB Stacking', titleZh: 'HCP AB 堆疊',
    description: 'An HCP stacking mosaic read through basal paths, axial paths, and its two-site basis.',
    descriptionZh: 'HCP 堆疊馬賽克；透過基面路徑、軸向路徑與雙基底讀解。',
    lattice: 'hcp', board: { nx: 3, ny: 3, nz: 2 }, palette: PALETTE,
    solution: ({ cell }) => hcpStack({ cell, frame: 3 }), given: sparseGiven(11, 0), difficulty: 'Medium',
    semanticParts: [
      { id: 'layer-a', name: 'A layer', nameZh: 'A 層', colorId: 1 },
      { id: 'layer-b', name: 'B layer', nameZh: 'B 層', colorId: 4 },
    ],
  },
  {
    id: 'hcp-time-growth', title: 'HCP Layer Growth', titleZh: 'HCP 層狀成長',
    description: 'A temporal HCP mosaic where AB layers become an ordered time-path pattern.',
    descriptionZh: '時間版 HCP 馬賽克；AB 層形成有序的時間路徑圖樣。',
    lattice: 'hcp', board: { nx: 3, ny: 3, nz: 2 }, frames: 4, palette: PALETTE,
    solution: hcpStack, given: sparseGiven(29, 12), difficulty: 'Advanced',
  },
];

let cache = null;

export function buildCatalog() {
  if (!cache) cache = SPECS.map((spec) => createPuzzle(spec));
  return cache;
}

export function findPuzzle(id) {
  return buildCatalog().find((puzzle) => puzzle.id === id) || null;
}

export function puzzlesFor({ dimension, hasTime, lattice } = {}) {
  return buildCatalog().filter((puzzle) => (
    (dimension == null || puzzle.dimension === Number(dimension))
    && (hasTime == null || puzzle.hasTime === Boolean(hasTime))
    && (!lattice || puzzle.lattice.kind === lattice)
  ));
}
