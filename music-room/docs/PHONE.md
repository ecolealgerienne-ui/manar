# Test the app on a phone

Both devices must be on the **same Wi-Fi**. Replace `192.168.1.137` by your PC's IPv4 address (`ipconfig` in PowerShell → "Adresse IPv4").

## 0. Allow the ports (Windows)
Windows Firewall asks the first time Node.js starts: tick **Private networks** and allow. Ports used: **4000** (API) and **8081** (Expo).
To open them by hand (PowerShell as administrator):
```powershell
New-NetFirewallRule -DisplayName "MusicRoom" -Direction Inbound -Protocol TCP -LocalPort 4000,8081 -Action Allow -Profile Private
```

## 1. Start the two servers
```powershell
cd music-room
npm start          # terminal 1: API on port 4000
npm run mobile     # terminal 2: Expo (shows a QR code)
```

## 2a. Quickest: the phone's browser (no app to install)
Open `http://192.168.1.137:8081` in Chrome/Safari on the phone, then at the bottom of the login screen set
**Server address** = `http://192.168.1.137:4000` and tap *Save address*. Never use `localhost` on a phone: it means the phone itself.

## 2b. Real app with Expo Go
1. Install **Expo Go** (Play Store / App Store).
2. Android: open Expo Go → *Scan QR code*. iPhone: scan the QR code with the Camera app.
3. On the login screen set **Server address** = `http://192.168.1.137:4000`.

Problems:
| Symptom | Fix |
|---|---|
| "Project is incompatible with this version of Expo Go" | the store's Expo Go supports the latest SDK: run `npx expo install expo@latest --fix` in `mobile/`, or install the Expo Go matching SDK 52 from expo.dev/go (Android) |
| Phone cannot load the bundle | firewall (step 0), or different Wi-Fi / "client isolation" on a guest network; try `npx expo start --tunnel` |
| App opens but "Cannot reach the server" | wrong IP in *Server address*, API not running, firewall on port 4000 |
| Network is isolated (university Wi-Fi) | tunnel the API too: `npx localtunnel --port 4000` and use the https URL it prints as server address |

## 2c. Emulators
* **Android Studio emulator**: press `a` in the Expo terminal. The emulator reaches your PC at **`http://10.0.2.2:4000`** (not localhost).
* **iOS simulator** (macOS only): press `i`; `http://localhost:4000` works.

## 3. Native builds (needed for real Google/Facebook login on a phone)
Expo Go cannot use your own OAuth redirect scheme (`musicroom://`), so Google/Facebook sign-in on a phone needs a development build:
```powershell
cd mobile
npx expo run:android      # needs Android Studio + a USB-connected phone or an emulator
# or: npx eas build --profile development --platform android|ios   (Expo account)
```
See `SOCIAL-LOGIN.md`.
