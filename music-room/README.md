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
**Windows / PowerShell (no `make` needed)** — Node ≥ 22.13:
```powershell
cd music-room
npm run setup      # installs backend + mobile dependencies
npm start          # API on http://localhost:4000  (Swagger: /docs)
npm test           # 31 tests
npm run mobile     # 2nd terminal: Expo dev server, press w (web) / scan QR with Expo Go
```
Linux/macOS: `make start`, `make test`, `make bench`, `make mobile` do the same.

**Dev mode** (no SMTP and not production): there is no mail server, so the API returns the verification token / reset code in its response and the app shows a *Verify my e-mail* button. Social login shows **demo buttons** (token `dev:<name>`) until real Google/Facebook IDs are configured; these two shortcuts are disabled in production or as soon as SMTP / provider credentials are set.
On a phone, set the server address (your PC's LAN IP, e.g. `http://192.168.1.10:4000`, never `localhost`) at the bottom of the login screen.

## Subject coverage (mandatory part, checked point by point)
| # | Requirement of the subject | Status | Where / how to check |
|---|---|---|---|
| IV.1 | Free back-end technology, justified; no foreign library committed; dependencies downloaded automatically (Makefile or similar) | ✅ | "Technical choices" below; `.gitignore` excludes `node_modules`; `make install` or `npm run setup` |
| IV.2 | Mobile app (Android **or** iOS), technology of our choice | ✅ | `mobile/` Expo / React Native (Android + iOS, also runs on web) |
| V.1 | First launch: create an account with e-mail/password **or** Facebook/Google | ✅ | `AuthScreen`; `POST /auth/register`, `POST /auth/social` |
| V.1 | Link a Facebook/Google account to an existing account | ✅ | Profile → Linked accounts; `POST /me/social/:provider` |
| V.1 | Profile: public info, friends-only info, private info, music preferences (view + update) | ✅ | Profile screen; `PATCH /me`; visibility enforced in `GET /users/:id` (tests) |
| V.1 | Mail/password account: **mail validation** demanded, and invited to change a forgotten password | ✅ | login refused with `EMAIL_NOT_VERIFIED`; `/auth/forgot-password` + `/auth/reset-password` |
| V.2 | At least 2 of the 3 services | ✅ **all 3** | below |
| V.2.1 | **Track Vote**: anyone suggests/votes the next track; more votes ⇒ higher in the list, played earlier | ✅ | `Events` tab; queue sorted `votes DESC`, then *who reached the score first*; owner "Play next" plays the top track |
| V.2.1 | Visibility Public/Private (default public; private = invited only can find and vote) | ✅ | `EventForm`, `canSeeEvent` (private ⇒ 404 for others) |
| V.2.1 | Licence: default everyone; invited only; **place + time window** (e.g. 4–6 PM) | ✅ | `EventForm` (HH:MM window, radius, GPS position), `canVoteEvent` |
| V.2.1 | Competition handling (several people voting different/same tracks) | ✅ | PK `(track,user)`, `UNIQUE(event,track)`, `BEGIN IMMEDIATE`; test with 40 parallel votes |
| V.2.2 | **Control Delegation**: licence specific to **each device** of the account; give control to **different friends** | ✅ | `Devices` tab; `PUT /devices/:id/delegates/:friendId` (friends only); remote screen; the delegate can also play the sound on their own device |
| V.2.3 | **Playlist Editor**: real-time multi-user edition; public/private (default public); editing licence open/invited (default open) | ✅ | `Playlists` tab; WebSocket push; `canEditPlaylist` |
| V.2.3 | Competition handling (several people moving tracks) | ✅ | server-side operations (entry id + target index) in one transaction; tests with 8 parallel moves |
| V.3 | All service data stored on the back-end (the truth) | ✅ | SQLite; app keeps only URL + token locally |
| V.4 | REST API documented (methods, inputs, outputs), JSON | ✅ | Swagger UI `/docs`, `/docs.json`: every route with its inputs, its response schema (`components/schemas`) and its error codes |
| V.5 | Mobile app = remote control only; back-end address configurable | ✅ | `mobile/src/api.js`; address field on the login screen and in Profile |
| V.5 | Facebook/Google authentication in the app | ✅ (needs your client IDs for the real flow) | `mobile/src/social.js`; server verifies tokens with the provider. Without IDs, a clearly-labelled dev-only demo login is offered |
| V.6 | A user sees their data but not others'; protections against bruteforce, session theft…; other hazards identified with practical protections | ✅ | `docs/SECURITY.md`; isolation tests |
| V.6 | Every action of the app logged on the back-end with platform, device, app version | ✅ | middleware in `app.js` → table `logs` + `logs/access.log`; the app sends `X-Platform`, `X-Device-Model`, `X-App-Version` and screen views via `POST /logs` |
| V.7 | Measure the load (AB/Gatling/…); justify the number of simultaneous users; give the server specs | ✅ | `backend/bench.js` (autocannon), `docs/PERFORMANCE.md` |
| V.8 | Agility/quality: specific one-off tests per layer; CI | ✅ | `backend/test/units.test.js` (business rules), `api.test.js` (HTTP + WebSocket + security + concurrency), `.github/workflows/music-room.yml` |
| V.8 | No credentials in git, `.env` ignored | ✅ | `.gitignore`, `.env.example` only; CI fails if a `.env` is tracked |
| II | AI instructions: responsible, transparent use | ✅ | `docs/AI-USAGE.md` |

No bonus is claimed (the subject evaluates bonuses only if the mandatory part is perfect).

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
The backend verifies every token with the provider (`backend/src/social.js`); tests stub that call. Without IDs the app offers demo social buttons (dev only). These flows require real provider credentials and a device/emulator, so they were **not exercised end-to-end** in the automated tests.

## Status / honesty notes
* Backend: 26 automated tests pass; REST flows, WebSocket and the mobile web build were smoke-tested together (register → mail → log in → create event → suggest track).
* Not verified in this environment: native Android/iOS builds, real Google/Facebook login, real SMTP, Deezer calls (network blocked here; the local fallback catalog was used).
* See `docs/AI-USAGE.md` for the transparency note required by the AI instructions of the subject.
