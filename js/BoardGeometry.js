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
