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
].map(([title, artist], i) => ({ id: `local:${i + 1}`, title, artist, album: 'Demo', cover: '', preview_url: `/preview/${i + 1}.wav`, duration: 8 }));

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

/** Tiny synthesiser: a deterministic 8 s pentatonic melody per track number (16-bit mono WAV, 11.025 kHz). */
const wavCache = new Map();
export function demoWav(n) {
  if (wavCache.has(n)) return wavCache.get(n);
  const rate = 11025, notes = 16, per = Math.floor((rate * 8) / notes), pent = [0, 2, 4, 7, 9, 12, 14, 16];
  const base = 196 * 2 ** ((n * 3 % 12) / 12), pcm = Buffer.alloc(per * notes * 2);
  let seed = n * 7919;
  for (let k = 0; k < notes; k++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const f = base * 2 ** (pent[seed % pent.length] / 12);
    for (let i = 0; i < per; i++) {
      const env = Math.min(1, i / 200) * Math.exp(-3 * (i / per));
      const v = Math.sin(2 * Math.PI * f * i / rate) * 0.6 + Math.sin(4 * Math.PI * f * i / rate) * 0.2;
      pcm.writeInt16LE(Math.round(v * env * 9000), (k * per + i) * 2);
    }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  const out = Buffer.concat([h, pcm]);
  wavCache.set(n, out);
  return out;
}
