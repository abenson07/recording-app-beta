## Android sideload (hybrid Capacitor shell)

This repo includes a Capacitor Android shell under `android/`.

### Prereqs (local machine)

- Node + npm
- JDK 17+
- Android SDK (platform-tools / adb)
- USB debugging enabled on your phone

### Build the debug APK

From the repo root:

```bash
npm ci
npx cap sync android
cd android
./gradlew :app:assembleDebug
```

APK output:

- `android/app/build/outputs/apk/debug/app-debug.apk`

### Install on device (adb)

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Point WebView at your deployed web app

This shell is intended to load your deployed Next.js app over HTTPS.

Set `CAP_SERVER_URL` before running `npx cap sync android` (or before building if you want the config baked into assets):

```bash
export CAP_SERVER_URL="https://your-deployed-site.example"
npx cap sync android
```

Notes:

- Use an HTTPS origin.
- If you change `CAP_SERVER_URL`, re-run `npx cap sync android` before rebuilding.

### Recording behavior

- Uses a native microphone Foreground Service and an ongoing notification.
- On Android/Capacitor, the web UI calls the native plugin for start/stop and then uploads via the existing Supabase path.

