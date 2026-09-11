"use client";

import { useSyncExternalStore } from "react";

// One shared clock for every live countdown on the page. It wakes just after each whole second, so a countdown to a
// whole-second target changes once a second without skipping or repeating a number, and it stops when nothing
// listens.

const TICK_MS = 1000;
// Timers can fire late but never early; the margin keeps a coarse browser clock from reading the previous second.
const WAKE_MARGIN_MS = 10;

const listeners = new Set<() => void>();
let snapshot = Date.now();
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleTick(): void {
  timer = setTimeout(tick, TICK_MS - (Date.now() % TICK_MS) + WAKE_MARGIN_MS);
}

function tick(): void {
  snapshot = Date.now();
  for (const listener of listeners) {
    listener();
  }
  scheduleTick();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    snapshot = Date.now();
    scheduleTick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

function subscribeNever(): () => void {
  return () => {};
}

function getSnapshot(): number {
  // While nothing listens, no tick refreshes the value, so a stale one is brought up to date. It moves at most once a
  // second, so back-to-back reads during one render agree.
  if (timer === null && Date.now() - snapshot >= TICK_MS) {
    snapshot = Date.now();
  }
  return snapshot;
}

/**
 * The current time in epoch milliseconds, updated every second while `live` is true.
 *
 * `serverNow` is the server clock when the page rendered. The server render and hydration use it, so the markup
 * matches; the browser clock takes over right after. While `live` is false this component stops receiving ticks.
 */
export function useNow(serverNow: number, live = true): number {
  return useSyncExternalStore(live ? subscribe : subscribeNever, getSnapshot, () => serverNow);
}
