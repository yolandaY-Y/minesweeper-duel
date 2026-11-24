import PeerRoom from './PeerRoom.js';

export default class ConnectionService {
  constructor() {
    this.reset();
  }

  reset() {
    this.room?.close();
    this.room = null;
    this.gameId = null;
    this.isHost = true;
    this.connected = false;
  }

  createLobby() {
    this.open(true, String(Math.floor(Math.random() * 1e8)).padStart(8, '0'));
  }

  joinLobby(gameId) {
    this.open(false, gameId);
  }

  open(host, code) {
    this.reset();
    this.isHost = host;
    const room = new PeerRoom({
      created: gameId => {
        this.gameId = gameId;
        document.dispatchEvent(new CustomEvent('lobbyCreated', { detail: { gameId } }));
      },
      joined: () => {
        this.connected = true;
        document.dispatchEvent(new CustomEvent('connectionEstablished', { detail: { isHost: host } }));
      },
      message: data => this.handleIncomingData(data),
      lost: () => {
        if (this.room !== room) return;
        this.reset();
        document.dispatchEvent(new CustomEvent('connectionLost'));
      },
    }, 'mineduo', { host: 'mineduo-server.onrender.com', path: '/peerjs', secure: true, port: 443 });
    this.room = room;
    room.open(host, code).catch(() => room.fail('connection-error'));
  }

  handleIncomingData(data) {
    // Only allow specific events to be sent for security
    const allowedNetworkEvents = new Set([
      'startGame',
      'firstRevealTile',
      'revealTile',
      'flagTile',
      'unflagTile',
    ]);
    if (allowedNetworkEvents.has(data?.type)) {
      // Dispatch event to the whole game
      document.dispatchEvent(
        new CustomEvent(data.type, { detail: data.content }),
      );
    } else {
      // Error when a non-allowed type is received
      console.error('Invalid data received:', data);
    }
  }

  startGame(
    mode,
    difficulty,
    width,
    height,
    mineCount,
    modeSettings,
    isFirstPlayer,
  ) {
    // Inform the peer that the game has started
    this.room?.send({
      type: 'startGame',
      content: {
        mode,
        difficulty,
        width,
        height,
        mineCount,
        modeSettings,
        isFirstPlayer,
      },
    });
  }

  firstRevealTile(y, x, minePositions) {
    // Reveal a tile to the peer and inform where the mines are located
    this.room?.send({
      type: 'firstRevealTile',
      content: {
        y,
        x,
        minePositions,
      },
    });
  }

  revealTile(y, x) {
    // Reveal a tile to the peer
    this.room?.send({
      type: 'revealTile',
      content: {
        y,
        x,
      },
    });
  }

  flagTile(y, x) {
    this.room?.send({
      type: 'flagTile',
      content: {
        y,
        x,
      },
    });
  }

  unflagTile(y, x) {
    this.room?.send({
      type: 'unflagTile',
      content: {
        y,
        x,
      },
    });
  }
}
