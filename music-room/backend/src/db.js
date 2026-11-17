import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE COLLATE NOCASE, password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0, display_name TEXT NOT NULL,
  public_info TEXT NOT NULL DEFAULT '', friends_info TEXT NOT NULL DEFAULT '',
  private_info TEXT NOT NULL DEFAULT '', music_prefs TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_accounts (
  provider TEXT NOT NULL, provider_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider, provider_id));
CREATE TABLE IF NOT EXISTS user_tokens (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  ip TEXT, user_agent TEXT, platform TEXT, device TEXT);
CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY, requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
  UNIQUE (requester_id, addressee_id));
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, album TEXT DEFAULT '',
  cover TEXT DEFAULT '', preview_url TEXT DEFAULT '', duration INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, platform TEXT, model TEXT, app_version TEXT,
  state TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS device_delegates (
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (device_id, friend_id));
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public', license TEXT NOT NULL DEFAULT 'open',
  lat REAL, lng REAL, radius_m REAL, start_at INTEGER, end_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS event_invites (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (event_id, user_id));
CREATE TABLE IF NOT EXISTS event_tracks (
  id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id), suggested_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'queued', created_at INTEGER NOT NULL, played_at INTEGER,
  UNIQUE (event_id, track_id));
CREATE TABLE IF NOT EXISTS event_votes (
  event_track_id INTEGER NOT NULL REFERENCES event_tracks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL,
  PRIMARY KEY (event_track_id, user_id));
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'public', edit_license TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS playlist_invites (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (playlist_id, user_id));
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id INTEGER PRIMARY KEY, playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id), position INTEGER NOT NULL,
  added_by INTEGER NOT NULL REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_pt_pl ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_et_ev ON event_tracks(event_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, user_id INTEGER, method TEXT, path TEXT, status INTEGER,
  platform TEXT, device TEXT, app_version TEXT, ip TEXT, duration_ms INTEGER, action TEXT);
`;

export function openDb(file = config.dbPath) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  db.exec(SCHEMA);
  return db;
}

/**
 * Runs fn inside a write transaction. BEGIN IMMEDIATE takes the write lock up-front,
 * so concurrent votes / playlist moves are serialised by the database: this is the
 * heart of the "competition" handling required by the subject.
 */
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}
