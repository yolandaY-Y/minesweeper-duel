import { buildField, neighbors, openRegion, wholeNumber } from './BoardGeometry.js';

export const PRESETS = {
  easy: { width: 8, height: 8, mineCount: 6 },
  standard: { width: 9, height: 9, mineCount: 12 },
  hard: { width: 16, height: 16, mineCount: 40 },
};

export const DEFAULT_PENALTY_SECONDS = 5;
export const DEFAULT_TIME_SECONDS = 90;

// Leave nine opening clues and at least one safe square to play.
export function maxMineCount(width, height) {
  return width * height - 10;
}

export default class DuelRound {
  constructor(id, now, settings = {}) {
    const options = { ...PRESETS.standard, timeSeconds: DEFAULT_TIME_SECONDS,
      penaltySeconds: DEFAULT_PENALTY_SECONDS, ...settings };
    this.id = id;
    this.width = wholeNumber(options.width, 5, 30, 'Width');
    this.height = wholeNumber(options.height, 5, 24, 'Height');
    const size = this.width * this.height;
    this.mineCount = wholeNumber(options.mineCount, 1, maxMineCount(this.width, this.height), 'Mines');
    this.timeSeconds = wholeNumber(options.timeSeconds, 1, 3600, 'Round time');
    this.penaltySeconds = wholeNumber(options.penaltySeconds, 1, 30, 'Bomb freeze');
    this.endsAt = now + this.timeSeconds * 1000;
    this.safeLeft = size - this.mineCount;
    this.penalties = [null, null];
    this.result = null;

    const center = Math.floor(this.height / 2) * this.width + Math.floor(this.width / 2);
    const opening = new Set([center, ...neighbors(center, this.width, this.height)]);
    this.values = buildField(this.width, this.height, this.mineCount, opening);
    this.board = Array(size).fill(null);
    for (const index of opening) this.board[index] = { value: this.values[index], owner: null };
    this.safeLeft -= opening.size;
  }

  expire(now) {
    if (this.result || now < this.endsAt) return false;
    this.result = 'time';
    return true;
  }

  move(player, request, now) {
    if (this.expire(now)) return true;
    if (this.result || this.penalties[player]?.until > now || request?.round !== this.id) return false;
    const { index, action } = request;
    if (!Number.isInteger(index) || index < 0 || index >= this.board.length) return false;
    if (action !== 'open' || this.board[index]) return false;

    if (this.values[index] === -1) {
      this.board[index] = { value: -1, owner: player };
      this.penalties[player] = { index, until: now + this.penaltySeconds * 1000 };
      return true;
    }

    this.safeLeft -= openRegion(index, this.width, this.height, this.values, this.board, player);
    if (this.safeLeft === 0) this.result = 'cleared';
    return true;
  }

  snapshot(now) {
    const stats = [0, 1].map(() => ({ safe: 0, bombs: 0 }));
    for (const cell of this.board) {
      if (cell && cell.owner !== null) {
        if (cell.value === -1) stats[cell.owner].bombs++;
        else stats[cell.owner].safe++;
      }
    }
    return {
      round: this.id, width: this.width, height: this.height, mineCount: this.mineCount,
      timeSeconds: this.timeSeconds, penaltySeconds: this.penaltySeconds,
      board: this.board, stats, scores: stats.map(s => s.safe - s.bombs),
      result: this.result,
      // Each browser can check its own remaining flags once play is over.
      ...(this.result && { mineLocations: this.values.flatMap((v, i) => v === -1 ? [i] : []) }),
      timeLeft: Math.max(0, this.endsAt - now),
      penalties: this.penalties.map(penalty => {
        if (!penalty || penalty.until <= now || this.result) return null;
        return { index: penalty.index, timeLeft: penalty.until - now };
      }),
    };
  }
}
