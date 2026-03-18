import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  cb();
  return () => {};
};

/**
 * Returns `true` on the client after hydration, `false` during SSR.
 * Useful for gating browser-only effects like canvas animations.
 */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
