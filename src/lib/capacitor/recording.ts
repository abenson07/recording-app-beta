// Minimal Capacitor bridge wrapper.
// This file must be safe to import in the browser (non-Capacitor).

type RecordingStartArgs = {
  title?: string;
};

type RecordingStopResult = {
  ok: boolean;
  base64: string;
  mimeType: string;
  bytes: number;
};

function hasCapacitorRuntime(): boolean {
  type CapWindow = Window &
    typeof globalThis & {
      Capacitor?: {
        getPlatform?: () => string;
        Plugins?: Record<string, unknown>;
      };
    };

  return (
    typeof window !== "undefined" &&
    typeof (window as CapWindow).Capacitor !== "undefined" &&
    typeof (window as CapWindow).Capacitor?.Plugins !== "undefined"
  );
}

export function isNativeAndroidRecordingAvailable(): boolean {
  if (!hasCapacitorRuntime()) return false;
  const cap = (window as CapWindow).Capacitor;
  return cap?.getPlatform?.() === "android" && !!cap?.Plugins?.Recording;
}

export async function nativeStartRecording(args: RecordingStartArgs = {}) {
  const cap = (window as CapWindow).Capacitor;
  if (!cap?.Plugins?.Recording) {
    throw new Error("Recording plugin not available");
  }
  return await cap.Plugins.Recording.start(args);
}

export async function nativeStopRecording(): Promise<RecordingStopResult> {
  const cap = (window as CapWindow).Capacitor;
  if (!cap?.Plugins?.Recording) {
    throw new Error("Recording plugin not available");
  }
  return (await cap.Plugins.Recording.stop()) as RecordingStopResult;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

