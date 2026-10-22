import { createJSONStorage } from "zustand/middleware";

/**
 * localStorage for zustand `persist`, guarded: private windows, blocked site
 * data and the server all throw or lack `window` — then nothing is stored and
 * the store keeps its defaults.
 */
export const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
});
