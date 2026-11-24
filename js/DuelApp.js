import DuelRound, { DEFAULT_PENALTY_SECONDS, PRESETS, maxMineCount } from './DuelRound.js';
import PeerRoom from './PeerRoom.js';
import TabRoom from './TabRoom.js';
import Tile from './Tile.js';

const byId = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const practiceMode = params.get('practice') === '1';
let room, round, view, tiles = [], host = false, connected = false;
let selected = 'open', receivedAt = 0, timeout, ticker;
let revision = 0;
let markedTile = null;
const privateFlags = new Set();
if (practiceMode) byId('play-heading').textContent = 'Practice mode · two tabs';
const suggestedCode = params.get('room');
if (/^\d{6}$/.test(suggestedCode ?? '')) byId('code').value = suggestedCode;

function reset(message = '') {
  const oldRoom = room;
  room = null;
  oldRoom?.close();
  clearTimeout(timeout);
  clearInterval(ticker);
  round = view = null;
  connected = false;
  tiles = [];
  privateFlags.clear();
  markedTile = null;
  byId('board').replaceChildren();
  byId('lobby-settings').append(byId('round-settings'));
  byId('round-settings').hidden = true;
  byId('lobby-guide').append(byId('rulebook'));
  byId('guide-duration').textContent = 'The default freeze is ' + DEFAULT_PENALTY_SECONDS + ' seconds.';
  byId('match').hidden = byId('waiting').hidden = true;
  byId('lobby').hidden = byId('setup').hidden = false;
  byId('error').textContent = message;
  byId('error').hidden = !message;
}

const errors = {
  'peer-unavailable': 'Room not found. Check the six-digit code and try again.',
  'unavailable-id': 'That room code is taken. Create a new room.',
  full: 'That room already has two players.',
  disconnected: 'Your opponent disconnected. Create or join a room to play again.',
};

async function enter(isHost, code) {
  reset();
  host = isHost;
  byId('waiting').hidden = false;
  byId('setup').hidden = true;
  byId('room-code').textContent = '';
  byId('round-settings').hidden = !isHost;
  byId('code-label').hidden = byId('practice').hidden = byId('start').hidden = true;
  byId('wait-title').textContent = isHost ? 'Create a room' : 'Join a room';
  byId('wait-detail').textContent = isHost ? 'Creating room…' : 'Connecting to your opponent…';

  const events = {
    created(id) {
      if (room !== session) return;
      clearTimeout(timeout);
      byId('wait-title').textContent = 'Your room';
      byId('code-label').hidden = false;
      byId('room-code').textContent = id;
      byId('wait-detail').textContent = practiceMode ? 'Join this room in a second tab in the same browser.' : 'Share this code. Player 2 can join from the same game website.';
      if (practiceMode) {
        byId('practice').hidden = false;
        byId('practice').href = '?practice=1&room=' + id;
      }
    },
    joined() {
      if (room !== session) return;
      clearTimeout(timeout);
      connected = true;
      byId('practice').hidden = true;
      byId('wait-title').textContent = 'Both players connected';
      byId('wait-detail').textContent = host ? 'You are Player 1. Start when you are both ready.' : 'You are Player 2. Waiting for Player 1 to start.';
      byId('start').hidden = !host;
    },
    message(packet) {
      if (room !== session || !connected || !packet) return;
      if (host && packet.type === 'move') applyMove(1, packet);
      if (!host && packet.type === 'state') showState(packet.state);
    },
    lost(reason) {
      if (room !== session) return;
      reset(errors[reason] || (practiceMode ? 'Could not connect. Open both tabs in the same browser and try again.' : 'Could not connect. Check your network and try again.'));
    },
  };
  // Online rooms use the PeerJS signaling service and a separate duel ID namespace.
  const session = practiceMode ? new TabRoom(events) : new PeerRoom(events, '-minesweeper-duel-v4', {});
  room = session;
  timeout = setTimeout(() => {
    if (session === room) reset(practiceMode ? 'Room not found. Use the same browser and site in both tabs.' : 'Connection timed out. Check the code and network, then try again.');
  }, practiceMode ? 6000 : 25000);
  try { await session.open(isHost, code); }
  catch { events.lost('connection-error'); }
}

function updateMineLimit() {
  const width = byId('board-width').valueAsNumber;
  const height = byId('board-height').valueAsNumber;
  if (!byId('board-width').validity.valid || !byId('board-height').validity.valid) {
    byId('mine-limit').textContent = 'Choose 5–30 columns and 5–24 rows.';
    return;
  }
  const max = maxMineCount(width, height);
  byId('board-mines').max = String(max);
  byId('mine-limit').textContent = 'Choose 1–' + max + ' mines.';
}

function startRound() {
  if (!host || !connected || (round && !round.result)) return;
  if (!byId('round-settings').reportValidity()) return;
  const board = PRESETS[byId('difficulty').value] ?? {
    width: byId('board-width').valueAsNumber,
    height: byId('board-height').valueAsNumber,
    mineCount: byId('board-mines').valueAsNumber,
  };
  round = new DuelRound(++revision, performance.now(), {
    ...board,
    timeSeconds: byId('round-seconds').valueAsNumber,
    penaltySeconds: byId('penalty-seconds').valueAsNumber,
  });
  byId('round-settings').hidden = true;
  publish();
}

function publish() {
  const state = round.snapshot(performance.now());
  room.send({ type: 'state', state });
  showState(state);
}

function applyMove(player, request) {
  if (round?.move(player, request, performance.now())) publish();
}

function clickCell(index, action) {
  if (!view || view.result || view.board[index] || penaltyLeft(host ? 0 : 1) > 0) return;
  if (action === 'flag') {
    if (!privateFlags.delete(index)) privateFlags.add(index);
    renderCell(tiles[index], null, index, view);
    updateClock();
    return;
  }
  if (privateFlags.has(index)) return;
  const request = { type: 'move', round: view.round, index, action };
  if (host) applyMove(0, request);
  else room.send(request);
}

function setAction(action) {
  selected = action;
  for (const name of ['open', 'flag']) byId(name).setAttribute('aria-pressed', String(name === action));
}

function startBoard(state) {
  privateFlags.clear();
  byId('lobby').hidden = true;
  byId('match').hidden = false;
  byId('seat').textContent = 'You are Player ' + (host ? '1' : '2') + ' · ' +
    state.width + ' × ' + state.height + ' · ' + state.mineCount + ' mines · ' + state.timeSeconds + 's';
  byId('board').style.setProperty('--columns', state.width);
  byId('board-shell').classList.toggle('wide-board', state.width >= 15);
  byId('again').hidden = true;
  byId('match-guide').append(byId('rulebook'));
  markedTile = null;
  setAction('open');
  tiles = Array.from({ length: state.width * state.height }, (_, i) => {
    const tile = new Tile(true);
    tile.element.setAttribute('aria-label', cellLabel(i, state.width) + ', covered');
    tile.element.addEventListener('click', () => clickCell(i, selected));
    tile.element.addEventListener('contextmenu', e => {
      e.preventDefault();
      clickCell(i, 'flag');
    });
    return tile;
  });
  byId('board').replaceChildren(...tiles.map(tile => tile.element));
  clearInterval(ticker);
  ticker = setInterval(updateClock, 100);
}

function cellLabel(i, width) {
  return 'Row ' + (Math.floor(i / width) + 1) + ', column ' + (i % width + 1);
}

function renderCell(tile, cell, index, state) {
  const button = tile.element;
  // Unchanged cells can be skipped on both clients, including the host whose board is mutable.
  const flagged = privateFlags.has(index);
  const correct = flagged && state.result ? state.mineLocations.includes(index) : undefined;
  const stamp = flagged ? 'flag-' + (correct ?? 'pending')
    : cell ? 'open-' + cell.value + '-' + cell.owner : 'covered';
  button.disabled = Boolean(state.result || cell);
  if (button.dataset.state === stamp) return;
  button.dataset.state = stamp;
  delete button.dataset.owner;
  button.classList.remove('wrong-flag');
  if (tile.isFlagged) tile.unflagTile();
  let description = 'covered';
  if (flagged) {
    tile.flagTile(!host);
    button.dataset.owner = host ? 0 : 1;
    description = 'your flag';
    if (correct === undefined) {
      button.textContent = '⚑';
    } else {
      button.textContent = correct ? '⚑✓' : '⚑×';
      button.classList.toggle('wrong-flag', !correct);
      description += correct ? ', correct' : ', incorrect';
    }
  } else if (cell) {
    tile.isMine = cell.value === -1;
    tile.revealTile(cell.value);
    if (cell.owner !== null) button.dataset.owner = cell.owner;
    const owner = cell.owner === null ? 'shared clue' : 'Player ' + (cell.owner + 1);
    if (tile.isMine) description = 'exploded mine, ' + owner + ' lost one point';
    else description = cell.value + (cell.value === 1 ? ' neighboring mine, ' : ' neighboring mines, ') + owner;
  }
  button.setAttribute('aria-label', cellLabel(index, state.width) + ', ' + description);
}

function showState(next) {
  if (!next || !Number.isInteger(next.width) || !Number.isInteger(next.height) ||
      next.width < 5 || next.width > 30 || next.height < 5 || next.height > 24 ||
      next.board?.length !== next.width * next.height || next.stats?.length !== 2 ||
      next.scores?.length !== 2 || next.penalties?.length !== 2) return;
  if (!view || view.round !== next.round) {
    startBoard(next);
    const unit = next.penaltySeconds === 1 ? 'second' : 'seconds';
    byId('guide-duration').textContent = 'The freeze lasts ' + next.penaltySeconds + ' ' + unit + ' this round.';
  }
  view = next;
  receivedAt = performance.now();
  next.stats.forEach((stats, i) => {
    const seat = i + 1;
    byId('safe' + seat).textContent = stats.safe;
    byId('bombs' + seat).textContent = stats.bombs;
    byId('score' + seat).textContent = next.scores[i];
  });
  for (const [i, cell] of next.board.entries()) {
    if (cell) privateFlags.delete(i);
    renderCell(tiles[i], cell, i, next);
  }
  updateClock();
  if (next.result) {
    clearInterval(ticker);
    byId('again').hidden = !host;
    if (host) {
      byId('rematch-settings').append(byId('round-settings'));
      byId('round-settings').hidden = false;
    }
  }
}

function remaining(duration) {
  return Math.max(0, duration - (performance.now() - receivedAt));
}

function penaltyLeft(player) {
  return remaining(view.penalties[player]?.timeLeft ?? 0);
}

function updateClock() {
  if (!view) return;
  if (host && round?.expire(performance.now())) { publish(); return; }
  const ms = view.result ? view.timeLeft : remaining(view.timeLeft);
  const seconds = Math.ceil(ms / 1000);
  byId('clock').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  const player = host ? 0 : 1;
  const cooldown = Math.ceil(penaltyLeft(player) / 1000);
  const mistake = view.penalties[player];
  let state = 'ready';
  let status = selected === 'flag' ? 'Place or remove your flag' : 'Open a safe square';
  let count = '';
  if (view.result) {
    state = 'finished';
    const [a, b] = view.scores;
    const winner = a === b ? 'Tie game.' : 'Player ' + (a > b ? '1' : '2') + ' wins!';
    status = (view.result === 'time' ? 'Time is up. ' : 'Board complete. ') + winner;
    if (!host) status += ' Waiting for the host to start another round.';
  } else if (cooldown) {
    state = 'frozen';
    status = 'Bomb hit · −1 point · You’re frozen';
    count = cooldown + 's';
  } else if (penaltyLeft(1 - player) > 0) {
    status = 'Opponent frozen · Keep playing';
  }
  const target = state === 'frozen' ? tiles[mistake.index]?.element : null;
  if (markedTile && target !== markedTile) delete markedTile.dataset.countdown;
  if (target && target.dataset.countdown !== count) target.dataset.countdown = count;
  markedTile = target;
  const shell = byId('board-shell');
  if (shell.dataset.state !== state) shell.dataset.state = state;
  byId('board-inputs').disabled = state === 'frozen' || state === 'finished';
  const feedback = byId('feedback');
  if (feedback.textContent !== status) feedback.textContent = status;
  const counter = byId('board-count');
  if (counter.textContent !== count) counter.textContent = count;
}

byId('create').addEventListener('click', () => {
  const [random] = crypto.getRandomValues(new Uint32Array(1));
  enter(true, String(100000 + random % 900000));
});
byId('join-form').addEventListener('submit', event => {
  event.preventDefault();
  const code = byId('code').value.trim();
  if (/^\d{6}$/.test(code)) enter(false, code);
});
byId('difficulty').addEventListener('change', () => {
  const custom = byId('difficulty').value === 'custom';
  const fields = byId('custom-board');
  fields.hidden = fields.disabled = !custom;
  if (custom) updateMineLimit();
});
for (const id of ['board-width', 'board-height']) byId(id).addEventListener('input', updateMineLimit);
byId('round-settings').addEventListener('submit', event => event.preventDefault());
byId('start').addEventListener('click', startRound);
byId('again').addEventListener('click', startRound);
for (const id of ['cancel', 'leave']) byId(id).addEventListener('click', () => reset());
for (const action of ['open', 'flag']) byId(action).addEventListener('click', () => setAction(action));
window.addEventListener('pagehide', () => reset());
