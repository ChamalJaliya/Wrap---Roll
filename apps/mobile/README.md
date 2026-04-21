# Wrap & Roll — mobile (Expo)

Customer app MVP: menu, cart (local), order tracking. Online checkout / PayHere is not implemented here yet; use the web storefront to pay.

## Prerequisites

- Node.js and npm (workspace root).
- iOS: Xcode (for Simulator or device builds). Android Studio is optional for Android.

## Configure the API URL

1. Copy [`.env.example`](./.env.example) to `.env` in this folder.
2. Set `EXPO_PUBLIC_API_URL` to your Nest API base **including** `/api`:
   - **iOS Simulator** on the same Mac as the API: `http://127.0.0.1:4000/api`
   - **Physical device**: use the host machine’s LAN IP, e.g. `http://192.168.1.42:4000/api`, and ensure the API listens on `0.0.0.0` (default in this repo).

Restart Expo after changing env vars.

## Run

From the monorepo root:

```bash
npm run start:mobile
```

Or from this directory: `npm run start`, then press `i` for iOS Simulator.

## Monorepo / shared types

[`metro.config.js`](./metro.config.js) watches the repo root so Metro can bundle [`libs/contracts`](../../libs/contracts). [`babel.config.js`](./babel.config.js) maps `@wrap-roll/contracts` to that library.

## Supabase (optional)

For future sign-in, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same values as the web client). In the Supabase dashboard, add a redirect URL for native auth, e.g. `wraproll://auth/callback` (see [`app/auth/callback.tsx`](./app/auth/callback.tsx)).

## Xcode and native projects

Expo runs in managed mode without committing `ios/` / `android/` by default. To open **Xcode** (custom native code, signing, or device debugging):

```bash
cd apps/mobile
npx expo prebuild
xed ios
```

Use your Apple team for signing on a physical device. After prebuild, you can run `npx expo run:ios` or build from Xcode.

## Troubleshooting

- **`ECONNREFUSED`**: The app cannot reach the Nest process on that host/port.
  - **API not running**: From the repo root run `npm run start:api` (listens on `0.0.0.0:4000`).
  - **iOS Simulator**: default base URL is `http://127.0.0.1:4000/api` — must match a server on your Mac.
  - **Android Emulator**: the app defaults to `http://10.0.2.2:4000/api` (special alias to the host). Do **not** use `127.0.0.1` on the emulator unless you override via `EXPO_PUBLIC_API_URL`.
  - **Physical phone (Expo Go / dev build)**: `127.0.0.1` is the phone itself — set `EXPO_PUBLIC_API_URL` to your computer’s LAN IP, e.g. `http://192.168.1.42:4000/api`, same Wi‑Fi as the device.
- **Bundle errors for `@wrap-roll/contracts`**: Ensure `npm install` was run at the monorepo root so `libs/contracts` and `zod` resolve.
