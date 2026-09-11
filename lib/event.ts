// =============================================================================
// Event constants for applicant-facing timestamps and the application deadline.
//
// Read by server code only (pages and the view-model builders they run). Views receive formatted TimestampView
// values, so a visitor's locale or time zone can never change a label or cause a hydration mismatch.
// =============================================================================

/** IANA time zone for every applicant-facing timestamp. Formatting happens on the server (lib/format/datetime.ts). */
export const EVENT_TIME_ZONE = "America/Los_Angeles";

/**
 * Application deadline as an ISO 8601 instant with an explicit UTC offset, or null while it is to be announced (the
 * portal then shows `COPY.portal.deadlineTba`). Only set a deadline the event has announced; never guess one.
 */
// 5:00 PM Pacific Daylight Time on September 11, 2026.
export const APPLICATION_DEADLINE: string | null = "2026-09-11T17:00:00-07:00";
