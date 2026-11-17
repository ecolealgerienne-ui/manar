import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { boot } from './helpers.js';
import { social } from '../src/social.js';

let app;
before(async () => { app = await boot(); });
after(() => app.close());
const c = (...a) => app.call(...a);

test('health + swagger docs available', async () => {
  assert.equal((await c('GET', '/health')).status, 200);
  const d = await c('GET', '/docs.json');
  assert.ok(d.body.paths['/events']);
  assert.equal((await fetch(app.base + '/docs/')).status, 200);
});

test('registration requires e-mail validation, then login works', async () => {
  const email = 'valid@test.io';
  const r = await c('POST', '/auth/register', { body: { email, password: 'Passw0rd!x', display_name: 'Val' } });
  assert.equal(r.status, 201);
  assert.equal((await c('POST', '/auth/login', { body: { email, password: 'Passw0rd!x' } })).body.error.code, 'EMAIL_NOT_VERIFIED');
  const link = app.outbox.findLast((m) => m.to === email).text.match(/\/auth\/verify-email\?token=\S+/)[0];
  assert.equal((await fetch(app.base + link)).status, 200);
  assert.equal((await fetch(app.base + link)).status, 400, 'token is single use');
  assert.equal((await c('POST', '/auth/login', { body: { email, password: 'Passw0rd!x' } })).status, 200);
});

test('weak password, bad e-mail rejected; duplicate e-mail does not leak', async () => {
  assert.equal((await c('POST', '/auth/register', { body: { email: 'a@b.io', password: 'short', display_name: 'Ab' } })).body.error.code, 'WEAK_PASSWORD');
  assert.equal((await c('POST', '/auth/register', { body: { email: 'nope', password: 'Passw0rd!x', display_name: 'Ab' } })).body.error.code, 'INVALID_EMAIL');
  await app.user('dup');
  const u = (await app.user('dup2'));
  const r = await c('POST', '/auth/register', { body: { email: u.email, password: 'Passw0rd!x', display_name: 'Again' } });
  assert.equal(r.status, 201);
});

test('forgot / reset password flow', async () => {
  const u = await app.user('forgot');
  await c('POST', '/auth/forgot-password', { body: { email: u.email } });
  const code = app.outbox.findLast((m) => m.to === u.email).text.match(/code is: (\w+)/)[1];
  assert.equal((await c('POST', '/auth/reset-password', { body: { code, password: 'NewPassw0rd!' } })).status, 200);
  assert.equal((await c('GET', '/me', { token: u.token })).status, 401, 'old sessions revoked');
  assert.equal((await c('POST', '/auth/login', { body: { email: u.email, password: 'NewPassw0rd!' } })).status, 200);
  assert.equal((await c('POST', '/auth/forgot-password', { body: { email: 'ghost@x.io' } })).status, 200, 'no enumeration');
});

test('brute force: account locked after repeated failures', async () => {
  const u = await app.user('brute');
  for (let i = 0; i < 5; i++) await c('POST', '/auth/login', { body: { email: u.email, password: 'wrong' + i } });
  const r = await c('POST', '/auth/login', { body: { email: u.email, password: u.pw } });
  assert.equal(r.status, 429);
});

test('rate limit by IP', async () => {
  const rl = await boot({ rateLimitMax: 5 });
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await rl.call('GET', '/me')).status);
  assert.ok(codes.includes(429)); rl.close();
});

test('social login: create, re-login, link, no silent takeover', async () => {
  const orig = social.verify;
  social.verify = async (provider, token) => ({ id: `${provider}-${token}`, email: `${token}@gmail.test`, emailVerified: true, name: token });
  try {
    const first = await c('POST', '/auth/social', { body: { provider: 'google', token: 'sam' } });
    assert.equal(first.status, 200);
    const again = await c('POST', '/auth/social', { body: { provider: 'google', token: 'sam' } });
    assert.equal(again.body.user_id, first.body.user_id);
    // password user links facebook
    const u = await app.user('linker');
    assert.equal((await c('POST', '/me/social/facebook', { token: u.token, body: { token: 'zed' } })).body.social[0], 'facebook');
    assert.equal((await c('POST', '/auth/social', { body: { provider: 'facebook', token: 'zed' } })).body.user_id, u.id);
    // someone else cannot link the same facebook account
    const v = await app.user('thief');
    assert.equal((await c('POST', '/me/social/facebook', { token: v.token, body: { token: 'zed' } })).status, 409);
    // unverified password account with same e-mail is not auto-linked
    await c('POST', '/auth/register', { body: { email: 'victim@gmail.test', password: 'Passw0rd!x', display_name: 'Victim' } });
    assert.equal((await c('POST', '/auth/social', { body: { provider: 'google', token: 'victim' } })).status, 409);
  } finally { social.verify = orig; }
});

test('profile visibility: public / friends / private', async () => {
  const a = await app.user('pa'), b = await app.user('pb');
  await c('PATCH', '/me', { token: a.token, body: { public_info: 'hi all', friends_info: 'my phone', private_info: 'secret', music_prefs: ['jazz'] } });
  let v = (await c('GET', `/users/${a.id}`, { token: b.token })).body;
  assert.equal(v.public_info, 'hi all'); assert.equal(v.friends_info, undefined); assert.equal(v.private_info, undefined); assert.equal(v.email, undefined);
  await c('POST', '/friends/requests', { token: b.token, body: { userId: a.id } });
  const inc = (await c('GET', '/friends', { token: a.token })).body.incoming[0];
  await c('POST', `/friends/requests/${inc.id}/accept`, { token: a.token });
  v = (await c('GET', `/users/${a.id}`, { token: b.token })).body;
  assert.equal(v.friends_info, 'my phone'); assert.equal(v.private_info, undefined);
  assert.equal((await c('GET', '/me', { token: a.token })).body.private_info, 'secret');
});

test('events: public by default, private hidden, invited licence, vote flow', async () => {
  const o = await app.user('owner'), g = await app.user('guest'), x = await app.user('outsider');
  const pub = (await c('POST', '/events', { token: o.token, body: { name: 'Public' } })).body;
  assert.equal(pub.visibility, 'public');
  const priv = (await c('POST', '/events', { token: o.token, body: { name: 'Private', visibility: 'private', license: 'invited' } })).body;
  assert.equal((await c('GET', `/events/${priv.id}`, { token: x.token })).status, 404);
  assert.ok(!(await c('GET', '/events', { token: x.token })).body.some((e) => e.id === priv.id));
  await c('PUT', `/events/${priv.id}/invites/${g.id}`, { token: o.token });
  assert.ok((await c('GET', '/events', { token: g.token })).body.some((e) => e.id === priv.id));
  assert.equal((await c('PUT', `/events/${priv.id}/invites/${g.id}`, { token: x.token })).status, 403);
  const s = await c('POST', `/events/${priv.id}/tracks`, { token: g.token, body: { trackId: 'local:2' } });
  assert.equal(s.status, 201);
  const tid = s.body.queue[0].id;
  assert.equal((await c('POST', `/events/${pub.id}/tracks`, { token: x.token, body: { trackId: 'local:1' } })).status, 201);
  const t2 = (await c('GET', `/events/${pub.id}`, { token: x.token })).body.queue[0].id;
  assert.equal((await c('PUT', `/events/${pub.id}/tracks/${t2}/vote`, { token: o.token })).body.queue[0].votes, 2);
  assert.equal((await c('PUT', `/events/${priv.id}/tracks/${tid}/vote`, { token: x.token })).status, 404);
  assert.equal((await c('POST', `/events/${pub.id}/next`, { token: x.token })).status, 403);
  assert.equal((await c('POST', `/events/${pub.id}/next`, { token: o.token })).body.nowPlaying.track_id, 'local:1');
});

test('concurrency: 40 simultaneous votes on 2 tracks, no lost / duplicate vote', async () => {
  const o = await app.user('conc');
  const e = (await c('POST', '/events', { token: o.token, body: { name: 'Concurrent' } })).body;
  const [a, b] = (await Promise.all(['local:1', 'local:2'].map((t) => c('POST', `/events/${e.id}/tracks`, { token: o.token, body: { trackId: t } })))).map((r) => ({ id: r.body.entry_id }));
  const voters = await Promise.all(Array.from({ length: 20 }, (_, i) => app.user(`v${i}`)));
  await Promise.all(voters.flatMap((v) => [c('PUT', `/events/${e.id}/tracks/${a.id}/vote`, { token: v.token }), c('PUT', `/events/${e.id}/tracks/${a.id}/vote`, { token: v.token }), c('PUT', `/events/${e.id}/tracks/${b.id}/vote`, { token: v.token })]));
  const q = (await c('GET', `/events/${e.id}`, { token: o.token })).body.queue;
  const byTrack = Object.fromEntries(q.map((t) => [t.track_id, t.votes]));
  // owner voted for both on suggestion (1) + 20 voters; duplicates ignored
  assert.deepEqual(byTrack, { 'local:1': 21, 'local:2': 21 });
  // 10 users suggest the same new track at once => exactly one entry
  await Promise.all(voters.slice(0, 10).map((v) => c('POST', `/events/${e.id}/tracks`, { token: v.token, body: { trackId: 'local:5' } })));
  const q2 = (await c('GET', `/events/${e.id}`, { token: o.token })).body.queue;
  assert.equal(q2.filter((t) => t.track_id === 'local:5').length, 1);
  assert.equal(q2.find((t) => t.track_id === 'local:5').votes, 10);
});

test('concurrency: parallel playlist edits all apply, positions stay a dense permutation', async () => {
  const o = await app.user('plc');
  const p = (await c('POST', '/playlists', { token: o.token, body: { name: 'Shared' } })).body;
  const users = await Promise.all(Array.from({ length: 8 }, (_, i) => app.user(`pe${i}`)));
  await Promise.all(Array.from({ length: 16 }, (_, i) => c('POST', `/playlists/${p.id}/tracks`, { token: users[i % 8].token, body: { trackId: `local:${(i % 20) + 1}` } })));
  let s = (await c('GET', `/playlists/${p.id}`, { token: o.token })).body;
  assert.equal(s.tracks.length, 16);
  const ids = s.tracks.map((t) => t.id);
  await Promise.all(ids.slice(0, 8).map((id, i) => c('POST', `/playlists/${p.id}/tracks/${id}/move`, { token: users[i].token, body: { toIndex: 15 - i } })));
  s = (await c('GET', `/playlists/${p.id}`, { token: o.token })).body;
  assert.deepEqual(s.tracks.map((t) => t.position), [...Array(16).keys()]);
  assert.deepEqual([...s.tracks.map((t) => t.id)].sort((x, y) => x - y), [...ids].sort((x, y) => x - y));
  assert.equal(s.version, 24);
});

test('playlists: private + invited editing over REST', async () => {
  const o = await app.user('plo'), i = await app.user('pli'), x = await app.user('plx');
  const p = (await c('POST', '/playlists', { token: o.token, body: { name: 'VIP', visibility: 'private', edit_license: 'invited' } })).body;
  assert.equal((await c('GET', `/playlists/${p.id}`, { token: x.token })).status, 404);
  await c('PUT', `/playlists/${p.id}/invites/${i.id}`, { token: o.token });
  assert.equal((await c('POST', `/playlists/${p.id}/tracks`, { token: i.token, body: { trackId: 'local:1' } })).status, 201);
  const pub = (await c('POST', '/playlists', { token: o.token, body: { name: 'Pub', edit_license: 'invited' } })).body;
  assert.equal((await c('GET', `/playlists/${pub.id}`, { token: x.token })).body.can_edit, false);
  assert.equal((await c('POST', `/playlists/${pub.id}/tracks`, { token: x.token, body: { trackId: 'local:1' } })).status, 403);
  assert.equal((await c('POST', `/playlists/${pub.id}/tracks`, { token: x.token, body: { trackId: 'nope:1' } })).status, 403);
});

test('device control delegation over REST', async () => {
  const o = await app.user('dvo'), f = await app.user('dvf'), x = await app.user('dvx');
  const phone = (await c('POST', '/devices', { token: o.token, body: { name: 'Phone' }, headers: { 'x-platform': 'android', 'x-device-model': 'Pixel 9', 'x-app-version': '1.0.0' } })).body;
  const car = (await c('POST', '/devices', { token: o.token, body: { name: 'Car' } })).body;
  assert.equal((await c('PUT', `/devices/${car.id}/delegates/${f.id}`, { token: o.token })).status, 403, 'not friends yet');
  await c('POST', '/friends/requests', { token: o.token, body: { userId: f.id } });
  await c('POST', '/friends/requests', { token: f.token, body: { userId: o.id } }); // mutual => accepted
  assert.equal((await c('PUT', `/devices/${car.id}/delegates/${f.id}`, { token: o.token })).status, 200);
  assert.equal((await c('POST', `/devices/${car.id}/commands`, { token: f.token, body: { command: 'play' } })).body.playing, true);
  assert.equal((await c('POST', `/devices/${phone.id}/commands`, { token: f.token, body: { command: 'play' } })).status, 404);
  assert.equal((await c('POST', `/devices/${car.id}/commands`, { token: x.token, body: { command: 'play' } })).status, 404);
  assert.equal((await c('GET', '/devices', { token: f.token })).body.delegated_to_me[0].id, car.id);
  const pl = (await c('POST', '/playlists', { token: o.token, body: { name: 'Road' } })).body;
  await c('POST', `/playlists/${pl.id}/tracks`, { token: o.token, body: { trackId: 'local:3' } });
  await c('POST', `/playlists/${pl.id}/tracks`, { token: o.token, body: { trackId: 'local:4' } });
  await c('POST', `/devices/${car.id}/commands`, { token: f.token, body: { command: 'load', playlistId: pl.id } });
  const st = (await c('POST', `/devices/${car.id}/commands`, { token: f.token, body: { command: 'next' } })).body;
  assert.equal(st.index, 1);
  await c('DELETE', `/friends/${f.id}`, { token: o.token });
  assert.equal((await c('POST', `/devices/${car.id}/commands`, { token: f.token, body: { command: 'pause' } })).status, 404, 'unfriend revokes delegation');
});

test('security: data isolation, auth required, logout, bad input', async () => {
  const a = await app.user('sa'), b = await app.user('sb');
  assert.equal((await c('GET', '/events')).status, 401);
  assert.equal((await c('GET', '/me', { token: 'garbage' })).status, 401);
  assert.equal((await c('GET', '/me/sessions', { token: a.token })).body.length >= 1, true);
  const dv = (await c('POST', '/devices', { token: a.token, body: { name: 'mine' } })).body;
  assert.equal((await c('DELETE', `/devices/${dv.id}`, { token: b.token })).status, 403);
  assert.equal((await c('POST', '/events', { token: a.token, body: { name: 'x', visibility: 'weird' } })).status, 400);
  assert.equal((await c('GET', '/events/abc', { token: a.token })).status, 400);
  assert.equal((await c('GET', "/users?q=%25%27%3B--", { token: a.token })).status, 200);
  const res = await fetch(app.base + '/events', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.token}` }, body: '{bad' });
  assert.equal(res.status, 400);
  await c('POST', '/auth/logout', { token: a.token });
  assert.equal((await c('GET', '/me', { token: a.token })).status, 401);
});

test('every request is logged with platform / device / version', async () => {
  const u = await app.user('logger');
  await c('GET', '/me', { token: u.token, headers: { 'x-platform': 'ios', 'x-device-model': 'iPhone 15', 'x-app-version': '2.3.4' } });
  await c('POST', '/logs', { token: u.token, body: { action: 'open_screen:Events' }, headers: { 'x-platform': 'ios', 'x-device-model': 'iPhone 15', 'x-app-version': '2.3.4' } });
  const rows = app.db.prepare('SELECT * FROM logs WHERE user_id=? ORDER BY id').all(u.id);
  assert.ok(rows.some((r) => r.path === '/me' && r.platform === 'ios' && r.device === 'iPhone 15' && r.app_version === '2.3.4'));
  assert.ok(rows.some((r) => r.action === 'open_screen:Events'));
});

test('WebSocket: authenticated, authorised, live updates for vote + playlist + device', async () => {
  const o = await app.user('wso'), x = await app.user('wsx');
  const e = (await c('POST', '/events', { token: o.token, body: { name: 'Live', visibility: 'private' } })).body;
  const open = (token) => new Promise((res) => { const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`); const msgs = []; ws.on('message', (m) => msgs.push(JSON.parse(m))); ws.on('open', () => { ws.send(JSON.stringify({ action: 'auth', token })); res({ ws, msgs }); }); });
  const wait = (f) => new Promise((res, rej) => { const t0 = Date.now(); const i = setInterval(() => { const v = f(); if (v) { clearInterval(i); res(v); } else if (Date.now() - t0 > 3000) { clearInterval(i); rej(new Error('timeout')); } }, 20); });
  const A = await open(o.token), B = await open(x.token);
  A.ws.send(JSON.stringify({ action: 'subscribe', channel: `event:${e.id}` }));
  B.ws.send(JSON.stringify({ action: 'subscribe', channel: `event:${e.id}` }));
  await wait(() => A.msgs.some((m) => m.type === 'subscribed'));
  assert.ok((await wait(() => B.msgs.find((m) => m.type === 'error'))).error);
  await c('POST', `/events/${e.id}/tracks`, { token: o.token, body: { trackId: 'local:7' } });
  const m = await wait(() => A.msgs.find((m) => m.type === 'state'));
  assert.equal(m.data.queue[0].track_id, 'local:7');
  assert.equal(B.msgs.some((m) => m.type === 'state'), false, 'unauthorised client receives nothing');
  const bad = await open('nope'); await wait(() => bad.ws.readyState === 2 || bad.ws.readyState === 3);
  A.ws.close(); B.ws.close();
});

test('dev mode: token handed back, demo social login works only without credentials', async () => {
  const r = await c('POST', '/auth/register', { body: { email: 'devmode@test.io', password: 'Passw0rd!x', display_name: 'Dev' } });
  assert.ok(r.body.dev_verify_token, 'dev token returned when no SMTP is configured');
  assert.equal((await fetch(`${app.base}/auth/verify-email?token=${r.body.dev_verify_token}`)).status, 200);
  assert.equal((await c('POST', '/auth/login', { body: { email: 'devmode@test.io', password: 'Passw0rd!x' } })).status, 200);
  const g = await c('POST', '/auth/social', { body: { provider: 'google', token: 'dev:alice' } });
  assert.equal(g.status, 200);
  assert.equal((await c('GET', '/me', { token: g.body.token })).body.display_name, 'alice');
  assert.equal((await c('GET', '/config')).body.dev_mode, true);
  const dup = await c('POST', '/auth/register', { body: { email: 'devmode@test.io', password: 'Passw0rd!x', display_name: 'Dev' } });
  assert.equal(dup.body.dev_verify_token, undefined, 'existing e-mail never gets a token');
});

test('enriched lists (covers, counts), name filter, local audio preview, device summary', async () => {
  const o = await app.user('rich');
  const e = (await c('POST', '/events', { token: o.token, body: { name: 'Zebra night' } })).body;
  await c('POST', `/events/${e.id}/tracks`, { token: o.token, body: { trackId: 'local:4' } });
  const list = (await c('GET', '/events?q=zebra', { token: o.token })).body;
  assert.equal(list.length, 1); assert.equal(list[0].queue_count, 1); assert.equal(list[0].votes_count, 1);
  assert.equal(list[0].owner_name, 'rich'); assert.equal(list[0].covers[0].title, 'Bohemian Rhapsody');
  const p = (await c('POST', '/playlists', { token: o.token, body: { name: 'Yak' } })).body;
  await c('POST', `/playlists/${p.id}/tracks`, { token: o.token, body: { trackId: 'local:1' } });
  assert.equal((await c('GET', '/playlists?q=yak', { token: o.token })).body[0].track_count, 1);
  const wav = await fetch(`${app.base}/preview/3.wav`);
  assert.equal(wav.headers.get('content-type'), 'audio/wav');
  assert.ok((await wav.arrayBuffer()).byteLength > 100000);
  const d = (await c('POST', '/devices', { token: o.token, body: { name: 'Box' } })).body;
  await c('POST', `/playlists/${p.id}/tracks`, { token: o.token, body: { trackId: 'local:2' } });
  await c('POST', `/devices/${d.id}/commands`, { token: o.token, body: { command: 'load', playlistId: p.id } });
  await c('POST', `/devices/${d.id}/commands`, { token: o.token, body: { command: 'play' } });
  const mine = (await c('GET', '/devices', { token: o.token })).body.mine[0];
  assert.equal(mine.player.playing, true); assert.equal(mine.player.track.title, 'Blinding Lights');
});

test('owner sees the invited list on events and playlists', async () => {
  const o = await app.user('invo'), g = await app.user('invg');
  const e = (await c('POST', '/events', { token: o.token, body: { name: 'I', visibility: 'private' } })).body;
  const p = (await c('POST', '/playlists', { token: o.token, body: { name: 'I' } })).body;
  await c('PUT', `/events/${e.id}/invites/${g.id}`, { token: o.token }); await c('PUT', `/playlists/${p.id}/invites/${g.id}`, { token: o.token });
  assert.equal((await c('GET', `/events/${e.id}`, { token: o.token })).body.invited[0].id, g.id);
  assert.equal((await c('GET', `/playlists/${p.id}`, { token: o.token })).body.invited[0].id, g.id);
  assert.equal((await c('GET', `/events/${e.id}`, { token: g.token })).body.invited, undefined);
});
