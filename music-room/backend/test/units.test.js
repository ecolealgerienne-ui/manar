import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
import { openDb } from '../src/db.js';
import { createCatalog } from '../src/catalog.js';
import { createServices } from '../src/services.js';
import { hashPassword, verifyPassword, haversineMeters } from '../src/util.js';
import { LoginGuard } from '../src/ratelimit.js';

const setup = () => {
  const db = openDb(':memory:');
  const mk = (n) => Number(db.prepare('INSERT INTO users (email,display_name,created_at) VALUES (?,?,?)').run(`${n}@x.io`, n, 1).lastInsertRowid);
  return { db, svc: createServices(db, createCatalog(db, { deezer: false })), alice: mk('alice'), bob: mk('bob'), carol: mk('carol') };
};

test('password hashing: salted, verifiable', async () => {
  const a = await hashPassword('Secret123'), b = await hashPassword('Secret123');
  assert.notEqual(a, b);
  assert.ok(await verifyPassword('Secret123', a));
  assert.ok(!(await verifyPassword('secret123', a)));
});

test('login guard locks after 5 failures', () => {
  const g = new LoginGuard();
  for (let i = 0; i < 5; i++) g.fail('a');
  assert.throws(() => g.check('a'), /Too many/);
  g.ok('a'); g.check('a');
});

test('haversine ~111km per degree of latitude', () => {
  assert.ok(Math.abs(haversineMeters(0, 0, 1, 0) - 111195) < 200);
});

test('event licence: open / invited / geo_time', () => {
  const { svc, alice, bob, carol } = setup();
  const e = svc.createEvent(alice, { name: 'party' });
  assert.equal(e.visibility, 'public'); assert.equal(e.license, 'open');
  assert.ok(svc.canVoteEvent(e, bob).ok);
  const inv = svc.createEvent(alice, { name: 'vip', license: 'invited' });
  svc.inviteEvent(inv, alice, bob);
  assert.ok(svc.canVoteEvent(inv, bob).ok);
  assert.equal(svc.canVoteEvent(inv, carol).code, 'NOT_INVITED');
  const t = Date.now();
  const geo = svc.createEvent(alice, { name: 'geo', license: 'geo_time', lat: 48.85, lng: 2.35, radius_m: 100, start_at: t - 1000, end_at: t + 100000 });
  assert.ok(svc.canVoteEvent(geo, bob, { lat: 48.8501, lng: 2.3501 }).ok);
  assert.equal(svc.canVoteEvent(geo, bob, { lat: 48.9, lng: 2.35 }).code, 'TOO_FAR');
  assert.equal(svc.canVoteEvent(geo, bob).code, 'POSITION_REQUIRED');
  const late = svc.createEvent(alice, { name: 'late', license: 'geo_time', start_at: t - 5000, end_at: t - 1000 });
  assert.equal(svc.canVoteEvent(late, bob).code, 'TOO_LATE');
});

test('private event invisible to non invited', () => {
  const { svc, alice, bob } = setup();
  const e = svc.createEvent(alice, { name: 'secret', visibility: 'private' });
  assert.ok(!svc.canSeeEvent(e, bob));
  assert.equal(svc.listEvents(bob).length, 0);
  svc.inviteEvent(e, alice, bob);
  assert.equal(svc.listEvents(bob).length, 1);
});

test('queue ordering: more votes first, ties by age; next plays the best', async () => {
  const { svc, alice, bob, carol } = setup();
  const e = svc.createEvent(alice, { name: 'p' });
  const a = await svc.suggestTrack(e, alice, 'local:1');
  const b = await svc.suggestTrack(e, alice, 'local:2');
  const c = await svc.suggestTrack(e, alice, 'local:3');
  svc.vote(e, bob, c, true); svc.vote(e, carol, c, true); svc.vote(e, bob, b, true);
  assert.deepEqual(svc.eventState(e, alice).queue.map((t) => t.id), [c, b, a]);
  svc.nextTrack(e, alice);
  const s = svc.eventState(e, alice);
  assert.equal(s.nowPlaying.id, c); assert.equal(s.queue.length, 2);
  assert.throws(() => svc.nextTrack(e, bob), /owner/);
});

test('voting twice / suggesting the same track twice never double counts', async () => {
  const { svc, alice, bob } = setup();
  const e = svc.createEvent(alice, { name: 'p' });
  const id = await svc.suggestTrack(e, alice, 'local:1');
  const id2 = await svc.suggestTrack(e, bob, 'local:1');
  assert.equal(id, id2);
  svc.vote(e, bob, id, true); svc.vote(e, bob, id, true);
  assert.equal(svc.eventState(e, alice).queue[0].votes, 2);
  svc.vote(e, bob, id, false);
  assert.equal(svc.eventState(e, alice).queue[0].votes, 1);
});

test('playlist ops: add / move / remove keep dense positions and bump version', async () => {
  const { svc, alice } = setup();
  const p = svc.createPlaylist(alice, { name: 'mix' });
  for (const t of ['local:1', 'local:2', 'local:3']) await svc.editPlaylist(p, alice, { type: 'add', trackId: t });
  let s = svc.playlistState(p);
  assert.deepEqual(s.tracks.map((t) => t.track_id), ['local:1', 'local:2', 'local:3']);
  s = await svc.editPlaylist(p, alice, { type: 'move', entryId: s.tracks[2].id, toIndex: 0 });
  assert.deepEqual(s.tracks.map((t) => t.track_id), ['local:3', 'local:1', 'local:2']);
  assert.deepEqual(s.tracks.map((t) => t.position), [0, 1, 2]);
  s = await svc.editPlaylist(p, alice, { type: 'remove', entryId: s.tracks[0].id });
  assert.equal(s.tracks.length, 2); assert.equal(s.version, 5);
  await assert.rejects(svc.editPlaylist(p, alice, { type: 'move', entryId: 1, toIndex: 0, expectedVersion: 0 }), /changed/);
});

test('playlist licence: invited-only editing', async () => {
  const { svc, alice, bob } = setup();
  const p = svc.createPlaylist(alice, { name: 'x', edit_license: 'invited' });
  await assert.rejects(svc.editPlaylist(p, bob, { type: 'add', trackId: 'local:1' }), /not allowed/);
  svc.invitePlaylist(p, alice, bob);
  await svc.editPlaylist(p, bob, { type: 'add', trackId: 'local:1' });
  const priv = svc.createPlaylist(alice, { name: 'y', visibility: 'private' });
  assert.ok(!svc.canSeePlaylist(priv, bob));
});

test('delegation is per device and only to friends', () => {
  const { svc, db, alice, bob } = setup();
  const dev = (n) => svc.getDevice(Number(db.prepare('INSERT INTO devices (user_id,name,created_at) VALUES (?,?,?)').run(alice, n, 1).lastInsertRowid));
  const phone = dev('phone'), car = dev('car');
  assert.throws(() => svc.setDelegate(car, alice, bob, true), /friends/);
  db.prepare("INSERT INTO friendships (requester_id,addressee_id,status,created_at) VALUES (?,?,'accepted',1)").run(alice, bob);
  svc.setDelegate(car, alice, bob, true);
  assert.equal(svc.controlDevice(car, bob, { command: 'volume', value: 80 }).volume, 80);
  assert.throws(() => svc.controlDevice(phone, bob, { command: 'play' }), /no control/);
  svc.setDelegate(car, alice, bob, false);
  assert.throws(() => svc.controlDevice(car, bob, { command: 'play' }), /no control/);
  assert.throws(() => svc.controlDevice(car, alice, { command: 'volume', value: 101 }), /0-100/);
});
