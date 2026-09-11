import { describe, expect, it } from "vitest";

import { APPLICATION_DEADLINE, EVENT_SCHEDULE, EVENT_TIME_ZONE } from "@/lib/event";
import { formatEventDateTime, toDateRangeView, toDateView, toTimestampView } from "@/lib/format/datetime";

describe("event constants", () => {
  it("uses Pacific time, and every schedule date is null or a parseable instant, in schedule order", () => {
    expect(EVENT_TIME_ZONE).toBe("America/Los_Angeles");
    expect(EVENT_SCHEDULE.applicationDeadline).toBe(APPLICATION_DEADLINE);

    const { applicationsOpenAt, applicationDeadline, resultsReleasedOn, eventDates } = EVENT_SCHEDULE;
    const instants = [applicationsOpenAt, applicationDeadline, resultsReleasedOn, eventDates?.startsAt, eventDates?.endsAt]
      .filter((value): value is string => typeof value === "string")
      .map((value) => {
        const view = toTimestampView(value);
        expect(view, value).not.toBeNull();
        return Date.parse(view?.iso ?? "");
      });
    expect(instants).toEqual([...instants].sort((first, second) => first - second));
  });

  it("holds the published Cal Hacks 13.0 regular round", () => {
    expect(EVENT_SCHEDULE.applicationsOpenAt).toBeNull();
    expect(toTimestampView(EVENT_SCHEDULE.applicationDeadline)?.label).toBe("Sep 20, 2026, 11:59 PM PDT");
    expect(toDateView(EVENT_SCHEDULE.resultsReleasedOn)).toEqual({ iso: "2026-09-25", label: "Sep 25, 2026" });
    const { eventDates } = EVENT_SCHEDULE;
    expect(eventDates && toDateRangeView(eventDates.startsAt, eventDates.endsAt)).toEqual({
      iso: "2026-10-23",
      label: "Oct 23–25, 2026",
    });
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

describe("toDateView", () => {
  it("returns the calendar day in the event time zone", () => {
    expect(toDateView("2026-09-25T00:00:00-07:00")).toEqual({ iso: "2026-09-25", label: "Sep 25, 2026" });
    // 11:30 PM Pacific on September 25 is already September 26 in UTC.
    expect(toDateView("2026-09-26T06:30:00Z")).toEqual({ iso: "2026-09-25", label: "Sep 25, 2026" });
    expect(toDateView("2026-01-05T12:00:00-08:00")).toEqual({ iso: "2026-01-05", label: "Jan 5, 2026" });
  });

  it.each([null, undefined, "", "2026-09-25", "2026-02-30T00:00:00Z"])("returns null for %j", (value) => {
    expect(toDateView(value)).toBeNull();
  });
});

describe("toDateRangeView", () => {
  it.each([
    ["one day", "2026-10-23T00:00:00-07:00", "2026-10-24T00:00:00-07:00", "Oct 23, 2026"],
    ["days within a month", "2026-10-23T00:00:00-07:00", "2026-10-26T00:00:00-07:00", "Oct 23–25, 2026"],
    [
      "days across months and the end of daylight saving time",
      "2026-10-30T00:00:00-07:00",
      "2026-11-02T00:00:00-08:00",
      "Oct 30 – Nov 1, 2026",
    ],
    ["days across years", "2026-12-31T00:00:00-08:00", "2027-01-03T00:00:00-08:00", "Dec 31, 2026 – Jan 2, 2027"],
  ])("labels %s and uses the first day as the machine-readable date", (_, startsAt, endsAt, label) => {
    expect(toDateRangeView(startsAt, endsAt)).toEqual({ iso: startsAt.slice(0, 10), label });
  });

  it("returns null for unparseable values or an end that is not after the start", () => {
    expect(toDateRangeView("not a date", "2026-10-26T00:00:00-07:00")).toBeNull();
    expect(toDateRangeView("2026-10-23T00:00:00-07:00", "2026-10-26")).toBeNull();
    expect(toDateRangeView("2026-10-23T00:00:00-07:00", "2026-10-23T00:00:00-07:00")).toBeNull();
    expect(toDateRangeView("2026-10-26T00:00:00-07:00", "2026-10-23T00:00:00-07:00")).toBeNull();
  });
});
