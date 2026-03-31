import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Web assets: `webDir` is Next static export output (`out/` after `next build`).
 *
 * Default (no env): WebView loads the bundled site from the APK — no hosting required.
 * Optional debugging: set CAP_SERVER_URL to an https:// origin (deployed app or dev
 * tunnel) before `npx cap sync android` so the shell loads that URL instead of `out/`.
 */
const config: CapacitorConfig = {
  appId: 'com.example.recordingappbeta',
  appName: 'RecordingAppBeta',
  webDir: 'out',
  server: process.env.CAP_SERVER_URL
    ? {
        url: process.env.CAP_SERVER_URL,
        cleartext: false,
      }
    : undefined,
};

export default config;
