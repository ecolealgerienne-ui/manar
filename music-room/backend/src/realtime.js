import { WebSocketServer } from 'ws';
import { hashToken, now } from './util.js';

/**
 * WebSocket hub. Protocol (JSON):
 *  -> {action:'auth', token}            must be the first message (5s)
 *  -> {action:'subscribe', channel}     channel = event:<id> | playlist:<id> | device:<id>
 *  <- {channel, type:'state', data}     pushed after every change
 * Every subscription is authorised with the same permission functions as the REST API.
 */
export function createHub(server, { db, access }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  const channels = new Map(); // channel -> Set<ws>

  wss.on('connection', (ws) => {
    ws.subs = new Set();
    ws.userId = null;
    const t = setTimeout(() => { if (!ws.userId) ws.close(4001, 'auth timeout'); }, 5000);
    ws.on('close', () => { clearTimeout(t); for (const c of ws.subs) channels.get(c)?.delete(ws); });
    ws.on('error', () => {});
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return ws.send(JSON.stringify({ type: 'error', error: 'bad json' })); }
      if (m.action === 'auth') {
        const s = db.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hashToken(m.token), now());
        if (!s) return ws.close(4003, 'unauthorized');
        ws.userId = s.user_id;
        return ws.send(JSON.stringify({ type: 'authed' }));
      }
      if (!ws.userId) return ws.close(4003, 'unauthorized');
      if (m.action === 'subscribe' && typeof m.channel === 'string') {
        const [kind, id] = m.channel.split(':');
        let ok = false;
        try { ok = access.canSee(kind, Number(id), ws.userId); } catch { ok = false; }
        if (!ok) return ws.send(JSON.stringify({ type: 'error', channel: m.channel, error: 'forbidden' }));
        if (!channels.has(m.channel)) channels.set(m.channel, new Set());
        channels.get(m.channel).add(ws); ws.subs.add(m.channel);
        ws.send(JSON.stringify({ type: 'subscribed', channel: m.channel }));
      } else if (m.action === 'unsubscribe') {
        channels.get(m.channel)?.delete(ws); ws.subs.delete(m.channel);
      }
    });
  });

  return {
    wss,
    publish(channel, data) {
      const set = channels.get(channel);
      if (!set || !set.size) return;
      const msg = JSON.stringify({ channel, type: 'state', data });
      for (const ws of set) if (ws.readyState === 1) ws.send(msg);
    },
    close() { for (const ws of wss.clients) ws.terminate(); wss.close(); },
  };
}
