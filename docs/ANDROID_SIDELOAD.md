## Android sideload (hybrid Capacitor shell)

This repo includes a Capacitor Android shell under `android/`. The Next.js app is built as a **static export** into `out/` ([`next.config.ts`](../next.config.ts) `output: 'export'`), then copied into the APK when you sync.

### Default: bundled UI (no hosting)

The WebView loads **HTML/JS/CSS from inside the app**. You do **not** need Vercel or any deployed URL for normal use.

1. **Environment:** ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and your publishable/anon key — they are baked into the client bundle at build time.
2. From the **repo root**:

```bash
npm ci   # once
npm run build
npx cap sync android
```

3. Open the `android/` folder in Android Studio and use **Build → Generate App Bundles or APKs → Generate APKs**, or from a terminal:

```bash
cd android
./gradlew :app:assembleDebug
```

4. Install `android/app/build/outputs/apk/debug/app-debug.apk` on your device (`adb install -r …` or copy the file).

Whenever you change the **web** app, run **`npm run build`** then **`npx cap sync android`** before rebuilding the APK.

---

### Remote dev URL (optional)

For faster iteration, you can point the WebView at a **live HTTPS URL** instead of the bundled `out/` files. Set **`CAP_SERVER_URL`** before `npx cap sync android`:

```bash
export CAP_SERVER_URL="https://your-preview-or-tunnel.example"
npx cap sync android
```

Then rebuild the APK. The shell loads that site (like a browser). Use cases:

- **Deployed preview** (e.g. Vercel) without shipping a new static bundle each time.
- **HTTPS tunnel** to `npm run dev` on your laptop (ngrok, cloudflared, etc.) — tunnel + dev server must stay running.

If you **unset** `CAP_SERVER_URL` and run `npx cap sync android` again, the next build uses **bundled** assets from `out/`.

See comments in [`capacitor.config.ts`](../capacitor.config.ts).

---

### Prereqs (local machine)

- Node + npm
- **JDK 21** for Gradle (this project targets Java 21 in `android/app/capacitor.build.gradle`). In Android Studio: **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** — pick **JDK 21** or **Embedded JDK** if it is 21+.
- Android SDK (platform-tools / adb)
- USB debugging enabled on your phone (if using `adb install`)

### Troubleshooting

**`Could not find compile target android-XX` (SDK Manager says installed)**  
Google’s newer SDKs use folders like `android-37.0` and `android-36.1`, but Gradle looks for `android-37` and `android-36`. The project uses **`compileSdkVersion 36`** in [`variables.gradle`](../android/variables.gradle); add symlinks once under your SDK’s `platforms/` folder (path from **Android SDK Location** in SDK Manager):

```bash
cd ~/Library/Android/sdk/platforms   # change if your SDK path differs
ln -sf android-36.1 android-36
ln -sf android-37.0 android-37
```

After this, **Sync Gradle** again; in **Cursor**, run **Developer: Reload Window** if the error banner is stale.

**`invalid source release: 21`**  
Gradle is not using JDK 21. Set **Gradle JDK** to 21 in Android Studio (see prereqs above), or install Temurin 21 and point `JAVA_HOME` to it for command-line builds.

### Install on device (adb)

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Recording behavior

- Uses a native microphone Foreground Service and an ongoing notification.
- On Android/Capacitor, the web UI calls the native plugin for start/stop and then uploads via the existing Supabase path.
