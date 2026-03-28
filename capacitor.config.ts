import type { CapacitorConfig } from '@capacitor/cli';

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
