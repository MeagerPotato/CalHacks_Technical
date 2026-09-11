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

// Date-only labels are assembled from parts, so a range reads the same on every host.
const EVENT_NAMED_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

const EVENT_NUMERIC_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const RANGE_DASH = "–";

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

interface CalendarDay {
  /** YYYY-MM-DD, a valid `<time dateTime>` value. */
  iso: string;
  year: string;
  /** Short month name, for example "Oct". */
  month: string;
  day: string;
}

function dateParts(format: Intl.DateTimeFormat, time: number): { year: string; month: string; day: string } {
  const parts = { year: "", month: "", day: "" };
  for (const part of format.formatToParts(time)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      parts[part.type] = part.value;
    }
  }
  return parts;
}

/** The calendar day an instant falls on in the event time zone. */
function toCalendarDay(time: number): CalendarDay {
  const numeric = dateParts(EVENT_NUMERIC_DATE_FORMAT, time);
  const named = dateParts(EVENT_NAMED_DATE_FORMAT, time);
  return { iso: `${numeric.year}-${numeric.month}-${numeric.day}`, year: named.year, month: named.month, day: named.day };
}

function dayLabel(day: CalendarDay): string {
  return `${day.month} ${day.day}, ${day.year}`;
}

/**
 * The event-time-zone calendar day of an instant, for milestones published without a time: `iso` is YYYY-MM-DD and
 * `label` is, for example, "Sep 25, 2026". Returns null for a missing, blank, or unparseable value.
 */
export function toDateView(iso: string | null | undefined): TimestampView | null {
  const time = typeof iso === "string" ? parseInstant(iso) : Number.NaN;
  if (Number.isNaN(time)) {
    return null;
  }
  const day = toCalendarDay(time);
  return { iso: day.iso, label: dayLabel(day) };
}

/**
 * The days from `startsAt` up to, but not including, `endsAt`, in the event time zone. `iso` is the first day
 * (YYYY-MM-DD). `label` names the range compactly: "Oct 23, 2026" for one day, "Oct 23–25, 2026" within a month,
 * "Oct 30 – Nov 1, 2026" across months, and "Dec 31, 2026 – Jan 2, 2027" across years. Returns null when either value
 * is unparseable or `endsAt` is not after `startsAt`.
 */
export function toDateRangeView(startsAt: string, endsAt: string): TimestampView | null {
  const start = parseInstant(startsAt);
  const end = parseInstant(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null;
  }
  const first = toCalendarDay(start);
  // `endsAt` is exclusive, so the last day is the one holding the instant just before it.
  const last = toCalendarDay(end - 1);

  let label: string;
  if (first.iso === last.iso) {
    label = dayLabel(first);
  } else if (first.year !== last.year) {
    label = `${dayLabel(first)} ${RANGE_DASH} ${dayLabel(last)}`;
  } else if (first.month !== last.month) {
    label = `${first.month} ${first.day} ${RANGE_DASH} ${dayLabel(last)}`;
  } else {
    label = `${first.month} ${first.day}${RANGE_DASH}${last.day}, ${last.year}`;
  }
  return { iso: first.iso, label };
}
