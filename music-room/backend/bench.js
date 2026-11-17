// Load test of the 3 services with autocannon (npm run bench / make bench).
// Starts the API in-process on a temporary database, with rate limiting disabled (it would measure the limiter).
process.env.NODE_ENV = 'test';
import autocannon from 'autocannon';
import os from 'node:os';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { start } from './src/index.js';
import { newToken, hashToken, now } from './src/util.js';

const dir = mkdtempSync(path.join(os.tmpdir(), 'mr-bench-'));
const s = await start({ port: 0, dbPath: path.join(dir, 'bench.db'), logFile: false, rateLimitMax: 1e9, authRateLimitMax: 1e9 });
const base = `http://127.0.0.1:${s.port}`;
const run = (sql, ...p) => s.db.prepare(sql).run(...p);

const USERS = 200;
const users = [];
for (let i = 0; i < USERS; i++) {
  const id = Number(run('INSERT INTO users (email,email_verified,display_name,created_at) VALUES (?,1,?,?)', `b${i}@bench.io`, `bench${i}`, now()).lastInsertRowid);
  const t = newToken();
  run('INSERT INTO sessions (user_id,token_hash,created_at,expires_at) VALUES (?,?,?,?)', id, hashToken(t), now(), now() + 3.6e6);
  users.push({ id, token: t });
}
const owner = users[0];
const api = (m, p, u = owner, body) => fetch(base + p, { method: m, headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then((r) => r.json());
const ev = await api('POST', '/events', owner, { name: 'bench' });
const tracks = [];
for (let i = 1; i <= 20; i++) tracks.push((await api('POST', `/events/${ev.id}/tracks`, owner, { trackId: `local:${i}` })).entry_id);
const pl = await api('POST', '/playlists', owner, { name: 'bench' });
let entries = [];
for (let i = 1; i <= 20; i++) entries = (await api('POST', `/playlists/${pl.id}/tracks`, owner, { trackId: `local:${i}` })).tracks;
const dev = await api('POST', '/devices', owner, { name: 'bench' });

const scenarios = {
  'Track Vote (read queue + vote/unvote)': (c) => ({ requests: [
    { method: 'GET', path: `/events/${ev.id}` },
    { method: 'PUT', path: `/events/${ev.id}/tracks/${tracks[c % 20]}/vote` },
    { method: 'DELETE', path: `/events/${ev.id}/tracks/${tracks[(c + 1) % 20]}/vote` }] }),
  'Playlist Editor (read + move)': () => ({ requests: [
    { method: 'GET', path: `/playlists/${pl.id}` },
    { method: 'POST', path: `/playlists/${pl.id}/tracks/${entries[3].id}/move`, body: JSON.stringify({ toIndex: 7 }) },
    { method: 'POST', path: `/playlists/${pl.id}/tracks/${entries[3].id}/move`, body: JSON.stringify({ toIndex: 2 }) }] }),
  'Control Delegation (commands)': () => ({ requests: [
    { method: 'POST', path: `/devices/${dev.id}/commands`, body: JSON.stringify({ command: 'volume', value: 42 }) },
    { method: 'GET', path: `/devices/${dev.id}/state` }] }),
};

const levels = (process.env.BENCH_LEVELS || '10,50,100,250,500').split(',').map(Number);
const duration = Number(process.env.BENCH_DURATION || 8);
console.log(`CPU: ${os.cpus()[0].model} x${os.cpus().length} | RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB | Node ${process.version}\n`);
console.log('| Service | connections | req/s | p50 ms | p99 ms | non-2xx | errors |\n|---|---|---|---|---|---|---|');
for (const [name, mk] of Object.entries(scenarios)) {
  for (const connections of levels) {
    const r = await autocannon({ url: base, connections, duration, headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' }, ...mk(connections) });
    console.log(`| ${name} | ${connections} | ${Math.round(r.requests.average)} | ${r.latency.p50} | ${r.latency.p99} | ${r.non2xx} | ${r.errors + r.timeouts} |`);
  }
}
s.close();
process.exit(0);
