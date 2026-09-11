import { describe, expect, it } from "vitest";

import { APPLICATION_DEADLINE, EVENT_TIME_ZONE } from "@/lib/event";
import { formatEventDateTime, toTimestampView } from "@/lib/format/datetime";

describe("event constants", () => {
  it("uses Pacific time and a deadline that is null or a parseable instant", () => {
    expect(EVENT_TIME_ZONE).toBe("America/Los_Angeles");
    expect(APPLICATION_DEADLINE === null || toTimestampView(APPLICATION_DEADLINE) !== null).toBe(true);
  });
});

describe("formatEventDateTime", () => {
  it("formats summer instants in PDT", () => {
    expect(formatEventDateTime("2026-09-10T22:04:05.000Z")).toBe("Sep 10, 2026, 3:04 PM PDT");
  });

  it("formats winter instants in PST", () => {
    expect(formatEventDateTime("2026-12-01T20:30:00.000Z")).toBe("Dec 1, 2026, 12:30 PM PST");
    expect(formatEventDateTime("2026-01-15T08:00:00-08:00")).toBe("Jan 15, 2026, 8:00 AM PST");
  });

  it("switches abbreviations at the daylight saving boundary", () => {
    expect(formatEventDateTime("2026-03-08T09:59:00Z")).toBe("Mar 8, 2026, 1:59 AM PST");
    expect(formatEventDateTime("2026-03-08T10:00:00Z")).toBe("Mar 8, 2026, 3:00 AM PDT");
  });

  it("accepts Postgres timestamps with microseconds", () => {
    expect(formatEventDateTime("2026-09-10T22:04:05.123456+00:00")).toBe("Sep 10, 2026, 3:04 PM PDT");
  });

  it("uses plain spaces whatever the ICU data", () => {
    const label = formatEventDateTime("2026-09-10T22:04:05Z");
    expect(label).not.toContain(String.fromCharCode(0x202f));
    expect(label).not.toContain(String.fromCharCode(0xa0));
  });

  it("throws a RangeError for values that are not ISO instants with an offset", () => {
    for (const value of ["not a date", "", "2026-09-10", "2026-09-10T22:04:05", "Sep 10, 2026 3:04 PM"]) {
      expect(() => formatEventDateTime(value), value).toThrow(RangeError);
    }
  });

  it("rejects impossible calendar values instead of rolling them into another day", () => {
    // Date.parse alone accepts these and silently moves them to a later date.
    expect(Number.isNaN(Date.parse("2026-02-30T17:00:00Z"))).toBe(false);
    for (const value of [
      "2026-02-29T17:00:00Z",
      "2026-02-30T17:00:00Z",
      "2026-04-31T17:00:00Z",
      "2026-00-10T17:00:00Z",
      "2026-09-10T24:00:00Z",
      "2026-09-10T23:60:00Z",
      "2026-09-10T23:59:60Z",
    ]) {
      expect(() => formatEventDateTime(value), value).toThrow(RangeError);
    }
  });

  it("accepts a real leap day", () => {
    expect(formatEventDateTime("2028-02-29T20:00:00Z")).toBe("Feb 29, 2028, 12:00 PM PST");
  });
});

describe("toTimestampView", () => {
  it("returns the normalized instant and its event-time label", () => {
    expect(toTimestampView("2026-09-10T22:04:05.123456+00:00")).toEqual({
      iso: "2026-09-10T22:04:05.123Z",
      label: "Sep 10, 2026, 3:04 PM PDT",
    });
    expect(toTimestampView("2026-12-01T12:30:00-08:00")).toEqual({
      iso: "2026-12-01T20:30:00.000Z",
      label: "Dec 1, 2026, 12:30 PM PST",
    });
  });

  it("keeps an already-normalized ISO string unchanged", () => {
    expect(toTimestampView(" 2026-09-01T10:00:00.000Z ")?.iso).toBe("2026-09-01T10:00:00.000Z");
  });

  it.each([
    null,
    undefined,
    "",
    "   ",
    "not a date",
    "2026-13-45T00:00:00Z",
    "2026-02-30T12:00:00Z",
    "2026-09-10T24:00:00Z",
    "2026-09-10T22:04:05",
  ])(
    "returns null for %j",
    (value) => {
      expect(toTimestampView(value)).toBeNull();
    },
  );
});
