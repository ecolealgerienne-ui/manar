# Social login (Google / Facebook): how it works and how to enable it

## 1. The principle (what to explain at the defence)
The **app never decides who the user is**; the **back-end does**, after checking with the provider:

```
 Mobile app                          Google / Facebook                 Our back-end
 ──────────                          ─────────────────                 ────────────
 1. open the provider's login page ─▶ user logs in & consents
 2. receives a token  ◀────────────── Google: ID token (JWT)
                                      Facebook: access token
 3. POST /auth/social {provider, token} ───────────────────────────────▶
                                      ◀── 4. back-end asks the provider:
                                           Google  GET oauth2.googleapis.com/tokeninfo?id_token=…
                                                   → checks `aud` = OUR client id, gets sub / e-mail / name
                                           Facebook GET graph.facebook.com/debug_token (app token APP_ID|SECRET)
                                                   → checks is_valid and app_id = OUR app, then /me for id / e-mail / name
 5. ◀──────────────────────────────── our own session token (same as for a password login)
```
Why: if the back-end trusted `{email: "victim@x.com"}` sent by the app, anybody could log in as anybody. The token proves the provider authenticated that user *for our application*.

Account rules (`backend/src/auth.js`, `socialLogin` / `linkSocial`):
* known `(provider, provider_id)` → log in to the linked account;
* unknown but the provider's e-mail matches an existing account → **auto-link only if both e-mails are verified**, otherwise `409 EMAIL_EXISTS` (prevents account pre-hijacking); the user logs in and links from *Profile → Linked accounts*;
* otherwise → create a new account (no password), e-mail marked verified by the provider;
* a provider account can be linked to **one** user only (`409 ALREADY_LINKED`); the last login method cannot be unlinked.

Code map: mobile `src/social.js` (expo-auth-session hooks), `AuthScreen.js` (login/registration), `ProfileScreen.js` (linking); back-end `src/social.js` (verification), `src/auth.js`, route `POST /auth/social`, `POST/DELETE /me/social/:provider`; tests stub the provider (`backend/test/api.test.js`).

## 2. Enable Google
1. https://console.cloud.google.com → create a project → *APIs & Services → OAuth consent screen* (External, add yourself as test user).
2. *Credentials → Create credentials → OAuth client ID*:
   * **Web application**: *Authorized JavaScript origins* `http://localhost:8081` (and your LAN URL if you test from a phone's browser). Used for the web version.
   * **Android**: package `com.musicroom.app` + SHA-1 of your keystore (`npx expo credentials:manager` / `keytool`).
   * **iOS**: bundle id `com.musicroom.app`.
3. Back-end `.env`: `GOOGLE_CLIENT_IDS=<web id>,<android id>,<ios id>` (comma separated; the back-end accepts a token whose `aud` is any of them).
4. `mobile/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
Docs: https://developers.google.com/identity

## 3. Enable Facebook
1. https://developers.facebook.com → *My Apps → Create app* (type *Consumer*) → add the product **Facebook Login**.
2. *Facebook Login → Settings → Valid OAuth Redirect URIs*: add the redirect URI that expo-auth-session prints (log `request.redirectUri` once; for web it is `http://localhost:8081`).
3. Copy **App ID** and **App Secret** (*Settings → Basic*). Back-end `.env`: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (**never** in the mobile app). `mobile/.env`: `EXPO_PUBLIC_FACEBOOK_APP_ID`.
4. While the app is in *Development mode*, only the app's admins/testers can log in (add test users in *Roles*).
Docs: https://developers.facebook.com/docs/facebook-login

## 4. Restart and check
Restart the API and Expo. `GET /config` now returns `social: {google: true, facebook: true}`, the demo buttons disappear and the real *Google* / *Facebook* buttons appear.

## 5. Limits to know
* Google/Facebook redirects need a **real build** on phones (see `PHONE.md` §3); the web version and a development build work, Expo Go does not for custom redirects.
* The verification code is tested with a stub (no real provider in CI); the real round-trip must be tried with your own credentials.
* Without credentials and outside production, the app shows a clearly labelled **demo login** (`dev:<name>` token). It is refused as soon as real credentials are configured or `NODE_ENV=production`.
