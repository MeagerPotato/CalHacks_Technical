import { COPY } from "@/content/copy";
import { toCountdownParts } from "@/lib/format/countdown";
import type { CountdownReadingView, CountdownTimerView, CountdownUnit } from "@/lib/view-models/types";

// =============================================================================
// Live countdown readings.
//
// Unlike the other builders, the browser runs this one every second (app/_components/LiveCountdowns.tsx). It formats
// no dates, only whole numbers, so the server render and the browser produce the same text for the same moment.
// =============================================================================

const UNITS = ["days", "hours", "minutes", "seconds"] as const satisfies readonly CountdownUnit[];

// Days can pass two digits; the smaller units keep two so the reading does not change width every second.
function unitValue(unit: CountdownUnit, value: number): string {
  return unit === "days" ? String(value) : String(value).padStart(2, "0");
}

/** One countdown at `now` (epoch milliseconds): its units and a summary while counting, or its complete text. */
export function toCountdownReading(timer: CountdownTimerView, now: number): CountdownReadingView {
  const parts = toCountdownParts(Date.parse(timer.endsAt), now);
  if (parts === null) {
    return { id: timer.id, state: "complete", units: [], summary: timer.completeText };
  }
  return {
    id: timer.id,
    state: "counting",
    units: UNITS.map((unit) => ({
      unit,
      value: unitValue(unit, parts[unit]),
      label: COPY.schedule.countdown.units[unit],
    })),
    summary: COPY.schedule.countdown.remaining(parts.days, parts.hours, parts.minutes),
  };
}
