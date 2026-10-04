# PIW for Android

Native Android client for the Personal Intelligence Workspace, built with Expo (React Native).
The UI is rendered with real Android views, not a WebView. Data lives in on-device SQLite, so the app works offline,
and it syncs with the web app through `/api/v1/sync/push` and `/api/v1/sync/pull`, using the same HLC protocol as the
web client.

**Phase 1 modules:** Today, Tasks (subtasks, recurrence, priority, due dates), Calendar (time blocks), Habits
(streaks, pauses), Notes (Markdown), Settings.

## How it fits together

```
Android app (Expo)                       Web app (Next.js on Vercel)          Supabase
 ├─ SQLite mirror + outbox  ──push/pull──▶ /api/v1/sync/*  ───drizzle───────▶ Postgres
 └─ supabase-js auth  ─────────────────────────────────────────────────────▶ Auth
        (Bearer access token on every sync request)
```

## Develop without Android Studio

1. `cp .env.example .env` and fill in the Supabase URL/key and `EXPO_PUBLIC_API_URL`.
   For local testing you can point the API URL at your PC while it runs `npm run dev`, e.g. `http://192.168.1.20:3100`.
2. `npm install`
3. `npm run tunnel` (or `npm start` if the phone is on the same Wi-Fi)
4. On the phone, install **Expo Go** from the Play Store and scan the QR code. The app hot-reloads as you edit.

Checks: `npm run typecheck`, `npm run lint`, `npx expo-doctor`.

## Build the APK (in the cloud)

The workflow `.github/workflows/build-android-apk.yml` builds a signed release APK on GitHub's runners:

1. Add these repository secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`.
2. Push changes under `mobile/` to `main`, or run the workflow manually from the **Actions** tab.
3. Open the new **Release** (`android-v1.0.N`) on your phone, download the APK and install it.

Release builds only allow HTTPS, so `EXPO_PUBLIC_API_URL` must be your deployed `https://…` URL. You can also change
it later in the app under Settings → Server.

### Stable signing (recommended)

Without a keystore, APKs are signed with the Expo template's debug key. To use your own key, generate one once
(any machine with a JDK, or a throwaway GitHub Codespace):

```sh
keytool -genkeypair -v -keystore piw.keystore -alias piw -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 piw.keystore   # value for ANDROID_KEYSTORE_BASE64
```

Then add the secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD`. Changing the key later means uninstalling the old app once.

## Code map

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router screens (`(tabs)/` is the bottom tab bar) |
| `src/lib/db.ts` | SQLite store, entity types, reactive hooks |
| `src/lib/sync.ts` | Outbox, HLC, push/pull, full reconcile |
| `src/lib/domain.ts` | Business rules ported from the web app (scoring, recurrence, streaks) |
| `src/components/` | Shared UI |
