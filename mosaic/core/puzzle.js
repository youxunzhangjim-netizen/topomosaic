import { EMPTY, UNKNOWN, encodeRuns } from './clues.js';
import { buildLattice } from './lattices.js';

function normalizePalette(palette) {
  const ids = new Set();
  return palette.map((entry, index) => {
    const id = Number(entry.id ?? index + 1);
    if (!Number.isInteger(id) || id <= 0) throw new Error(`Palette id must be a positive integer: ${id}`);
    if (ids.has(id)) throw new Error(`Duplicate palette id: ${id}`);
    ids.add(id);
    return {
      id,
      key: entry.key || String(id),
      name: entry.name || `Color ${id}`,
      color: entry.color || '#ffffff',
      pattern: entry.pattern || 'solid',
    };
  });
}

export function createPuzzle(spec) {
  if (!spec?.id) throw new Error('Puzzle spec requires an id.');
  const lattice = buildLattice(spec.lattice, spec.board);
  const palette = normalizePalette(spec.palette || []);
  const frameCount = Math.max(1, Number(spec.frames || 1));
  const variableCount = lattice.cells.length * frameCount;
  const solution = Array(variableCount).fill(EMPTY);
  const semanticPartByVariable = Array(variableCount).fill(null);

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const cell of lattice.cells) {
      const variableId = frame * lattice.cells.length + cell.index;
      const result = spec.solution?.({ cell, frame, frameCount, lattice }) ?? EMPTY;
      const value = typeof result === 'object' ? result.colorId : result;
      const semanticPartId = typeof result === 'object' ? result.semanticPartId || null : null;
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid solution value ${value} at frame ${frame}, cell ${cell.key}.`);
      }
      if (value > 0 && !palette.some((entry) => entry.id === value)) {
        throw new Error(`Solution uses unknown palette id ${value}.`);
      }
      solution[variableId] = value;
      semanticPartByVariable[variableId] = semanticPartId;
    }
  }

  const tracks = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const baseTrack of lattice.tracks) {
      const variables = baseTrack.cells.map((cellIndex) => frame * lattice.cells.length + cellIndex);
      tracks.push({
        id: `space:${frame}:${baseTrack.id}`,
        type: 'space',
        frame,
        baseTrackId: baseTrack.id,
        family: baseTrack.family,
        familyLabel: baseTrack.familyLabel,
        lineLabel: baseTrack.lineLabel,
        cells: baseTrack.cells.slice(),
        variables,
        clues: encodeRuns(variables.map((variableId) => solution[variableId])),
      });
    }
  }

  if (frameCount > 1) {
    for (const cell of lattice.cells) {
      const variables = Array.from(
        { length: frameCount },
        (_, frame) => frame * lattice.cells.length + cell.index,
      );
      tracks.push({
        id: `time:${cell.index}`,
        type: 'time',
        frame: null,
        baseTrackId: null,
        family: 'time',
        familyLabel: 'Time',
        lineLabel: `T @ ${cell.key}`,
        cells: [cell.index],
        variables,
        clues: encodeRuns(variables.map((variableId) => solution[variableId])),
      });
    }
  }

  const givens = Array(variableCount).fill(false);
  const givenRule = spec.given || (() => false);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const cell of lattice.cells) {
      const variableId = frame * lattice.cells.length + cell.index;
      givens[variableId] = Boolean(givenRule({ cell, frame, frameCount, lattice, solutionValue: solution[variableId] }));
    }
  }

  const tracksByVariable = Array.from({ length: variableCount }, () => []);
  for (const track of tracks) {
    for (const variableId of track.variables) tracksByVariable[variableId].push(track.id);
  }

  return {
    schema: 'topomosaic.puzzle.v1',
    id: spec.id,
    title: spec.title || spec.id,
    titleZh: spec.titleZh || spec.title || spec.id,
    description: spec.description || '',
    descriptionZh: spec.descriptionZh || spec.description || '',
    difficulty: spec.difficulty || 'Starter',
    dimension: lattice.dimension,
    hasTime: frameCount > 1,
    frameCount,
    lattice,
    palette,
    solution,
    givens,
    tracks,
    tracksByVariable,
    semanticParts: spec.semanticParts || [],
    semanticPartByVariable,
    educationalNote: spec.educationalNote || '',
    educationalNoteZh: spec.educationalNoteZh || spec.educationalNote || '',
    camera: spec.camera || null,
  };
}

export function createInitialState(puzzle) {
  return puzzle.solution.map((value, variableId) => (puzzle.givens[variableId] ? value : UNKNOWN));
}

export function variableIdFor(puzzle, frame, cellIndex) {
  return frame * puzzle.lattice.cells.length + cellIndex;
}

export function decodeVariableId(puzzle, variableId) {
  const cellCount = puzzle.lattice.cells.length;
  return {
    frame: Math.floor(variableId / cellCount),
    cellIndex: variableId % cellCount,
  };
}

export function isComplete(puzzle, state) {
  return state.length === puzzle.solution.length
    && state.every((value, index) => value === puzzle.solution[index]);
}

export function puzzleProgress(puzzle, state) {
  let decided = 0;
  let correct = 0;
  for (let index = 0; index < state.length; index += 1) {
    if (state[index] !== UNKNOWN) decided += 1;
    if (state[index] === puzzle.solution[index]) correct += 1;
  }
  return {
    decided,
    correct,
    total: state.length,
    decidedRatio: state.length ? decided / state.length : 0,
    correctRatio: state.length ? correct / state.length : 0,
  };
}

export function trackIsSatisfied(track, state) {
  return track.variables.every((variableId) => state[variableId] !== UNKNOWN)
    && encodeRuns(track.variables.map((variableId) => state[variableId]))
      .every((run, index) => {
        const expected = track.clues[index];
        return expected && expected.colorId === run.colorId && expected.length === run.length;
      })
    && encodeRuns(track.variables.map((variableId) => state[variableId])).length === track.clues.length;
}

export function solverPayload(puzzle) {
  return {
    variableCount: puzzle.solution.length,
    paletteIds: puzzle.palette.map((entry) => entry.id),
    tracks: puzzle.tracks.map((track) => ({
      id: track.id,
      variables: track.variables,
      clues: track.clues,
    })),
    givens: puzzle.givens.map((given, variableId) => (given ? puzzle.solution[variableId] : UNKNOWN)),
  };
}
