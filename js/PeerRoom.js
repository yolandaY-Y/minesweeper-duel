// One host, one guest, one reliable ordered PeerJS connection.
export default class PeerRoom {
  constructor(events, suffix, options) {
    this.events = events;
    this.suffix = suffix;
    this.options = options;
    this.closed = false;
  }

  async open(host, code) {
    const { Peer } = await import('https://esm.sh/peerjs@1.5.5?bundle-deps');
    if (this.closed) return;
    const peer = host ? new Peer(code + this.suffix, this.options) : new Peer(this.options);
    this.peer = peer;
    peer.on('open', () => {
      if (this.closed) return;
      if (host) this.events.created(code);
      else this.attach(peer.connect(code + this.suffix, { reliable: true }));
    });
    if (host) peer.on('connection', connection => this.attach(connection));
    peer.on('error', error => this.fail(error.type || 'connection-error'));
    peer.on('close', () => this.fail('disconnected'));
    peer.on('disconnected', () => {
      if (!this.closed && !peer.destroyed) peer.reconnect();
    });
  }

  attach(connection) {
    if (this.closed || this.connection) {
      connection.on('open', () => connection.close());
      return;
    }
    this.connection = connection;
    connection.on('open', () => { if (!this.closed) this.events.joined(); });
    connection.on('data', data => { if (!this.closed) this.events.message(data); });
    connection.on('close', () => this.fail('disconnected'));
    connection.on('error', () => this.fail('connection-error'));
  }

  send(data) {
    if (this.connection?.open) this.connection.send(data);
  }

  fail(reason) {
    if (this.closed) return;
    this.close();
    this.events.lost(reason);
  }

  close() {
    this.closed = true;
    this.peer?.destroy();
  }
}
