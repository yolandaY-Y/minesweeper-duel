import assert from 'node:assert/strict';
import test from 'node:test';
import SoloRound from '../js/SoloRound.js';
import { PRESETS } from '../js/DuelRound.js';

test('the first open is safe anywhere, even with only one safe square', () => {
  for (const index of [0, 2, 12, 24]) {
    const round = new SoloRound({ width: 5, height: 5, mineCount: 24 });
    const flags = new Set([index]);
    assert.ok(round.board.every(cell => cell === null));
    assert.equal(round.elapsed(7000), 0);
    assert.ok(round.open(index, 7500, flags));
    assert.equal(round.board[index].value, [0, 24].includes(index) ? 3 : index === 2 ? 5 : 8);
    assert.equal(round.mineLocations.length, 24);
    assert.equal(round.result, 'cleared');
    assert.equal(round.elapsed(9000), 0);
  }
});

test('a flagged mine can be opened directly and the timer stops on loss', () => {
  const round = new SoloRound(PRESETS.hard);
  const flags = new Set(Array.from({ length: round.board.length }, (_, i) => i));
  assert.ok(round.open(0, 100, flags));
  assert.equal(round.elapsed(3300), 3200);
  const mine = round.values.indexOf(-1);
  assert.ok(round.open(mine, 3456, flags));
  assert.equal(round.result, 'mine');
  assert.equal(round.board[mine].value, -1);
  assert.equal(round.elapsed(90000), 3356);
  assert.equal(round.open(1, 5000, flags), false);
});

test('blank openings respect other flags and all safe opens win without flagging mines', () => {
  const round = new SoloRound({ width: 8, height: 8, mineCount: 1 });
  const flags = new Set(Array.from({ length: 64 }, (_, i) => i));
  round.open(0, 0, flags);
  assert.equal(round.board.filter(Boolean).length, 1);
  flags.clear();
  const zero = round.values.findIndex((v, i) => v === 0 && !round.board[i]);
  round.open(zero, 2000, flags);
  assert.ok(round.board.filter(Boolean).length > 2);
  round.values.forEach((v, i) => { if (v >= 0) round.open(i, 2000, flags); });
  assert.equal(round.result, 'cleared');
  assert.equal(round.elapsed(7000), 2000);
  assert.equal(round.board.filter(cell => cell === null).length, 1);
  assert.ok(new SoloRound(PRESETS.easy).board.every(cell => cell === null));
});

test('invalid solo settings and requests cannot start a round', () => {
  for (const invalid of [{ mineCount: 25 }, { mineCount: 0 }, { width: 4 }, { height: 25 }]) {
    assert.throws(() => new SoloRound({ width: 5, height: 5, mineCount: 1, ...invalid }), RangeError);
  }
  const round = new SoloRound(PRESETS.standard);
  for (const index of [-1, 81, 1.5]) assert.equal(round.open(index, 1), false);
  assert.equal(round.startedAt, null);
});
