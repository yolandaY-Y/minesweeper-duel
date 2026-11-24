import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter, once } from 'node:events';
import { neighbors } from '../js/BoardGeometry.js';
import DuelRound, { PRESETS } from '../js/DuelRound.js';
import TabRoom from '../js/TabRoom.js';

const move = (round, index, action = 'open') => ({ round: round.id, index, action });
const coveredSafe = round => round.values.findIndex((n, i) => n > 0 && !round.board[i]);

test('presets and custom rectangles have exact mine counts, neutral clues and correct diagonals', () => {
  for (const settings of [...Object.values(PRESETS), { width: 14, height: 6, mineCount: 15 },
    { width: 30, height: 24, mineCount: 710 }, { width: 5, height: 5, mineCount: 1 }]) {
    const { width, height, mineCount } = settings;
    for (let iteration = 0; iteration < 8; iteration++) {
      const round = new DuelRound(iteration, 0, settings);
      assert.equal(round.board.length, width * height);
      assert.equal(round.values.filter(v => v === -1).length, mineCount);
      assert.equal(round.board.filter(Boolean).length, 9);
      assert.ok(round.board.filter(Boolean).every(c => c.owner === null && c.value >= 0));
      for (const [i, v] of round.values.entries()) {
        if (v >= 0) assert.equal(v, neighbors(i, width, height).filter(j => round.values[j] === -1).length);
      }
      assert.equal('values' in round.snapshot(0), false);
    }
  }
});

test('first safe claim wins the race, repeat clicks do not score', () => {
  const round = new DuelRound(1, 0);
  const request = move(round, coveredSafe(round));
  assert.equal(round.move(1, request, 1), true);
  assert.equal(round.move(0, request, 1), false);
  assert.equal(round.move(1, request, 2), false);
  assert.deepEqual(round.snapshot(2).scores, [0, 1]);
});

test('the shared round ignores flag requests from either player', () => {
  const round = new DuelRound(1, 0);
  const safe = coveredSafe(round);
  const mine = round.values.indexOf(-1);
  const before = structuredClone(round.snapshot(1));
  for (const player of [0, 1]) {
    for (const index of [safe, mine]) {
      for (const action of ['flag', 'unflag']) {
        assert.equal(round.move(player, move(round, index, action), 1), false);
      }
    }
  }
  assert.deepEqual(round.snapshot(1), before);
  assert.equal('mineLocations' in before, false);
  assert.ok(round.move(1, move(round, safe), 2));
  assert.ok(round.move(0, move(round, mine), 2));
  assert.deepEqual(round.snapshot(2).scores, [-1, 1]);
});

test('automatic openings reveal shared clues and score only the clicked square', () => {
  const round = new DuelRound(1, 0, { mineCount: 1 });
  const zeroes = round.values.flatMap((n,i) => n === 0 && !round.board[i] ? [i] : []);
  const start = zeroes.find(i => neighbors(i, round.width, round.height).some(j => zeroes.includes(j)));
  const adjacent = neighbors(start, round.width, round.height).find(j => zeroes.includes(j));
  round.move(1, move(round, start), 2);
  const state = round.snapshot(2);
  assert.deepEqual(state.board[adjacent], { value: 0, owner: null });
  assert.ok(state.board.filter(c => c?.owner === null).length > 9);
  assert.deepEqual(state.scores, [0, 1]);
});

test('hitting a bomb costs one point exactly once; only the hitter freezes', () => {
  const round = new DuelRound(1, 0, { penaltySeconds: 8 });
  const mine = round.values.indexOf(-1);
  const safe = coveredSafe(round);
  round.move(1, move(round, mine), 100);
  const state = round.snapshot(225);
  assert.deepEqual(state.board[mine], { value: -1, owner: 1 });
  assert.deepEqual(state.penalties, [null, { index: mine, timeLeft: 7875 }]);
  assert.deepEqual(state.scores, [0, -1]);
  assert.ok(round.move(0, move(round, safe), 300));
  assert.equal(round.move(1, move(round, coveredSafe(round)), 8099), false);
  assert.equal(round.move(1, move(round, mine), 8100), false);
  assert.ok(round.move(1, move(round, coveredSafe(round)), 8100));
  assert.deepEqual(round.snapshot(8100).scores, [1, 0]);
});

test('timeout preserves scores and releases the mine locations for private review', () => {
  const round = new DuelRound(2, 500, { timeSeconds: 7, penaltySeconds: 1 });
  const mines = round.values.flatMap((v, i) => v === -1 ? [i] : []);
  round.move(1, move(round, mines[0]), 503);
  round.move(0, move(round, coveredSafe(round)), 504);
  const before = round.snapshot(7499);
  assert.deepEqual(before.scores, [1, -1]);
  assert.equal('mineLocations' in before, false);
  assert.equal(round.expire(7499), false);
  assert.equal(round.move(0, move(round, coveredSafe(round)), 7500), true);
  const state = round.snapshot(7500);
  assert.equal(state.result, 'time');
  assert.equal(state.timeLeft, 0);
  assert.deepEqual(state.scores, before.scores);
  assert.deepEqual(state.stats, [{safe:1,bombs:0},{safe:0,bombs:1}]);
  assert.deepEqual(state.mineLocations, mines);
});

test('opening every safe square finishes the game with just safe opens and bomb hits scored', () => {
  const round = new DuelRound(5, 0);
  let opens = 0;
  round.values.forEach((v,i) => { if (v >= 0 && round.move(0, move(round,i), 2)) opens++; });
  const state = round.snapshot(3);
  assert.equal(state.result, 'cleared');
  assert.deepEqual(state.scores, [opens, 0]);
  assert.ok(state.timeLeft > 0);
  assert.equal(state.board.filter(c => c === null).length, round.mineCount);
  assert.equal(state.mineLocations.length, round.mineCount);
});

test('custom settings validate the opening area, dimensions and time intervals', () => {
  for (const settings of [{width:4}, {height:25}, {mineCount:0}, {width:5,height:5,mineCount:16},
    {timeSeconds:0}, {timeSeconds:3601}, {timeSeconds:3.5}, {penaltySeconds:31}]) {
    assert.throws(() => new DuelRound(0, 0, settings), RangeError);
  }
  assert.equal(new DuelRound(0, 0).timeSeconds, 90);
  assert.equal(new DuelRound(0, 0).penaltySeconds, 5);
  assert.equal(new DuelRound(0, 0, {timeSeconds:3600}).endsAt, 3600000);
});

test('rematches reject moves left over from the previous round', () => {
  const round = new DuelRound(2, 0);
  assert.equal(round.move(0, { ...move(round, coveredSafe(round)), round: 1 }, 1), false);
});

test('two peers share moves and results, reject a third player, and detect departure', { timeout: 3000 }, async t => {
  const signal = new EventEmitter();
  const room = name => {
    const channel = new TabRoom({
      created: () => {}, joined: () => signal.emit(name + '-joined'),
      message: data => signal.emit(name + '-message', data),
      lost: reason => signal.emit(name + '-lost', reason),
    });
    t.after(() => channel.close());
    return channel;
  };
  const host = room('host'), guest = room('guest'), extra = room('extra');
  const joined = Promise.all([once(signal, 'host-joined'), once(signal, 'guest-joined')]);
  const code = String(process.pid);
  host.open(true, code);
  guest.open(false, code);
  await joined;
  const full = once(signal, 'extra-lost');
  extra.open(false, code);
  assert.deepEqual(await full, ['full']);
  const round = new DuelRound(1, 0);
  const request = move(round, coveredSafe(round));
  const requestAtHost = once(signal, 'host-message');
  guest.send(request);
  const [received] = await requestAtHost;
  round.move(1, received, 10);
  const stateAtGuest = once(signal, 'guest-message');
  host.send(round.snapshot(10));
  const [state] = await stateAtGuest;
  assert.deepEqual(state.scores, [0, 1]);
  assert.equal(state.board[request.index].owner, 1);
  const left = once(signal, 'host-lost');
  guest.close();
  assert.deepEqual(await left, ['disconnected']);
});
