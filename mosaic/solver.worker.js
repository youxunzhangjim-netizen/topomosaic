import { forcedMoves, solvePuzzle } from './core/solver.js';

self.addEventListener('message', (event) => {
  const { id, type, payload, state, options } = event.data || {};
  try {
    let result;
    if (type === 'hint') result = forcedMoves(payload, state);
    else if (type === 'solve' || type === 'validate') result = solvePuzzle(payload, state, options);
    else throw new Error(`Unknown worker request type: ${type}`);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
