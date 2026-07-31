import { buildCatalog } from '../mosaic/data/puzzles.js';
import { createInitialState, solverPayload } from '../mosaic/core/puzzle.js';
import { solvePuzzle, forcedMoves } from '../mosaic/core/solver.js';

let failed = false;
const rows = [];
for (const puzzle of buildCatalog()) {
  const initial = createInitialState(puzzle);
  const payload = solverPayload(puzzle);
  const start = performance.now();
  const result = solvePuzzle(payload, initial, { maxSolutions: 2, maxNodes: 500_000 });
  const elapsed = Math.round(performance.now() - start);
  const hint = forcedMoves(payload, initial);
  const matches = result.firstSolution
    ? result.firstSolution.every((value, index) => value === puzzle.solution[index])
    : false;
  const status = result.unique && matches ? 'PASS' : 'CHECK';
  if (status !== 'PASS') failed = true;
  rows.push({
    status,
    puzzle: puzzle.id,
    variables: puzzle.solution.length,
    tracks: puzzle.tracks.length,
    givens: puzzle.givens.filter(Boolean).length,
    forcedAtStart: hint.ok ? hint.moves.length : 0,
    solutions: result.solutionCount,
    unique: result.unique,
    matches,
    nodes: result.nodes,
    limited: result.stoppedByLimit,
    ms: elapsed,
  });
}
console.table(rows);
if (failed) process.exitCode = 1;
