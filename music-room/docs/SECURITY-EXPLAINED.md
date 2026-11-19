# Securing & logs: how to explain it (subject V.6)

## What the subject asks
1. A user can access **their** data, never other users'.
2. Plan malicious behaviours (API brute force, session theft…) — the API does not have to be unbreakable.
   * **implement** mechanisms that protect users;
   * **identify other hazards** and **explain the practicable protections**.
3. **Every action of the mobile app is logged on the back-end** with *platform*, *device*, *application version*.

## 1. "A user only sees their own data" — one rule, enforced in the back-end
The app is only a remote control; **all checks are server-side** (a modified client changes nothing).
* Identity comes from the session token, never from a field sent by the client (`req.user`).
* Each resource has an access rule in `backend/src/services.js`: private events/playlists → **404** for non-invited users (we do not even confirm they exist); profile → public part for all, *friends-only* part for friends, *private* part only for the owner (`GET /users/:id`); devices → owner or delegated friends; edits/deletes → owner only.
* Proven by tests (`test/api.test.js`: "security: data isolation…", "profile visibility…", delegation, private events/playlists).
* Demo for the jury: log in as A, copy a private event id, call it as B → `404`.

## 2. Threats and protections (implemented)
| Threat | What the attacker tries | Our protection (file) |
|---|---|---|
| **Brute force** of passwords | thousands of guesses | per-IP limit on `/auth/*` and global limit (429 + `Retry-After`) — `ratelimit.js`; per-account lock-out after 5 failures for 15 min (`LoginGuard`); slow scrypt hashing; same error for unknown e-mail / bad password |
| **API flooding / DoS** | many requests | global rate limit, 50 kB body limit, caps on queue/playlist size, WebSocket 4 kB payload and 5 s auth timeout |
| **Session theft** (token stolen) | reuse a token | tokens are random 256-bit values, **only a keyed hash is stored**; 7-day expiry; **list of logged-in devices with "Disconnect"** (`/me/sessions`), disconnect-all, logout, all sessions revoked on password reset; HTTPS + HSTS + `Cache-Control: no-store` |
| **Password theft** (DB leak) | read the DB | scrypt + per-user salt; never logged or returned |
| **Account enumeration** | find which e-mails exist | register / forgot / resend always answer the same text |
| **Fake accounts** | register with someone else's e-mail | mandatory e-mail validation before login (single-use 24 h link) |
| **Social-login takeover** | pre-register a victim's e-mail, then use Google | no auto-link unless both e-mails verified; token verified with the provider incl. audience |
| **Injection** (SQL…) | malicious text | prepared statements only, whitelisted columns, strict validation of every input |
| **Race conditions** | double vote, lost move | transactions + primary keys (see README "Concurrency") |
| **Forged data** | fake track info / fake position | track metadata resolved server-side; licence evaluated server-side |
| **Leaked secrets** | keys on GitHub | `.env` git-ignored, CI fails if tracked, production refuses default secret |

## 3. Other hazards identified, and practicable protections (documented, not all implemented)
* **GPS spoofing** (place licence): the position comes from the phone. → combine with an *invited* licence, iBeacon/BLE proof (bonus), plausibility checks (impossible speed).
* **Vote manipulation with throw-away accounts**: → mandatory e-mail validation (done), CAPTCHA/phone verification at sign-up, account-age weighting.
* **Stolen/lost phone**: → remote disconnect (done), short sessions + refresh tokens, biometric lock in the app.
* **Man-in-the-middle** on public Wi-Fi: → HTTPS only in production (reverse proxy), certificate pinning in the app.
* **Multi-instance deployment**: in-memory limiter/lock-out are per process → use Redis; DB → PostgreSQL with backups and disk encryption.
* **Dependency vulnerabilities**: lockfiles + `npm audit` in CI.
* **Abuse of content** (offensive names): moderation/report endpoint (future).
"Not unbreakable" is acceptable: we show we thought about each and explain the next step.

## 4. Logs: "any action must generate logs, with platform / device / app version"
How it works:
1. The app adds three headers to **every** request (`mobile/src/api.js`): `X-Platform` (android / ios / web), `X-Device-Model` (e.g. *Pixel 9*, *iPhone 15*, or *Chrome on Windows* on the web), `X-App-Version` (from `app.config.js`).
2. A middleware in `backend/src/app.js` writes, after each response, one row in the table **`logs`** *and* a line in `logs/access.log`: timestamp, **user id**, method, path, status, **platform, device, app version**, IP, duration. Tokens and passwords are never logged.
3. Since every action of the remote-control app is an API call (vote, edit, command, login…), **every action is logged**. Screen views (pure UI actions) are sent too: `POST /logs {action:"screen:Events"}`.

Show it live:
```powershell
cd music-room
npm run logs          # last 20 entries from the database
npm run logs -- 50
Get-Content backend\logs\access.log -Tail 20     # (or music-room\logs\access.log depending on your start folder)
```
Example line:
`2026-11-19T16:57:48Z user=1 GET /events 200 4ms | platform=android | device=Pixel 9 | version=1.0.0 | ip=10.0.0.5`
The log test is `test/api.test.js` → "every request is logged with platform / device / version".
