// Countdown arithmetic for the live countdowns. It only splits a duration into whole units and formats no dates, so,
// unlike lib/format/datetime.ts, it is safe to run in the browser.

const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

/** Whole units left before a countdown's target. */
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * The days, hours, minutes, and seconds from `now` until `target` (both epoch milliseconds), or null once the target
 * is reached or either value is not finite. A partial second counts as a whole one, so a reading never shows zero
 * while time remains, and it ends exactly at the target.
 */
export function toCountdownParts(target: number, now: number): CountdownParts | null {
  if (!Number.isFinite(target) || !Number.isFinite(now) || now >= target) {
    return null;
  }
  const total = Math.ceil((target - now) / SECOND_MS);
  return {
    days: Math.floor(total / SECONDS_PER_DAY),
    hours: Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: total % SECONDS_PER_MINUTE,
  };
}
