# Bonus part (Chapter VI): what is asked

> The bonus is assessed **only if the mandatory part is perfect**. It is optional and **none of it is claimed in this project**.

| # | Bonus | What the subject asks | Idea for this project | Effort |
|---|---|---|---|---|
| VI.1 | **Multi-platform** | Besides Android/iOS, make the service available on the **web, responsive** (adapts to any screen). Can mean rewriting the client | The Expo app already builds for web (`npx expo export --platform web`) and the layout uses responsive grids (1–4 columns). To claim it: host the build (e.g. static hosting), test phone/tablet/desktop widths, and say so in the README | small |
| VI.2 | **IoT reflection** | A mechanism such as **iBeacon** on an event: when people get near a *public* event registered on the service, they automatically receive info (event, how to join, music style) | Store a beacon UUID/major/minor on an event (`events.beacon_*`), add `GET /events/nearby?uuid=…`; in the app use a BLE library (needs a native build, e.g. `react-native-beacons-manager`) to detect it and show a notification card | medium–large (native, hardware) |
| VI.3 | **Free vs paid subscription** | Two offers set beforehand (free limited / paid unlimited); the user can **switch**; some features (e.g. **Playlist Editor**) only for paid users | `users.plan` ('free'/'premium'), `POST /me/plan`, a `requirePlan('premium')` check in `editPlaylist` + limits (e.g. free = 1 playlist, 10 tracks), a *Plans* screen in the app; payments can be simulated | small–medium |
| VI.4 | **Offline mode** | Use the app without network; different features offline; **synchronise** later; handle **conflicts/concurrency** and **obsolete data** | Cache last playlists/events (AsyncStorage) for reading; queue offline actions (add/vote/move) and replay them on reconnect using the existing `expectedVersion` → `409 VERSION_CONFLICT` to detect conflicts and re-fetch; timestamp/version caches to drop stale data | large |

Recommendation: first make sure every mandatory item is flawless on the defence machine (see the table in the README); then VI.3 and VI.1 are the cheapest bonuses to add.
