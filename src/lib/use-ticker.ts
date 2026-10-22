"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared clock for screens that show "12 s ago". One timer per interval no
 * matter how many components read it, and it stops when none are mounted.
 * The server snapshot is 0 (those labels only render once data has loaded).
 */
function createTicker(intervalMs: number) {
  const listeners = new Set<() => void>();
  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (timer === undefined) {
      now = Date.now();
      timer = setInterval(() => {
        now = Date.now();
        listeners.forEach((l) => l());
      }, intervalMs);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };
  };

  return () => useSyncExternalStore(subscribe, () => now, () => 0);
}

/** Current time in ms, refreshed every second. */
export const useSecondTick = createTicker(1_000);
/** Current time in ms, refreshed every 5 s (cheaper: for re-deriving lists). */
export const useSlowTick = createTicker(5_000);
