import { tx } from './db.js';
import { HttpError, bad, forbidden, notFound, now, haversineMeters } from './util.js';

/** Business rules. Pure functions of (db, ids): easy to unit-test, shared by REST and WebSocket layers. */
export function createServices(db, catalog, publish = () => {}) {
  const q = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);

  /* ---------- friends ---------- */
  const areFriends = (a, b) => !!q(`SELECT 1 FROM friendships WHERE status='accepted' AND
    ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?))`, a, b, b, a);

  /* ---------- EVENTS (Music Track Vote) ---------- */
  const getEvent = (id) => q('SELECT * FROM events WHERE id = ?', id) || (() => { throw notFound('Event not found'); })();
  const isEventInvited = (e, uid) => e.owner_id === uid || !!q('SELECT 1 FROM event_invites WHERE event_id=? AND user_id=?', e.id, uid);

  /** Visibility: public -> everybody, private -> owner + invited only. */
  const canSeeEvent = (e, uid) => e.visibility === 'public' || isEventInvited(e, uid);

  /**
   * Voting licence: open (default) / invited (only invited) / geo_time (inside radius AND time window).
   * `position` = {lat,lng} supplied by the client for the geo_time licence.
   */
  function canVoteEvent(e, uid, position) {
    if (!canSeeEvent(e, uid)) return { ok: false, code: 'NOT_VISIBLE', reason: 'Event not accessible' };
    if (e.owner_id === uid || e.license === 'open') return { ok: true };
    if (e.license === 'invited') return isEventInvited(e, uid) ? { ok: true } : { ok: false, code: 'NOT_INVITED', reason: 'Only invited users can vote' };
    if (e.license === 'geo_time') {
      const t = now();
      if (e.start_at && t < e.start_at) return { ok: false, code: 'TOO_EARLY', reason: 'Voting is not open yet' };
      if (e.end_at && t > e.end_at) return { ok: false, code: 'TOO_LATE', reason: 'Voting is closed' };
      if (e.lat != null) {
        if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') return { ok: false, code: 'POSITION_REQUIRED', reason: 'Your position is required' };
        if (haversineMeters(e.lat, e.lng, position.lat, position.lng) > (e.radius_m ?? 200)) return { ok: false, code: 'TOO_FAR', reason: 'You are not at the event location' };
      }
      return { ok: true };
    }
    return { ok: false, code: 'NO_LICENSE', reason: 'Unknown licence' };
  }
  function assertCanVote(e, uid, position) {
    const r = canVoteEvent(e, uid, position);
    if (!r.ok) throw r.code === 'NOT_VISIBLE' ? notFound(r.reason) : forbidden(r.reason, r.code);
  }

  function eventState(e, uid) {
    const rows = all(`SELECT et.id, et.status, et.created_at, et.suggested_by, t.id AS track_id, t.title, t.artist, t.album, t.cover, t.preview_url, t.duration,
        (SELECT COUNT(*) FROM event_votes v WHERE v.event_track_id = et.id) AS votes,
        EXISTS(SELECT 1 FROM event_votes v WHERE v.event_track_id = et.id AND v.user_id = ?) AS voted
      FROM event_tracks et JOIN tracks t ON t.id = et.track_id WHERE et.event_id = ? AND et.status IN ('queued','playing')
      ORDER BY (et.status='playing') DESC, votes DESC, et.created_at ASC, et.id ASC`, uid ?? 0, e.id);
    const tracks = rows.map((r) => ({ ...r, voted: !!r.voted }));
    return { id: e.id, name: e.name, description: e.description, visibility: e.visibility, license: e.license,
      owner_id: e.owner_id, lat: e.lat, lng: e.lng, radius_m: e.radius_m, start_at: e.start_at, end_at: e.end_at,
      nowPlaying: tracks.find((t) => t.status === 'playing') || null, queue: tracks.filter((t) => t.status === 'queued') };
  }
  const pushEvent = (e) => publish(`event:${e.id}`, eventState(e, null));

  function createEvent(uid, b) {
    const visibility = b.visibility ?? 'public', license = b.license ?? 'open';
    if (!['public', 'private'].includes(visibility)) throw bad('visibility must be public or private');
    if (!['open', 'invited', 'geo_time'].includes(license)) throw bad('license must be open, invited or geo_time');
    if (!b.name || typeof b.name !== 'string' || b.name.length > 100) throw bad('name is required (<=100)');
    if (license === 'geo_time') {
      if (b.start_at != null && b.end_at != null && b.end_at <= b.start_at) throw bad('end_at must be after start_at');
      if (b.lat != null && (typeof b.lat !== 'number' || typeof b.lng !== 'number' || Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180)) throw bad('invalid coordinates');
    }
    const r = run(`INSERT INTO events (owner_id,name,description,visibility,license,lat,lng,radius_m,start_at,end_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      uid, b.name.trim(), String(b.description ?? '').slice(0, 500), visibility, license, b.lat ?? null, b.lng ?? null, b.radius_m ?? 200, b.start_at ?? null, b.end_at ?? null, now());
    return getEvent(Number(r.lastInsertRowid));
  }

  /** Adds up to 4 track covers/titles to each row (for the mosaics of the mobile UI). */
  function withCovers(rows, sql, idKey) {
    if (!rows.length) return rows;
    const ids = rows.map((r) => r.id);
    const by = new Map();
    for (const c of all(sql.replace('?', ids.map(() => '?').join(',')), ...ids)) {
      const a = by.get(c.rid) || []; if (a.length < 4) a.push({ title: c.title, artist: c.artist, cover: c.cover }); by.set(c.rid, a);
    }
    return rows.map((r) => ({ ...r, covers: by.get(r.id) || [] }));
  }
  function listEvents(uid, search = '') {
    const like = `%${String(search).replace(/[%_\\]/g, '')}%`;
    const rows = all(`SELECT e.id,e.name,e.description,e.visibility,e.license,e.owner_id,e.start_at,e.end_at,e.lat,e.lng,e.radius_m,u.display_name AS owner_name,
        (SELECT COUNT(*) FROM event_tracks et WHERE et.event_id=e.id AND et.status='queued') AS queue_count,
        (SELECT COUNT(*) FROM event_votes v JOIN event_tracks et ON et.id=v.event_track_id WHERE et.event_id=e.id) AS votes_count,
        (SELECT t.title FROM event_tracks et JOIN tracks t ON t.id=et.track_id WHERE et.event_id=e.id AND et.status='playing' LIMIT 1) AS now_playing
      FROM events e JOIN users u ON u.id=e.owner_id
      WHERE (e.visibility='public' OR e.owner_id=? OR EXISTS(SELECT 1 FROM event_invites i WHERE i.event_id=e.id AND i.user_id=?)) AND e.name LIKE ?
      ORDER BY e.created_at DESC LIMIT 200`, uid, uid, like);
    return withCovers(rows, `SELECT et.event_id AS rid, t.title, t.artist, t.cover FROM event_tracks et JOIN tracks t ON t.id=et.track_id
      WHERE et.event_id IN (?) AND et.status IN ('queued','playing') ORDER BY et.id`, 'id');
  }

  /** Suggest = add to the queue with the suggester's vote. Same track twice => just a vote (no duplicate). */
  async function suggestTrack(e, uid, trackId, position) {
    assertCanVote(e, uid, position);
    const track = await catalog.resolve(trackId);
    const res = tx(db, () => {
      let et = q('SELECT * FROM event_tracks WHERE event_id=? AND track_id=?', e.id, track.id);
      if (et && et.status !== 'queued') {
        if (et.status === 'playing') throw new HttpError(409, 'ALREADY_PLAYING', 'This track is playing now');
        // already played: allow it back in the queue
        run("UPDATE event_tracks SET status='queued', created_at=?, played_at=NULL WHERE id=?", now(), et.id);
        run('DELETE FROM event_votes WHERE event_track_id=?', et.id);
      } else if (!et) {
        const n = q("SELECT COUNT(*) c FROM event_tracks WHERE event_id=? AND status='queued'", e.id).c;
        if (n >= 500) throw new HttpError(409, 'QUEUE_FULL', 'Queue is full');
        const r = run('INSERT INTO event_tracks (event_id,track_id,suggested_by,created_at) VALUES (?,?,?,?)', e.id, track.id, uid, now());
        et = { id: Number(r.lastInsertRowid) };
      }
      run('INSERT OR IGNORE INTO event_votes (event_track_id,user_id,created_at) VALUES (?,?,?)', et.id, uid, now());
      return et.id;
    });
    pushEvent(e);
    return res;
  }

  /** Idempotent vote / unvote (PUT/DELETE semantic): concurrent duplicates cannot double count (PRIMARY KEY). */
  function vote(e, uid, eventTrackId, on, position) {
    assertCanVote(e, uid, position);
    tx(db, () => {
      const et = q('SELECT * FROM event_tracks WHERE id=? AND event_id=?', eventTrackId, e.id);
      if (!et) throw notFound('Track not in this event');
      if (et.status !== 'queued') throw new HttpError(409, 'NOT_VOTABLE', 'Only queued tracks can be voted');
      if (on) run('INSERT OR IGNORE INTO event_votes (event_track_id,user_id,created_at) VALUES (?,?,?)', et.id, uid, now());
      else run('DELETE FROM event_votes WHERE event_track_id=? AND user_id=?', et.id, uid);
    });
    pushEvent(e);
  }

  /** Owner moves the live chain forward: the best-voted queued track becomes the playing one. */
  function nextTrack(e, uid) {
    if (e.owner_id !== uid) throw forbidden('Only the owner controls playback');
    tx(db, () => {
      run("UPDATE event_tracks SET status='played', played_at=? WHERE event_id=? AND status='playing'", now(), e.id);
      const top = q(`SELECT et.id FROM event_tracks et WHERE et.event_id=? AND et.status='queued'
        ORDER BY (SELECT COUNT(*) FROM event_votes v WHERE v.event_track_id=et.id) DESC, et.created_at ASC, et.id ASC LIMIT 1`, e.id);
      if (top) run("UPDATE event_tracks SET status='playing', played_at=? WHERE id=?", now(), top.id);
    });
    pushEvent(e);
  }

  const invite = (table, idCol, rid, ownerId, uid, targetId) => {
    if (ownerId !== uid) throw forbidden('Only the owner can invite');
    if (!q('SELECT 1 FROM users WHERE id=?', targetId)) throw notFound('User not found');
    run(`INSERT OR IGNORE INTO ${table} (${idCol}, user_id) VALUES (?,?)`, rid, targetId);
  };
  const uninvite = (table, idCol, rid, ownerId, uid, targetId) => {
    if (ownerId !== uid) throw forbidden('Only the owner can remove invitations');
    run(`DELETE FROM ${table} WHERE ${idCol}=? AND user_id=?`, rid, targetId);
  };

  /* ---------- PLAYLISTS (collaborative editor) ---------- */
  const getPlaylist = (id) => q('SELECT * FROM playlists WHERE id=?', id) || (() => { throw notFound('Playlist not found'); })();
  const isPlInvited = (p, uid) => p.owner_id === uid || !!q('SELECT 1 FROM playlist_invites WHERE playlist_id=? AND user_id=?', p.id, uid);
  const canSeePlaylist = (p, uid) => p.visibility === 'public' || isPlInvited(p, uid);
  const canEditPlaylist = (p, uid) => canSeePlaylist(p, uid) && (p.edit_license === 'open' || isPlInvited(p, uid));

  function playlistState(p) {
    const tracks = all(`SELECT pt.id, pt.position, pt.added_by, t.id AS track_id, t.title, t.artist, t.album, t.cover, t.preview_url, t.duration
      FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id WHERE pt.playlist_id=? ORDER BY pt.position`, p.id);
    const fresh = getPlaylist(p.id);
    return { id: p.id, name: fresh.name, visibility: fresh.visibility, edit_license: fresh.edit_license, owner_id: p.owner_id, version: fresh.version, tracks };
  }
  const pushPlaylist = (p) => publish(`playlist:${p.id}`, playlistState(p));

  function createPlaylist(uid, b) {
    const visibility = b.visibility ?? 'public', edit = b.edit_license ?? 'open';
    if (!['public', 'private'].includes(visibility)) throw bad('visibility must be public or private');
    if (!['open', 'invited'].includes(edit)) throw bad('edit_license must be open or invited');
    if (!b.name || typeof b.name !== 'string' || b.name.length > 100) throw bad('name is required (<=100)');
    const r = run('INSERT INTO playlists (owner_id,name,visibility,edit_license,created_at) VALUES (?,?,?,?,?)', uid, b.name.trim(), visibility, edit, now());
    return getPlaylist(Number(r.lastInsertRowid));
  }
  function listPlaylists(uid, search = '') {
    const like = `%${String(search).replace(/[%_\\]/g, '')}%`;
    const rows = all(`SELECT p.id,p.name,p.visibility,p.edit_license,p.owner_id,p.version,u.display_name AS owner_name,
        (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id=p.id) AS track_count,
        (SELECT COUNT(*) FROM playlist_invites i WHERE i.playlist_id=p.id) AS collaborators
      FROM playlists p JOIN users u ON u.id=p.owner_id
      WHERE (p.visibility='public' OR p.owner_id=? OR EXISTS(SELECT 1 FROM playlist_invites i WHERE i.playlist_id=p.id AND i.user_id=?)) AND p.name LIKE ?
      ORDER BY p.created_at DESC LIMIT 200`, uid, uid, like);
    return withCovers(rows, `SELECT pt.playlist_id AS rid, t.title, t.artist, t.cover FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id
      WHERE pt.playlist_id IN (?) ORDER BY pt.position`, 'id');
  }

  /**
   * Operation-based editing (add / remove / move). Each op is applied atomically on the server's CURRENT
   * state inside a write transaction, so two users moving different tracks at the same time never overwrite
   * each other (no "last writer wins" on the whole list). `expectedVersion` is optional optimistic locking
   * for clients that prefer to be told about interleaved edits (409 + current state).
   * Moves use the track *entry id* + target index, clamped to the list bounds.
   */
  async function editPlaylist(p, uid, op) {
    if (!canSeePlaylist(p, uid)) throw notFound('Playlist not found');
    if (!canEditPlaylist(p, uid)) throw forbidden('You are not allowed to edit this playlist', 'NOT_EDITOR');
    let track = null;
    if (op.type === 'add') track = await catalog.resolve(op.trackId);
    tx(db, () => {
      const cur = q('SELECT version FROM playlists WHERE id=?', p.id).version;
      if (op.expectedVersion != null && op.expectedVersion !== cur) throw new HttpError(409, 'VERSION_CONFLICT', `Playlist changed (version ${cur})`);
      const rows = all('SELECT id FROM playlist_tracks WHERE playlist_id=? ORDER BY position', p.id).map((r) => r.id);
      if (op.type === 'add') {
        if (rows.length >= 1000) throw new HttpError(409, 'PLAYLIST_FULL', 'Playlist is full');
        const r = run('INSERT INTO playlist_tracks (playlist_id,track_id,position,added_by) VALUES (?,?,?,?)', p.id, track.id, rows.length, uid);
        rows.push(Number(r.lastInsertRowid));
      } else if (op.type === 'remove') {
        const i = rows.indexOf(op.entryId);
        if (i < 0) throw notFound('Entry not in playlist');
        run('DELETE FROM playlist_tracks WHERE id=?', op.entryId); rows.splice(i, 1);
      } else if (op.type === 'move') {
        const i = rows.indexOf(op.entryId);
        if (i < 0) throw notFound('Entry not in playlist');
        if (!Number.isInteger(op.toIndex)) throw bad('toIndex must be an integer');
        rows.splice(i, 1);
        rows.splice(Math.max(0, Math.min(op.toIndex, rows.length)), 0, op.entryId);
      } else throw bad('type must be add, remove or move');
      rows.forEach((id, pos) => run('UPDATE playlist_tracks SET position=? WHERE id=?', pos, id));
      run('UPDATE playlists SET version=version+1 WHERE id=?', p.id);
    });
    pushPlaylist(p);
    return playlistState(p);
  }

  /* ---------- DEVICES (Music Control Delegation) ---------- */
  const getDevice = (id) => q('SELECT * FROM devices WHERE id=?', id) || (() => { throw notFound('Device not found'); })();
  const canControlDevice = (d, uid) => d.user_id === uid || !!q('SELECT 1 FROM device_delegates WHERE device_id=? AND friend_id=?', d.id, uid);
  const deviceState = (d) => ({ id: d.id, name: d.name, owner_id: d.user_id, ...JSON.parse(d.state || '{}') });

  /** Delegation is per device and per friend (not per account): owner can give a friend the car stereo but not the phone. */
  function setDelegate(d, uid, friendId, on) {
    if (d.user_id !== uid) throw forbidden('Only the device owner can delegate');
    if (on) {
      if (!areFriends(uid, friendId)) throw forbidden('You can only delegate to friends', 'NOT_FRIEND');
      run('INSERT OR IGNORE INTO device_delegates (device_id,friend_id) VALUES (?,?)', d.id, friendId);
    } else run('DELETE FROM device_delegates WHERE device_id=? AND friend_id=?', d.id, friendId);
  }

  function controlDevice(d, uid, cmd) {
    if (!canControlDevice(d, uid)) throw forbidden('You have no control on this device', 'NO_DELEGATION');
    const out = tx(db, () => {
      const st = JSON.parse(q('SELECT state FROM devices WHERE id=?', d.id).state || '{}');
      st.playing ??= false; st.volume ??= 50; st.index ??= 0; st.queue ??= []; st.positionMs ??= 0;
      switch (cmd.command) {
        case 'play': st.playing = true; break;
        case 'pause': st.playing = false; break;
        case 'next': if (st.queue.length) { st.index = (st.index + 1) % st.queue.length; st.positionMs = 0; } break;
        case 'previous': if (st.queue.length) { st.index = (st.index - 1 + st.queue.length) % st.queue.length; st.positionMs = 0; } break;
        case 'volume': {
          if (!Number.isInteger(cmd.value) || cmd.value < 0 || cmd.value > 100) throw bad('value must be an integer 0-100');
          st.volume = cmd.value; break;
        }
        case 'seek': {
          if (!Number.isInteger(cmd.value) || cmd.value < 0) throw bad('value must be a non-negative integer (ms)');
          st.positionMs = cmd.value; break;
        }
        case 'load': {
          const p = getPlaylist(Number(cmd.playlistId));
          if (!canSeePlaylist(p, uid)) throw notFound('Playlist not found');
          st.queue = all('SELECT t.id,t.title,t.artist,t.preview_url FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id WHERE pt.playlist_id=? ORDER BY pt.position', p.id);
          st.index = 0; st.positionMs = 0; st.playlistId = p.id; break;
        }
        default: throw bad('command must be play, pause, next, previous, volume, seek or load');
      }
      st.updatedBy = uid; st.updatedAt = now();
      run('UPDATE devices SET state=? WHERE id=?', JSON.stringify(st), d.id);
      return st;
    });
    const s = { id: d.id, name: d.name, owner_id: d.user_id, ...out };
    publish(`device:${d.id}`, s);
    return s;
  }

  /** Used by the WebSocket hub to authorise subscriptions. */
  const access = {
    canSee(kind, id, uid) {
      if (kind === 'event') return canSeeEvent(getEvent(id), uid);
      if (kind === 'playlist') return canSeePlaylist(getPlaylist(id), uid);
      if (kind === 'device') return canControlDevice(getDevice(id), uid);
      return false;
    },
  };

  return { areFriends, getEvent, canSeeEvent, canVoteEvent, assertCanVote, eventState, createEvent, listEvents, suggestTrack, vote, nextTrack,
    inviteEvent: (e, uid, t) => invite('event_invites', 'event_id', e.id, e.owner_id, uid, t),
    uninviteEvent: (e, uid, t) => uninvite('event_invites', 'event_id', e.id, e.owner_id, uid, t),
    getPlaylist, canSeePlaylist, canEditPlaylist, playlistState, createPlaylist, listPlaylists, editPlaylist,
    invitePlaylist: (p, uid, t) => invite('playlist_invites', 'playlist_id', p.id, p.owner_id, uid, t),
    uninvitePlaylist: (p, uid, t) => uninvite('playlist_invites', 'playlist_id', p.id, p.owner_id, uid, t),
    getDevice, canControlDevice, deviceState, setDelegate, controlDevice, access };
}
