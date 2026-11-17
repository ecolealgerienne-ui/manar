import { HttpError } from './util.js';

/**
 * Music catalog. Third-party SDK/API: Deezer public API (search + 30s previews, no key required).
 * The SDK only provides *metadata*: voting, ordering, licences, delegation, playlists... are all ours.
 * If Deezer is unreachable we fall back to a small local catalog, so the product still works offline / in CI.
 */
const LOCAL = [
  ['Blinding Lights', 'The Weeknd'], ['Get Lucky', 'Daft Punk'], ['One More Time', 'Daft Punk'],
  ['Bohemian Rhapsody', 'Queen'], ['Don\'t Stop Me Now', 'Queen'], ['Smells Like Teen Spirit', 'Nirvana'],
  ['Billie Jean', 'Michael Jackson'], ['Thriller', 'Michael Jackson'], ['Rolling in the Deep', 'Adele'],
  ['Hello', 'Adele'], ['Shape of You', 'Ed Sheeran'], ['Uptown Funk', 'Mark Ronson'],
  ['Lose Yourself', 'Eminem'], ['Hey Ya!', 'Outkast'], ['Take Five', 'Dave Brubeck'],
  ['So What', 'Miles Davis'], ['Clair de Lune', 'Debussy'], ['Alors on danse', 'Stromae'],
  ['Papaoutai', 'Stromae'], ['Dernière danse', 'Indila'],
].map(([title, artist], i) => ({ id: `local:${i + 1}`, title, artist, album: 'Demo', cover: '', preview_url: '', duration: 180 }));

export function createCatalog(db, { fetchImpl = globalThis.fetch, deezer = process.env.NODE_ENV !== 'test' } = {}) {
  const upsert = db.prepare(`INSERT INTO tracks (id,title,artist,album,cover,preview_url,duration) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, artist=excluded.artist, album=excluded.album,
    cover=excluded.cover, preview_url=excluded.preview_url, duration=excluded.duration`);
  for (const t of LOCAL) upsert.run(t.id, t.title, t.artist, t.album, t.cover, t.preview_url, t.duration);

  const fromDeezer = (d) => ({ id: `deezer:${d.id}`, title: d.title, artist: d.artist?.name || '', album: d.album?.title || '',
    cover: d.album?.cover_medium || '', preview_url: d.preview || '', duration: d.duration || 0 });
  const save = (t) => { upsert.run(t.id, t.title, t.artist, t.album, t.cover, t.preview_url, t.duration); return t; };
  const timeout = () => AbortSignal.timeout(3000);

  async function search(q, limit = 20) {
    if (deezer) {
      try {
        const r = await fetchImpl(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal: timeout() });
        if (r.ok) { const j = await r.json(); if (Array.isArray(j.data)) return j.data.map(fromDeezer).map(save); }
      } catch { /* fall through to local catalog */ }
    }
    const like = `%${q.replace(/[%_]/g, '')}%`;
    return db.prepare('SELECT * FROM tracks WHERE title LIKE ? OR artist LIKE ? LIMIT ?').all(like, like, limit);
  }

  /** Trusted resolution of a track id: the client never supplies metadata. */
  async function resolve(id) {
    const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
    if (row) return row;
    if (deezer && /^deezer:\d+$/.test(id)) {
      try {
        const r = await fetchImpl(`https://api.deezer.com/track/${id.split(':')[1]}`, { signal: timeout() });
        if (r.ok) { const j = await r.json(); if (j.id) return save(fromDeezer(j)); }
      } catch { /* ignore */ }
    }
    throw new HttpError(404, 'TRACK_NOT_FOUND', 'Unknown track');
  }
  return { search, resolve };
}
