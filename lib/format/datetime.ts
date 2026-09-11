import { EVENT_TIME_ZONE } from "@/lib/event";
import type { TimestampView } from "@/lib/view-models/types";

// Only server code calls these helpers: pages, layouts, and the view-model builders they run. Formatting once on the
// server, in the fixed event time zone, means the browser never formats a date, so a visitor's locale or time zone can
// never cause a hydration mismatch. The module is not `server-only` so the pure builders stay unit-testable.

const EVENT_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

// A date, a time, optional seconds and fraction, and an explicit offset. Without an offset, ECMAScript would read the
// value in the server's local time zone, so the same string could name different instants on different hosts.
const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

// Postgres timestamptz strings carry microseconds; the ECMAScript date format only defines milliseconds.
const EXTRA_FRACTION_DIGITS = /(\.\d{3})\d+/;

// Some ICU versions put a narrow no-break space before AM/PM; plain spaces keep labels identical across hosts.
const WHITESPACE_RUN = /\s+/g;

// Engines roll impossible dates forward (V8 reads "2026-02-30" as March 2 and "T24:00" as the next midnight), which
// would label a mistyped deadline with a different day, so the fields are checked before parsing.
function isRealDateTime([, year, month, day, hour, minute, second = "00"]: RegExpExecArray): boolean {
  const monthNumber = Number(month);
  // Day 0 of the following month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate();
  return (
    monthNumber >= 1 &&
    monthNumber <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= daysInMonth &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59
  );
}

/** Milliseconds since the epoch, or NaN when the value is not a real ISO 8601 instant with an offset. */
function parseInstant(iso: string): number {
  const value = iso.trim();
  const match = ISO_INSTANT_PATTERN.exec(value);
  if (match === null || !isRealDateTime(match)) {
    return Number.NaN;
  }
  return Date.parse(value.replace(EXTRA_FRACTION_DIGITS, "$1"));
}

function formatInstant(time: number): string {
  return EVENT_DATE_TIME_FORMAT.format(time).replace(WHITESPACE_RUN, " ");
}

/**
 * Formats an ISO 8601 instant in the event time zone with its zone abbreviation, for example
 * "Sep 10, 2026, 3:04 PM PDT". Accepts Postgres timestamps with microseconds.
 *
 * @throws RangeError when `iso` is not an ISO 8601 instant with an offset. Use `toTimestampView` for optional values.
 */
export function formatEventDateTime(iso: string): string {
  const time = parseInstant(iso);
  if (Number.isNaN(time)) {
    throw new RangeError("Expected an ISO 8601 date-time with a UTC offset.");
  }
  return formatInstant(time);
}

/**
 * Builds the display-ready timestamp passed to views. `iso` is normalized to UTC with millisecond precision, which is
 * always a valid `<time dateTime>` value. Returns null for a missing, blank, or unparseable value, so an
 * "Invalid Date" label can never render.
 */
export function toTimestampView(iso: string | null | undefined): TimestampView | null {
  if (typeof iso !== "string") {
    return null;
  }
  const time = parseInstant(iso);
  if (Number.isNaN(time)) {
    return null;
  }
  return { iso: new Date(time).toISOString(), label: formatInstant(time) };
}
