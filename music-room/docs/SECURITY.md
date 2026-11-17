# Security

## Implemented protections
| Hazard | Protection |
|---|---|
| Password theft from DB | scrypt (N=16384, per-user 16-byte salt), constant-time compare; never logged or returned |
| Password brute force | per-IP rate limit on `/auth/*` (+ global limit) **and** per-account lock-out (5 failures → 15 min). Uniform error message, dummy hash for unknown e-mails (no timing oracle) |
| Account enumeration | `register`, `forgot-password`, `resend-verification` always answer the same message |
| Session theft | random 256-bit opaque tokens, only a keyed HMAC-SHA256 stored (DB leak ≠ usable tokens), 7-day expiry, logout, `GET /me/sessions` (current device flagged), `DELETE /me/sessions/:id` and `DELETE /me/sessions` (all other devices) to disconnect a lost or suspicious device, all sessions revoked on password reset, `Cache-Control: no-store`, HSTS. **Use HTTPS in production** (reverse proxy) |
| Fake accounts / mail takeover | mandatory e-mail validation (single-use, 24 h link) before login; reset code single-use, 30 min |
| Social-login takeover | token verified server-side with Google/Facebook (audience / app id checked); no automatic merge with an existing password account unless **both** e-mails are verified; cannot link a provider account already used by another user; cannot unlink the last login method |
| Access to other users' data (IDOR) | every route checks ownership / visibility / invitation / licence in one place (`services.js`); private resources answer **404** (existence not leaked); profile fields filtered by public / friends / private |
| Injection | prepared statements only; whitelisted column names; JSON body size limit (50 kB), strict validation of every input |
| Race conditions (double vote, lost move) | write transactions (`BEGIN IMMEDIATE`), `PRIMARY KEY (track,user)` for votes, unique `(event,track)`, server-side operation based playlist editing |
| Client-forged data | track metadata resolved server-side from the catalog, never taken from the client; geo/time licence evaluated on the server |
| Abuse / DoS | rate limiting, queue/playlist size caps, WebSocket payload cap (4 kB) + 5 s auth timeout |
| Secrets in git | `.env` git-ignored, only `.env.example`; CI fails if a `.env` is tracked; production refuses the default `TOKEN_SECRET` |
| Traceability | every API call logged server-side with user, platform, device model, app version, IP, status, latency (DB table `logs` + `logs/access.log`); mobile UI actions via `POST /logs` |

## Known residual hazards and practical protections
* **GPS spoofing** for the geo/time licence: the position is supplied by the client and cannot be fully trusted. Mitigations: combine with `invited`, BLE beacons (bonus IoT), shorter windows, server-side anomaly checks (impossible speed).
* **Vote manipulation with throw-away accounts**: mandatory e-mail validation, per-IP limits; next steps: CAPTCHA at signup, reputation / account age.
* **In-memory rate limiter / lock-out** is per process: use Redis when running several instances; behind a proxy set `trust proxy` correctly so IPs are real.
* **Stolen phone**: session list/revocation and password change revoke access; consider shorter sessions + refresh tokens.
* **SQLite file** must be on an encrypted, backed-up volume; use PostgreSQL for multi-node.
* **Dependencies**: `npm audit` in CI, lockfile committed.
