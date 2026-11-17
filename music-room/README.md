# 🎵 Music Room — Music, Collaboration and mobility

Mobile solution (Android / iOS / web) for collaborative music: **live vote**, **collaborative playlists** and **control delegation**, backed by a REST + WebSocket API.

```
music-room/
├── backend/   Node.js 22 API (Express, node:sqlite, ws)  — the single source of truth
├── mobile/    Expo / React Native app (Android, iOS, web) — a pure "remote control"
├── docs/      SECURITY.md, PERFORMANCE.md (ramp-up), AI-USAGE.md
├── Makefile   one-command install / start / test / bench
└── .env.example
```

## Quick start
```bash
make start            # installs deps, creates .env from .env.example, API on http://localhost:4000
# Swagger / API reference: http://localhost:4000/docs   (raw: /docs.json)
make test             # 26 unit + integration tests
make bench            # load test (results in docs/PERFORMANCE.md)
make mobile           # Expo dev server: press a (Android), i (iOS), w (web)  — or scan the QR with Expo Go
```
Requirements: Node ≥ 22.13, `make`. Dependencies are never committed: they are downloaded from `package.json` / lockfiles by `make install`.
Without SMTP settings, e-mails (verification link, reset code) are printed in the server console; set `SMTP_*` in `.env` for real delivery.
On a phone, set the back-end address (your computer's LAN IP, e.g. `http://192.168.1.10:4000`) on the login screen or in *Profile → Back-end address*.

## Subject coverage
| Subject | Where |
|---|---|
| V.1 Account e-mail/password or Google/Facebook, linking, profile public / friends / private / music prefs, mail validation, password reset | `backend/src/auth.js`, `app.js` (`/auth/*`, `/me`, `/users`), mobile `AuthScreen`, `ProfileScreen` |
| V.2.1 **Music Track Vote** (public/private events, licences *open / invited / place+time*, votes reorder the queue, concurrency) | `services.js` (events section), `/events/*` |
| V.2.2 **Music Control Delegation** (per-device, per-friend licence) | `services.js` (devices), `/devices/*` |
| V.2.3 **Music Playlist Editor** (public/private, open/invited editing, real-time, concurrent moves) | `services.js` (playlists), `/playlists/*` |
| All three services are implemented (2 required) | |
| V.3 Server = truth; all data in the back-end | SQLite DB |
| V.4 REST + JSON API documented with Swagger/OpenAPI | `/docs`, `backend/src/openapi.json` |
| V.5 App is only a remote control, configurable back-end URL, Google/Facebook sign-in | `mobile/src/api.js`, `social.js` |
| V.6 Securing + logs (platform / device / app version) | `docs/SECURITY.md`, logging middleware in `app.js`, `logs` table |
| V.7 Ramp-up | `backend/bench.js`, `docs/PERFORMANCE.md` |
| V.8 Agility, per-layer tests, CI, no secrets in git | `backend/test/*`, `.github/workflows/music-room.yml`, `.env` ignored |

Bonus (not claimed — the subject only evaluates bonuses if the mandatory part is perfect): the Expo app runs on web (`make mobile` → `w`), which gives a first responsive web client.

## Technical choices (and why)
| Choice | Justification | Trade-off |
|---|---|---|
| **Node.js + Express** | One language with the mobile app (JS), huge ecosystem, non-blocking I/O fits many small requests + WebSockets | single-threaded CPU; scale with several processes |
| **SQLite (`node:sqlite`, WAL)** | zero install, transactional (`BEGIN IMMEDIATE`) which is the simplest *correct* way to serialise concurrent votes/moves; zero native build step | single node. Switch to PostgreSQL (`SELECT … FOR UPDATE`) to scale out; data access is isolated in `services.js` |
| **REST + JSON** | universal, cacheable, easy to document (OpenAPI) and test; resources map naturally (events, tracks, votes) | chatty compared to GraphQL; real-time needs a second channel |
| **WebSocket (`ws`)** | push of the full new state to every subscriber (votes, playlist edits, remote control) with the same authorisation rules as REST | needs sticky sessions / pub-sub when scaling out |
| **Opaque session tokens (hashed in DB)** | revocable, listable (theft detection); JWT cannot be revoked without a blacklist | one DB lookup per request (cheap) |
| **scrypt** | memory-hard, built into Node: no native dependency | — |
| **Deezer public API** as music "SDK" | search + 30 s previews with no key; it only supplies metadata, **all behaviour (vote, order, licences, delegation) is ours**; offline fallback catalog | no full-track playback (licensing); a Spotify SDK would need premium accounts |
| **Expo / React Native** | one code base Android + iOS (+web), fast iteration, `expo-auth-session` for Google/Facebook | not a pure native UI |

### Concurrency (the "competition problems")
* **Votes**: `event_votes` has `PRIMARY KEY (track, user)` → a user can never vote twice for a track, even with parallel requests; `PUT`/`DELETE` vote are idempotent. Suggesting an already queued track becomes a vote (`UNIQUE(event, track)`), so ten simultaneous suggestions give one entry with ten votes. The order is computed from the votes (`votes DESC, age ASC`) at read time, so there is no stored rank that could be corrupted.
* **Playlists**: edits are *operations* (`add`, `remove`, `move entry → index`) applied by the server on its **current** state inside one write transaction, then positions are renumbered densely and a `version` is incremented. Two users moving different tracks at the same time both succeed (no "last writer overwrites the whole list"); two moves of the same track are applied one after the other. Clients can pass `expectedVersion` to get a `409 VERSION_CONFLICT` instead. Every change is pushed to all subscribers over WebSocket. Tests: `backend/test/api.test.js` (40 parallel votes, 16 parallel adds, 8 parallel moves).

## Environment variables
See `.env.example` (backend) and `mobile/.env.example`. **Never commit a `.env`**; CI fails if one is tracked.

## Social login setup
1. Google: create OAuth client IDs (web/android/iOS) on console.cloud.google.com → put them in `GOOGLE_CLIENT_IDS` (backend, comma separated) and `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` (mobile).
2. Facebook: create an app on developers.facebook.com → `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` (backend only) and `EXPO_PUBLIC_FACEBOOK_APP_ID` (mobile).
The backend verifies every token with the provider (`backend/src/social.js`); tests stub that call. The social buttons stay disabled until the IDs are configured. These flows require real provider credentials and a device/emulator, so they were **not exercised end-to-end** in the automated tests.

## Status / honesty notes
* Backend: 26 automated tests pass; REST flows, WebSocket and the mobile web build were smoke-tested together (register → mail → log in → create event → suggest track).
* Not verified in this environment: native Android/iOS builds, real Google/Facebook login, real SMTP, Deezer calls (network blocked here; the local fallback catalog was used).
* See `docs/AI-USAGE.md` for the transparency note required by the AI instructions of the subject.
