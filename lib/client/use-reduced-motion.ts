"use client";

import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) {
    return () => {};
  }
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

// The server cannot know the preference; false keeps hydration consistent.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the user prefers reduced motion, kept in sync with the OS setting.
 *
 * Use it only for post-mount timers (for example the liftoff delay). Visual motion must use CSS `motion-safe:`
 * utilities or `@media (prefers-reduced-motion)` rules so it is correct before hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Non-hook version for event handlers, read at call time. Always false on the server. */
export function prefersReducedMotion(): boolean {
  return getSnapshot();
}
