const PREFIX = 'topomosaic:v1:';

export function loadProgress(puzzle) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${puzzle.id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.schema !== 'topomosaic.progress.v1') return null;
    if (!Array.isArray(parsed.state) || parsed.state.length !== puzzle.solution.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(puzzle, data) {
  const payload = {
    schema: 'topomosaic.progress.v1',
    puzzleId: puzzle.id,
    savedAt: new Date().toISOString(),
    ...data,
  };
  try {
    localStorage.setItem(`${PREFIX}${puzzle.id}`, JSON.stringify(payload));
  } catch {
    // Local storage may be unavailable in private or restricted contexts.
  }
  window.dispatchEvent(new CustomEvent('topomosaic:progress', { detail: payload }));
}

export function clearProgress(puzzle) {
  try {
    localStorage.removeItem(`${PREFIX}${puzzle.id}`);
  } catch {
    // Ignore storage failures.
  }
}
