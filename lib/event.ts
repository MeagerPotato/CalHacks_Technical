// =============================================================================
// Event constants: the time zone for applicant-facing timestamps, and the schedule that the landing page timeline,
// the countdowns, and the portal deadline card show.
//
// Read by server code only (pages and the view-model builders they run). Views receive formatted TimestampView
// values, so a visitor's locale or time zone can never change a label or cause a hydration mismatch.
//
// Every date is an ISO 8601 instant with an explicit UTC offset, or null while it is to be announced. Only set dates
// the event has announced; never guess one. The values are the Cal Hacks 13.0 regular application round published on
// https://www.calhacks.io/ (checked September 11, 2026). Where only a day is published, the value is midnight Pacific
// at the start of that day, and the site shows it as a date without a time.
// =============================================================================

/** IANA time zone for every applicant-facing timestamp. Formatting happens on the server (lib/format/datetime.ts). */
export const EVENT_TIME_ZONE = "America/Los_Angeles";

/** Whole days: midnight at the start of the first day, and midnight after the last day. */
export interface EventDates {
  startsAt: string;
  endsAt: string;
}

export interface EventSchedule {
  /** When applications opened. Null means they are open and no opening date is published ("Open now"). */
  applicationsOpenAt: string | null;
  applicationDeadline: string | null;
  /** The day decisions are released. */
  resultsReleasedOn: string | null;
  eventDates: EventDates | null;
}

/**
 * Application deadline, or null while it is to be announced (the portal then shows `COPY.portal.deadlineTba`). The
 * site shows it and counts down to it; nothing closes when it passes.
 */
// 11:59 PM Pacific Daylight Time on September 20, 2026.
export const APPLICATION_DEADLINE: string | null = "2026-09-20T23:59:00-07:00";

/** The published schedule. */
export const EVENT_SCHEDULE: EventSchedule = {
  // No opening date is published.
  applicationsOpenAt: null,
  applicationDeadline: APPLICATION_DEADLINE,
  // Regular-round decisions: September 25, 2026.
  resultsReleasedOn: "2026-09-25T00:00:00-07:00",
  // October 23 to 25, 2026. No start time is published, so the event countdown ends at midnight Pacific on October 23.
  eventDates: { startsAt: "2026-10-23T00:00:00-07:00", endsAt: "2026-10-26T00:00:00-07:00" },
};
