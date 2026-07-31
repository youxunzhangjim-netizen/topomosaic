import { EMPTY, UNKNOWN, generateLinePatterns } from './clues.js';

function popcount(value) {
  let count = 0;
  let current = value >>> 0;
  while (current) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

function singleValue(mask) {
  if (mask === 0 || (mask & (mask - 1)) !== 0) return null;
  return Math.round(Math.log2(mask));
}

function allValueMask(paletteIds) {
  let mask = 1 << EMPTY;
  for (const id of paletteIds) {
    if (id > 30) throw new Error('The V1 bitmask solver supports color ids up to 30.');
    mask |= 1 << id;
  }
  return mask;
}

function createDomains(payload, state) {
  const mask = allValueMask(payload.paletteIds);
  const domains = Array(payload.variableCount).fill(mask);
  const initial = state || payload.givens || [];
  for (let index = 0; index < payload.variableCount; index += 1) {
    const value = initial[index] ?? UNKNOWN;
    if (value !== UNKNOWN) domains[index] = 1 << value;
  }
  return domains;
}

function precomputePatterns(payload) {
  return payload.tracks.map((track) => ({
    ...track,
    patterns: generateLinePatterns(track.variables.length, track.clues),
  }));
}

function propagate(domains, preparedTracks) {
  let changed = true;
  let rounds = 0;
  const candidates = new Map();

  while (changed) {
    changed = false;
    rounds += 1;
    if (rounds > 10_000) return { ok: false, reason: 'Propagation safety limit reached.' };

    for (const track of preparedTracks) {
      const valid = track.patterns.filter((pattern) => pattern.every(
        (value, offset) => (domains[track.variables[offset]] & (1 << value)) !== 0,
      ));
      if (!valid.length) return { ok: false, reason: `No valid pattern for ${track.id}.` };
      candidates.set(track.id, valid);

      for (let offset = 0; offset < track.variables.length; offset += 1) {
        let allowed = 0;
        for (const pattern of valid) allowed |= 1 << pattern[offset];
        const variableId = track.variables[offset];
        const next = domains[variableId] & allowed;
        if (next === 0) return { ok: false, reason: `Domain emptied at variable ${variableId}.` };
        if (next !== domains[variableId]) {
          domains[variableId] = next;
          changed = true;
        }
      }
    }
  }

  return { ok: true, domains, candidates, rounds };
}

export function forcedMoves(payload, state) {
  const preparedTracks = precomputePatterns(payload);
  const domains = createDomains(payload, state);
  const result = propagate(domains, preparedTracks);
  if (!result.ok) return { ok: false, contradiction: result.reason, moves: [] };

  const moves = [];
  for (let variableId = 0; variableId < domains.length; variableId += 1) {
    const current = state?.[variableId] ?? payload.givens?.[variableId] ?? UNKNOWN;
    if (current !== UNKNOWN) continue;
    const value = singleValue(domains[variableId]);
    if (value !== null) moves.push({ variableId, value });
  }
  return { ok: true, moves, rounds: result.rounds, domains };
}

export function solvePuzzle(payload, state, { maxSolutions = 2, maxNodes = 200_000 } = {}) {
  const preparedTracks = precomputePatterns(payload);
  const startDomains = createDomains(payload, state);
  const solutions = [];
  let nodes = 0;
  let stoppedByLimit = false;

  function search(inputDomains) {
    if (solutions.length >= maxSolutions || stoppedByLimit) return;
    nodes += 1;
    if (nodes > maxNodes) {
      stoppedByLimit = true;
      return;
    }

    const domains = inputDomains.slice();
    const result = propagate(domains, preparedTracks);
    if (!result.ok) return;

    let branchVariable = -1;
    let branchCount = Infinity;
    for (let index = 0; index < domains.length; index += 1) {
      const count = popcount(domains[index]);
      if (count > 1 && count < branchCount) {
        branchCount = count;
        branchVariable = index;
      }
    }

    if (branchVariable < 0) {
      solutions.push(domains.map((mask) => singleValue(mask)));
      return;
    }

    const mask = domains[branchVariable];
    for (let value = 0; value <= 30; value += 1) {
      if ((mask & (1 << value)) === 0) continue;
      const next = domains.slice();
      next[branchVariable] = 1 << value;
      search(next);
      if (solutions.length >= maxSolutions || stoppedByLimit) break;
    }
  }

  search(startDomains);
  return {
    solutionCount: solutions.length,
    firstSolution: solutions[0] || null,
    unique: solutions.length === 1 && !stoppedByLimit,
    nodes,
    stoppedByLimit,
  };
}
