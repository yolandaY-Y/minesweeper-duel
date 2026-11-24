import { buildField, openRegion, wholeNumber } from './BoardGeometry.js';

export default class SoloRound {
  constructor({ width, height, mineCount }) {
    this.width = wholeNumber(width, 5, 30, 'Width');
    this.height = wholeNumber(height, 5, 24, 'Height');
    const size = width * height;
    this.mineCount = wholeNumber(mineCount, 1, size - 1, 'Mines');
    this.board = Array(size).fill(null);
    this.safeLeft = size - mineCount;
    this.startedAt = this.endedAt = this.result = null;
  }

  open(index, now, flags) {
    if (this.result || !Number.isInteger(index) || index < 0 ||
        index >= this.board.length || this.board[index]) return false;
    if (this.startedAt === null) {
      this.values = buildField(this.width, this.height, this.mineCount, new Set([index]));
      this.startedAt = now;
    }
    if (this.values[index] === -1) {
      this.board[index] = { value: -1, owner: null };
      this.result = 'mine';
    } else {
      this.safeLeft -= openRegion(index, this.width, this.height, this.values, this.board, null, flags);
      if (this.safeLeft === 0) this.result = 'cleared';
    }
    if (this.result) {
      this.endedAt = now;
      this.mineLocations = this.values.flatMap((value, i) => value === -1 ? [i] : []);
    }
    return true;
  }

  elapsed(now) {
    return this.startedAt === null ? 0 : (this.endedAt ?? now) - this.startedAt;
  }
}
