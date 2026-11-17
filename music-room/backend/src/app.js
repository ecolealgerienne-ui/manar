import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';
import { HttpError, bad, forbidden, notFound, intId, str, oneOf, now, hashToken } from './util.js';
import { rateLimit } from './ratelimit.js';
import { createAuth } from './auth.js';
import { createServices } from './services.js';
import { createCatalog, demoWav } from './catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const openapi = JSON.parse(readFileSync(path.join(here, 'openapi.json'), 'utf8'));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp(db, { catalog = createCatalog(db), publish = () => {}, rateLimitMax = config.rateLimitMax, authRateLimitMax = config.authRateLimitMax, logFile = true } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const auth = createAuth(db);
  const svc = createServices(db, catalog, publish);
  const q = (s, ...p) => db.prepare(s).get(...p);
  const all = (s, ...p) => db.prepare(s).all(...p);
  const run = (s, ...p) => db.prepare(s).run(...p);

  /* ----- security headers, CORS, body parsing ----- */
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store', 'Strict-Transport-Security': 'max-age=15552000' });
    const origin = req.headers.origin;
    if (origin && (config.corsOrigins === '*' || config.corsOrigins.split(',').includes(origin))) {
      res.set({ 'Access-Control-Allow-Origin': config.corsOrigins === '*' ? '*' : origin, Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Platform, X-Device-Model, X-App-Version',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '50kb' }));
  app.use(rateLimit({ windowMs: 60000, max: rateLimitMax }));

  /* ----- authentication ----- */
  const logFilePath = logFile ? path.join(config.logDir, 'access.log') : null;
  if (logFilePath) mkdirSync(config.logDir, { recursive: true });
  const insertLog = db.prepare('INSERT INTO logs (ts,user_id,method,path,status,platform,device,app_version,ip,duration_ms,action) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  const bearer = (req) => (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];

  /**
   * Every request is logged on the back-end with platform / device / app version (headers sent by the app).
   * Tokens and passwords are never logged (only method + route pattern/path without query).
   */
  app.use((req, res, next) => {
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path === '/health') return;
      const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
      const h = req.headers, clip = (v) => (v ? String(v).slice(0, 80) : 'unknown');
      try {
        insertLog.run(now(), req.user?.id ?? null, req.method, req.path.slice(0, 200), res.statusCode, clip(h['x-platform']), clip(h['x-device-model']), clip(h['x-app-version']), req.ip, ms, req.logAction ?? null);
        if (logFilePath) appendFileSync(logFilePath, `${new Date().toISOString()} user=${req.user?.id ?? '-'} ${req.method} ${req.path} ${res.statusCode} ${ms}ms platform=${clip(h['x-platform'])} device=${clip(h['x-device-model'])} version=${clip(h['x-app-version'])} ip=${req.ip}\n`);
      } catch { /* logging must never break the request */ }
    });
    next();
  });

  const authRL = rateLimit({ windowMs: 15 * 60000, max: authRateLimitMax });
  const requireAuth = (req, res, next) => {
    const u = auth.authenticate(bearer(req));
    if (!u) return next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication required'));
    req.user = u; req.token = bearer(req); next();
  };
  const meta = (req) => ({ ip: req.ip, ua: req.headers['user-agent'], platform: req.headers['x-platform'], device: req.headers['x-device-model'] });
  const pos = (req) => (req.body?.position ?? (req.query.lat ? { lat: Number(req.query.lat), lng: Number(req.query.lng) } : undefined));

  app.get('/config', (req, res) => res.json({ dev_mode: config.devMode,
    social: { google: config.googleClientIds.length > 0, facebook: !!(config.facebookAppId && config.facebookAppSecret) },
    social_demo: !config.isProd }));
  /** Synthesised 8 s melody used as the preview of the local demo catalog (works offline, no third party). */
  app.get('/preview/:n.wav', (req, res) => { res.set('Cache-Control', 'public, max-age=86400').type('audio/wav').send(demoWav(intId(req.params.n, 'n'))); });
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.get('/docs.json', (req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  /* ----- AUTH ----- */
  const A = express.Router();
  A.use(authRL);
  A.post('/register', wrap(async (req, res) => res.status(201).json(await auth.register(req.body || {}))));
  A.post('/resend-verification', wrap(async (req, res) => res.json(await auth.resendVerification(req.body?.email))));
  A.get('/verify-email', wrap(async (req, res) => {
    auth.verifyEmail(String(req.query.token || ''));
    res.type('html').send('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:3em"><h2>E-mail verified ✔</h2><p>You can now go back to the Music Room app and log in.</p>');
  }));
  A.post('/login', wrap(async (req, res) => res.json(await auth.login(req.body || {}, meta(req)))));
  A.post('/social', wrap(async (req, res) => res.json(await auth.socialLogin(req.body?.provider, req.body?.token, meta(req)))));
  A.post('/forgot-password', wrap(async (req, res) => res.json(await auth.forgotPassword(req.body?.email))));
  A.post('/reset-password', wrap(async (req, res) => { await auth.resetPassword(req.body?.code, req.body?.password); res.json({ ok: true }); }));
  A.post('/logout', requireAuth, (req, res) => { run('DELETE FROM sessions WHERE token_hash=?', hashToken(req.token)); res.json({ ok: true }); });
  app.use('/auth', A);

  /* ----- ME / PROFILE ----- */
  const me = (u) => ({ id: u.id, email: u.email, email_verified: !!u.email_verified, display_name: u.display_name, public_info: u.public_info,
    friends_info: u.friends_info, private_info: u.private_info, music_prefs: JSON.parse(u.music_prefs || '[]'), has_password: !!u.password_hash,
    social: all('SELECT provider FROM social_accounts WHERE user_id=?', u.id).map((r) => r.provider) });
  app.get('/me', requireAuth, (req, res) => res.json(me(req.user)));
  app.patch('/me', requireAuth, (req, res) => {
    const b = req.body || {}, u = req.user, f = {};
    if (b.display_name !== undefined) f.display_name = str(b.display_name, 'display_name', { min: 2, max: 50 });
    for (const k of ['public_info', 'friends_info', 'private_info']) if (b[k] !== undefined) f[k] = str(String(b[k]), k, { min: 0, max: 1000, optional: true }) ?? '';
    if (b.music_prefs !== undefined) {
      if (!Array.isArray(b.music_prefs) || b.music_prefs.length > 30 || b.music_prefs.some((x) => typeof x !== 'string' || x.length > 40)) throw bad('music_prefs must be an array of up to 30 short strings');
      f.music_prefs = JSON.stringify(b.music_prefs);
    }
    for (const [k, v] of Object.entries(f)) run(`UPDATE users SET ${k}=? WHERE id=?`, v, u.id); // keys come from the whitelist above
    res.json(me(q('SELECT * FROM users WHERE id=?', u.id)));
  });
  app.post('/me/password', requireAuth, authRL, wrap(async (req, res) => { await auth.changePassword(req.user, req.body?.current, req.body?.next); res.json({ ok: true }); }));
  app.post('/me/social/:provider', requireAuth, authRL, wrap(async (req, res) => { await auth.linkSocial(req.user, oneOf(req.params.provider, 'provider', ['google', 'facebook']), req.body?.token); res.json(me(req.user)); }));
  app.delete('/me/social/:provider', requireAuth, (req, res) => { auth.unlinkSocial(req.user, oneOf(req.params.provider, 'provider', ['google', 'facebook'])); res.json({ ok: true }); });
  app.get('/me/sessions', requireAuth, (req, res) => res.json(all('SELECT id,created_at,expires_at,ip,platform,device,(id=?) AS current FROM sessions WHERE user_id=? ORDER BY created_at DESC', req.user.sid, req.user.id).map((r) => ({ ...r, current: !!r.current }))));
  app.delete('/me/sessions', requireAuth, (req, res) => { const r = run('DELETE FROM sessions WHERE user_id=? AND id<>?', req.user.id, req.user.sid); res.json({ revoked: r.changes }); });
  app.delete('/me/sessions/:id', requireAuth, (req, res) => { run('DELETE FROM sessions WHERE id=? AND user_id=?', intId(req.params.id), req.user.id); res.json({ ok: true }); });

  /** Profile of someone else: public part always, friends part for friends only, private never. */
  app.get('/users/:id', requireAuth, (req, res) => {
    const id = intId(req.params.id), u = q('SELECT * FROM users WHERE id=?', id);
    if (!u) throw notFound('User not found');
    if (id === req.user.id) return res.json(me(u));
    const out = { id: u.id, display_name: u.display_name, public_info: u.public_info, music_prefs: JSON.parse(u.music_prefs || '[]') };
    out.is_friend = svc.areFriends(req.user.id, id);
    if (out.is_friend) out.friends_info = u.friends_info;
    res.json(out);
  });
  app.get('/users', requireAuth, (req, res) => {
    const s = str(req.query.q, 'q', { min: 2, max: 50 });
    res.json(all("SELECT id, display_name FROM users WHERE display_name LIKE ? ESCAPE '\\' LIMIT 20", `%${s.replace(/[%_\\]/g, '\\$&')}%`));
  });

  /* ----- FRIENDS ----- */
  app.get('/friends', requireAuth, (req, res) => {
    const id = req.user.id;
    res.json({
      friends: all(`SELECT u.id, u.display_name FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id=? THEN f.addressee_id ELSE f.requester_id END
        WHERE f.status='accepted' AND (f.requester_id=? OR f.addressee_id=?)`, id, id, id),
      incoming: all("SELECT f.id, u.id user_id, u.display_name FROM friendships f JOIN users u ON u.id=f.requester_id WHERE f.addressee_id=? AND f.status='pending'", id),
      outgoing: all("SELECT f.id, u.id user_id, u.display_name FROM friendships f JOIN users u ON u.id=f.addressee_id WHERE f.requester_id=? AND f.status='pending'", id),
    });
  });
  app.post('/friends/requests', requireAuth, (req, res) => {
    const to = intId(req.body?.userId, 'userId');
    if (to === req.user.id) throw bad('You cannot befriend yourself');
    if (!q('SELECT 1 FROM users WHERE id=?', to)) throw notFound('User not found');
    const reverse = q("SELECT * FROM friendships WHERE requester_id=? AND addressee_id=?", to, req.user.id);
    if (reverse) { run("UPDATE friendships SET status='accepted' WHERE id=?", reverse.id); return res.json({ status: 'accepted' }); }
    run('INSERT OR IGNORE INTO friendships (requester_id,addressee_id,created_at) VALUES (?,?,?)', req.user.id, to, now());
    res.status(201).json({ status: 'pending' });
  });
  app.post('/friends/requests/:id/accept', requireAuth, (req, res) => {
    const r = run("UPDATE friendships SET status='accepted' WHERE id=? AND addressee_id=? AND status='pending'", intId(req.params.id), req.user.id);
    if (!r.changes) throw notFound('Request not found');
    res.json({ status: 'accepted' });
  });
  app.delete('/friends/:userId', requireAuth, (req, res) => {
    const o = intId(req.params.userId, 'userId'), id = req.user.id;
    run('DELETE FROM friendships WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)', id, o, o, id);
    // removing a friend also removes the device delegations granted to them
    run('DELETE FROM device_delegates WHERE friend_id=? AND device_id IN (SELECT id FROM devices WHERE user_id=?)', o, id);
    res.json({ ok: true });
  });

  /* ----- MUSIC SEARCH ----- */
  app.get('/tracks/search', requireAuth, wrap(async (req, res) => res.json(await catalog.search(str(req.query.q, 'q', { min: 1, max: 100 })))));

  /* ----- EVENTS ----- */
  const ev = (req) => svc.getEvent(intId(req.params.id));
  const visibleEvent = (req) => { const e = ev(req); if (!svc.canSeeEvent(e, req.user.id)) throw notFound('Event not found'); return e; };
  app.get('/events', requireAuth, (req, res) => res.json(svc.listEvents(req.user.id, String(req.query.q || '').slice(0, 60))));
  app.post('/events', requireAuth, (req, res) => res.status(201).json(svc.eventState(svc.createEvent(req.user.id, req.body || {}), req.user.id)));
  const invited = (table, col, id) => all(`SELECT u.id, u.display_name FROM ${table} i JOIN users u ON u.id=i.user_id WHERE i.${col}=?`, id);
  app.get('/events/:id', requireAuth, (req, res) => { const e = visibleEvent(req); res.json({ ...svc.eventState(e, req.user.id), owner_name: q('SELECT display_name n FROM users WHERE id=?', e.owner_id).n, can_vote: svc.canVoteEvent(e, req.user.id, pos(req)), ...(e.owner_id === req.user.id ? { invited: invited('event_invites', 'event_id', e.id) } : {}) }); });
  app.patch('/events/:id', requireAuth, (req, res) => {
    const e = ev(req); if (e.owner_id !== req.user.id) throw forbidden('Only the owner can edit the event');
    const b = req.body || {};
    const v = oneOf(b.visibility, 'visibility', ['public', 'private'], e.visibility), l = oneOf(b.license, 'license', ['open', 'invited', 'geo_time'], e.license);
    run('UPDATE events SET description=?, visibility=?, license=?, name=?, lat=?, lng=?, radius_m=?, start_at=?, end_at=? WHERE id=?', b.description !== undefined ? String(b.description).slice(0, 500) : e.description, v, l,
      b.name !== undefined ? str(b.name, 'name', { max: 100 }) : e.name, b.lat ?? e.lat, b.lng ?? e.lng, b.radius_m ?? e.radius_m, b.start_at ?? e.start_at, b.end_at ?? e.end_at, e.id);
    res.json(svc.eventState(svc.getEvent(e.id), req.user.id));
  });
  app.delete('/events/:id', requireAuth, (req, res) => { const e = ev(req); if (e.owner_id !== req.user.id) throw forbidden('Only the owner can delete the event'); run('DELETE FROM events WHERE id=?', e.id); res.json({ ok: true }); });
  app.put('/events/:id/invites/:userId', requireAuth, (req, res) => { svc.inviteEvent(ev(req), req.user.id, intId(req.params.userId, 'userId')); res.json({ ok: true }); });
  app.delete('/events/:id/invites/:userId', requireAuth, (req, res) => { svc.uninviteEvent(ev(req), req.user.id, intId(req.params.userId, 'userId')); res.json({ ok: true }); });
  app.post('/events/:id/tracks', requireAuth, wrap(async (req, res) => {
    const e = visibleEvent(req);
    const id = await svc.suggestTrack(e, req.user.id, str(req.body?.trackId, 'trackId', { max: 60 }), pos(req));
    res.status(201).json({ ...svc.eventState(e, req.user.id), entry_id: id });
  }));
  app.put('/events/:id/tracks/:trackId/vote', requireAuth, (req, res) => { const e = visibleEvent(req); svc.vote(e, req.user.id, intId(req.params.trackId), true, pos(req)); res.json(svc.eventState(e, req.user.id)); });
  app.delete('/events/:id/tracks/:trackId/vote', requireAuth, (req, res) => { const e = visibleEvent(req); svc.vote(e, req.user.id, intId(req.params.trackId), false, pos(req)); res.json(svc.eventState(e, req.user.id)); });
  app.post('/events/:id/next', requireAuth, (req, res) => { const e = visibleEvent(req); svc.nextTrack(e, req.user.id); res.json(svc.eventState(e, req.user.id)); });

  /* ----- PLAYLISTS ----- */
  const pl = (req) => svc.getPlaylist(intId(req.params.id));
  const visiblePl = (req) => { const p = pl(req); if (!svc.canSeePlaylist(p, req.user.id)) throw notFound('Playlist not found'); return p; };
  app.get('/playlists', requireAuth, (req, res) => res.json(svc.listPlaylists(req.user.id, String(req.query.q || '').slice(0, 60))));
  app.post('/playlists', requireAuth, (req, res) => res.status(201).json(svc.playlistState(svc.createPlaylist(req.user.id, req.body || {}))));
  app.get('/playlists/:id', requireAuth, (req, res) => { const p = visiblePl(req); res.json({ ...svc.playlistState(p), owner_name: q('SELECT display_name n FROM users WHERE id=?', p.owner_id).n, can_edit: svc.canEditPlaylist(p, req.user.id), ...(p.owner_id === req.user.id ? { invited: invited('playlist_invites', 'playlist_id', p.id) } : {}) }); });
  app.patch('/playlists/:id', requireAuth, (req, res) => {
    const p = pl(req); if (p.owner_id !== req.user.id) throw forbidden('Only the owner can edit settings');
    const b = req.body || {};
    run('UPDATE playlists SET visibility=?, edit_license=?, name=? WHERE id=?', oneOf(b.visibility, 'visibility', ['public', 'private'], p.visibility),
      oneOf(b.edit_license, 'edit_license', ['open', 'invited'], p.edit_license), b.name !== undefined ? str(b.name, 'name', { max: 100 }) : p.name, p.id);
    res.json(svc.playlistState(p));
  });
  app.delete('/playlists/:id', requireAuth, (req, res) => { const p = pl(req); if (p.owner_id !== req.user.id) throw forbidden('Only the owner can delete the playlist'); run('DELETE FROM playlists WHERE id=?', p.id); res.json({ ok: true }); });
  app.put('/playlists/:id/invites/:userId', requireAuth, (req, res) => { svc.invitePlaylist(pl(req), req.user.id, intId(req.params.userId, 'userId')); res.json({ ok: true }); });
  app.delete('/playlists/:id/invites/:userId', requireAuth, (req, res) => { svc.uninvitePlaylist(pl(req), req.user.id, intId(req.params.userId, 'userId')); res.json({ ok: true }); });
  app.post('/playlists/:id/tracks', requireAuth, wrap(async (req, res) => res.status(201).json(await svc.editPlaylist(pl(req), req.user.id, { type: 'add', trackId: str(req.body?.trackId, 'trackId', { max: 60 }), expectedVersion: req.body?.expectedVersion }))));
  app.delete('/playlists/:id/tracks/:entryId', requireAuth, wrap(async (req, res) => res.json(await svc.editPlaylist(pl(req), req.user.id, { type: 'remove', entryId: intId(req.params.entryId, 'entryId'), expectedVersion: req.body?.expectedVersion }))));
  app.post('/playlists/:id/tracks/:entryId/move', requireAuth, wrap(async (req, res) => res.json(await svc.editPlaylist(pl(req), req.user.id, { type: 'move', entryId: intId(req.params.entryId, 'entryId'), toIndex: req.body?.toIndex, expectedVersion: req.body?.expectedVersion }))));

  /* ----- DEVICES & DELEGATION ----- */
  const summary = (json) => { const st = JSON.parse(json || '{}'); const cur = st.queue?.[st.index ?? 0]; return { playing: !!st.playing, volume: st.volume ?? 50, track: cur ? { title: cur.title, artist: cur.artist } : null }; };
  app.get('/devices', requireAuth, (req, res) => res.json({
    mine: all('SELECT id,name,platform,model,app_version,state FROM devices WHERE user_id=? ORDER BY id', req.user.id).map(({ state, ...d }) => ({ ...d, player: summary(state), delegates: all('SELECT f.friend_id id, u.display_name FROM device_delegates f JOIN users u ON u.id=f.friend_id WHERE f.device_id=?', d.id) })),
    delegated_to_me: all(`SELECT d.id,d.name,d.platform,d.model,d.state, u.id owner_id, u.display_name owner_name FROM device_delegates x JOIN devices d ON d.id=x.device_id JOIN users u ON u.id=d.user_id WHERE x.friend_id=?`, req.user.id).map(({ state, ...d }) => ({ ...d, player: summary(state) })),
  }));
  app.post('/devices', requireAuth, (req, res) => {
    const b = req.body || {}, h = req.headers;
    const r = run('INSERT INTO devices (user_id,name,platform,model,app_version,created_at) VALUES (?,?,?,?,?,?)', req.user.id, str(b.name, 'name', { max: 60 }),
      str(b.platform ?? h['x-platform'], 'platform', { max: 30, optional: true }) ?? null, str(b.model ?? h['x-device-model'], 'model', { max: 60, optional: true }) ?? null, str(b.app_version ?? h['x-app-version'], 'app_version', { max: 20, optional: true }) ?? null, now());
    res.status(201).json({ id: Number(r.lastInsertRowid), name: b.name });
  });
  app.delete('/devices/:id', requireAuth, (req, res) => { const d = svc.getDevice(intId(req.params.id)); if (d.user_id !== req.user.id) throw forbidden('Not your device'); run('DELETE FROM devices WHERE id=?', d.id); res.json({ ok: true }); });
  app.put('/devices/:id/delegates/:friendId', requireAuth, (req, res) => { svc.setDelegate(svc.getDevice(intId(req.params.id)), req.user.id, intId(req.params.friendId, 'friendId'), true); res.json({ ok: true }); });
  app.delete('/devices/:id/delegates/:friendId', requireAuth, (req, res) => { svc.setDelegate(svc.getDevice(intId(req.params.id)), req.user.id, intId(req.params.friendId, 'friendId'), false); res.json({ ok: true }); });
  app.get('/devices/:id/state', requireAuth, (req, res) => { const d = svc.getDevice(intId(req.params.id)); if (!svc.canControlDevice(d, req.user.id)) throw notFound('Device not found'); res.json(svc.deviceState(d)); });
  app.post('/devices/:id/commands', requireAuth, (req, res) => { const d = svc.getDevice(intId(req.params.id)); if (!svc.canControlDevice(d, req.user.id)) throw notFound('Device not found'); res.json(svc.controlDevice(d, req.user.id, req.body || {})); });

  /* ----- CLIENT ACTION LOGS (screen views / UI actions of the mobile app) ----- */
  app.post('/logs', requireAuth, (req, res) => { req.logAction = str(req.body?.action, 'action', { max: 100 }); res.status(202).json({ ok: true }); });

  /* ----- errors ----- */
  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found')));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof HttpError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } });
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });
  return app;
}
