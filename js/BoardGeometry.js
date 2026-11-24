export function neighbors(index, width, height) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result = [];
  for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row++) {
    for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col++) {
      const next = row * width + col;
      if (next !== index) result.push(next);
    }
  }
  return result;
}

export function chooseMines(size, count, safe) {
  const candidates = Array.from({ length: size }, (_, i) => i).filter(i => !safe.has(i));
  for (let i = 0; i < count && i < candidates.length; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

export function wholeNumber(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' must be a whole number from ' + min + ' to ' + max + '.');
  }
  return value;
}

export function buildField(width, height, mineCount, safe) {
  const size = width * height;
  const mines = new Set(chooseMines(size, mineCount, safe));
  return Array.from({ length: size }, (_, index) => mines.has(index) ? -1 :
    neighbors(index, width, height).filter(next => mines.has(next)).length);
}

// The deliberate open can claim a square. Squares reached from a blank are neutral.
export function openRegion(index, width, height, values, board, owner, flags) {
  const queue = [index];
  board[index] = { value: values[index], owner };
  let opened = 1;
  while (queue.length) {
    const current = queue.pop();
    if (values[current] !== 0) continue;
    for (const next of neighbors(current, width, height)) {
      if (board[next] || flags?.has(next)) continue;
      board[next] = { value: values[next], owner: null };
      opened++;
      if (values[next] === 0) queue.push(next);
    }
  }
  return opened;
}
