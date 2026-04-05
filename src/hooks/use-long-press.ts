"use client";

import { useCallback, useRef } from "react";

const DEFAULT_MS = 550;

type Options = {
  onLongPress: () => void;
  thresholdMs?: number;
};

/**
 * Pointer long-press; suppresses the following click so navigation does not fire.
 */
export function useLongPress({ onLongPress, thresholdMs = DEFAULT_MS }: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      suppressClickRef.current = false;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        suppressClickRef.current = true;
        onLongPress();
      }, thresholdMs);
    },
    [clearTimer, onLongPress, thresholdMs],
  );

  const onPointerEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const consumeClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onPointerDown,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onPointerLeave: onPointerEnd,
    consumeClick,
  };
}
