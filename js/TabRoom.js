// The practice connection stays inside one browser. No signaling service is needed.
export default class TabRoom {
  constructor(events) {
    this.events = events;
    this.id = Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-');
  }

  open(host, code) {
    this.host = host;
    this.channel = new BroadcastChannel('minesweeper-duel-v4-' + code);
    this.channel.onmessage = event => this.receive(event.data);
    if (host) this.events.created(code);
    else this.post('join');
  }

  post(type, data, to = this.partner) {
    this.channel?.postMessage({ from: this.id, to, type, data });
  }

  receive(packet) {
    if (!packet || (packet.to && packet.to !== this.id)) return;
    if (packet.type === 'join' && this.host) {
      if (this.partner) return this.post('full', null, packet.from);
      this.partner = packet.from;
      this.post('welcome');
    } else if (packet.type === 'welcome' && !this.host && !this.partner) {
      this.partner = packet.from;
      this.post('ready');
      this.events.joined();
    } else if (packet.type === 'full' && !this.partner && !this.host) {
      this.events.lost('full');
    } else if (this.partner && packet.from === this.partner) {
      if (packet.type === 'ready' && this.host) this.events.joined();
      if (packet.type === 'message') this.events.message(packet.data);
      if (packet.type === 'leave') this.events.lost('disconnected');
    }
  }

  send(data) { this.post('message', data); }

  close() {
    if (this.partner) this.post('leave');
    this.channel?.close();
    this.channel = null;
  }
}
