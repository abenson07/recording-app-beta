"use client";

/**
 * Local single-user mode: keep app data paths active without auth/session checks.
 */
export function useRecordingSession() {
  return { ready: true, authError: null };
}
