// Minimal Capacitor bridge wrapper.
// This file must be safe to import in the browser (non-Capacitor).
// Custom native plugins must be registered with registerPlugin — checking
// window.Capacitor.Plugins.Recording alone is not enough on Capacitor 3+.

import { Capacitor, registerPlugin } from "@capacitor/core";

type RecordingStartArgs = {
  title?: string;
};

type RecordingStopResult = {
  ok: boolean;
  base64: string;
  mimeType: string;
  bytes: number;
};

/** Mirrors @CapacitorPlugin(name = "Recording") on Android. */
interface RecordingPlugin {
  start(options?: RecordingStartArgs): Promise<{ ok?: boolean }>;
  stop(): Promise<RecordingStopResult>;
}

const Recording = registerPlugin<RecordingPlugin>("Recording");

type CapWindow = Window &
  typeof globalThis & {
    Capacitor?: {
      getPlatform?: () => string;
      Plugins?: Record<string, unknown>;
    };
  };

function hasCapacitorRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as CapWindow).Capacitor !== "undefined"
  );
}

export function isNativeAndroidRecordingAvailable(): boolean {
  if (!hasCapacitorRuntime()) return false;
  return (
    Capacitor.getPlatform() === "android" &&
    Capacitor.isPluginAvailable("Recording")
  );
}

export async function nativeStartRecording(args: RecordingStartArgs = {}) {
  if (!Capacitor.isPluginAvailable("Recording")) {
    throw new Error("Recording plugin not available");
  }
  return await Recording.start(args);
}

export async function nativeStopRecording(): Promise<RecordingStopResult> {
  if (!Capacitor.isPluginAvailable("Recording")) {
    throw new Error("Recording plugin not available");
  }
  return (await Recording.stop()) as RecordingStopResult;
}

/** True when running inside the Capacitor Android shell (native recording path). */
export function isAndroidCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.getPlatform() === "android";
}

export async function startNativeRecording(
  args: RecordingStartArgs = {},
): Promise<void> {
  await nativeStartRecording(args);
}

export async function stopNativeRecording(): Promise<{
  blob: Blob;
  mimeType: string;
}> {
  const result = await nativeStopRecording();
  const mimeType = result.mimeType || "application/octet-stream";
  return {
    blob: base64ToBlob(result.base64, mimeType),
    mimeType,
  };
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}
