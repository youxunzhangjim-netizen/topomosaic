export const UNKNOWN = -1;
export const EMPTY = 0;

export function encodeRuns(values) {
  const runs = [];
  let color = EMPTY;
  let length = 0;

  for (const value of values) {
    if (value === EMPTY) {
      if (color !== EMPTY) runs.push({ colorId: color, length });
      color = EMPTY;
      length = 0;
      continue;
    }

    if (value === color) {
      length += 1;
      continue;
    }

    if (color !== EMPTY) runs.push({ colorId: color, length });
    color = value;
    length = 1;
  }

  if (color !== EMPTY) runs.push({ colorId: color, length });
  return runs;
}

export function minimumLineLength(clues) {
  if (!clues.length) return 0;
  let total = clues.reduce((sum, run) => sum + run.length, 0);
  for (let index = 1; index < clues.length; index += 1) {
    if (clues[index - 1].colorId === clues[index].colorId) total += 1;
  }
  return total;
}

export function generateLinePatterns(length, clues) {
  if (!Number.isInteger(length) || length < 0) {
    throw new TypeError(`Line length must be a non-negative integer, received ${length}.`);
  }
  if (!Array.isArray(clues)) throw new TypeError('Clues must be an array.');
  if (!clues.length) return [Array(length).fill(EMPTY)];
  if (minimumLineLength(clues) > length) return [];

  const pattern = Array(length).fill(EMPTY);
  const results = [];

  function remainingMinimum(fromIndex) {
    let total = 0;
    for (let index = fromIndex; index < clues.length; index += 1) {
      total += clues[index].length;
      if (index > fromIndex && clues[index - 1].colorId === clues[index].colorId) total += 1;
    }
    return total;
  }

  function place(runIndex, cursor) {
    if (runIndex >= clues.length) {
      results.push(pattern.slice());
      return;
    }

    const run = clues[runIndex];
    const nextMinimum = runIndex + 1 < clues.length
      ? remainingMinimum(runIndex + 1)
        + (run.colorId === clues[runIndex + 1].colorId ? 1 : 0)
      : 0;
    const maxStart = length - run.length - nextMinimum;

    for (let start = cursor; start <= maxStart; start += 1) {
      let free = true;
      for (let offset = 0; offset < run.length; offset += 1) {
        if (pattern[start + offset] !== EMPTY) {
          free = false;
          break;
        }
      }
      if (!free) continue;

      for (let offset = 0; offset < run.length; offset += 1) {
        pattern[start + offset] = run.colorId;
      }

      const sameColorGap = runIndex + 1 < clues.length
        && run.colorId === clues[runIndex + 1].colorId
        ? 1
        : 0;
      place(runIndex + 1, start + run.length + sameColorGap);

      for (let offset = 0; offset < run.length; offset += 1) {
        pattern[start + offset] = EMPTY;
      }
    }
  }

  place(0, 0);
  return results;
}

export function clueSignature(clues) {
  return clues.map((run) => `${run.colorId}:${run.length}`).join('|');
}
