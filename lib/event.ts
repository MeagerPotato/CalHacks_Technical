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
 * portal then shows `COPY.portal.deadlineTba`). Set the real ISO deadline when the user provides it; never guess one.
 */
export const APPLICATION_DEADLINE: string | null = null;
