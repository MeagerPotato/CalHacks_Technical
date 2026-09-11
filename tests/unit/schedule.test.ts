import { afterEach, describe, expect, it, vi } from "vitest";

import { COPY } from "@/content/copy";
import type { EventSchedule } from "@/lib/event";
import { toCountdownParts } from "@/lib/format/countdown";
import { toCountdownReading } from "@/lib/view-models/countdown";
import { toCountdownsView, toScheduleViews, toTimelineView } from "@/lib/view-models/schedule";
import type { TimelineStopState } from "@/lib/view-models/types";

const { countdown, timeline } = COPY.schedule;

// The shape of the published schedule, pinned here so these tests do not move when the event config changes.
const SCHEDULE: EventSchedule = {
  applicationsOpenAt: null,
  applicationDeadline: "2026-09-20T23:59:00-07:00",
  resultsReleasedOn: "2026-09-25T00:00:00-07:00",
  eventDates: { startsAt: "2026-10-23T00:00:00-07:00", endsAt: "2026-10-26T00:00:00-07:00" },
};

const UNSET: EventSchedule = {
  applicationsOpenAt: null,
  applicationDeadline: null,
  resultsReleasedOn: null,
  eventDates: null,
};

function at(iso: string): number {
  return Date.parse(iso);
}

describe("toCountdownParts", () => {
  const target = at("2026-09-20T23:59:00-07:00");

  it("splits the time left into days, hours, minutes, and seconds", () => {
    expect(toCountdownParts(target, at("2026-09-11T12:00:00-07:00"))).toEqual({
      days: 9,
      hours: 11,
      minutes: 59,
      seconds: 0,
    });
    expect(toCountdownParts(target, target - 90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });

  it("counts a partial second as a whole one and ends exactly at the target", () => {
    const zero = { days: 0, hours: 0, minutes: 0 };
    expect(toCountdownParts(target, target - 1)).toEqual({ ...zero, seconds: 1 });
    expect(toCountdownParts(target, target - 1000)).toEqual({ ...zero, seconds: 1 });
    expect(toCountdownParts(target, target - 1001)).toEqual({ ...zero, seconds: 2 });
    expect(toCountdownParts(target, target)).toBeNull();
    expect(toCountdownParts(target, target + 1)).toBeNull();
  });

  it("returns null for values that are not finite", () => {
    expect(toCountdownParts(Number.NaN, 0)).toBeNull();
    expect(toCountdownParts(target, Number.NaN)).toBeNull();
    expect(toCountdownParts(Number.POSITIVE_INFINITY, 0)).toBeNull();
  });
});

describe("toCountdownsView", () => {
  it("counts down to the deadline with its time and to the first event day as a date", () => {
    const now = at("2026-09-11T12:00:00-07:00");
    expect(toCountdownsView(SCHEDULE, now)).toEqual({
      title: countdown.title,
      renderedAt: now,
      timers: [
        {
          id: "launch",
          title: countdown.launch.title,
          caption: countdown.launch.caption,
          completeText: countdown.launch.completeText,
          target: { iso: "2026-09-21T06:59:00.000Z", label: "Sep 20, 2026, 11:59 PM PDT" },
          endsAt: "2026-09-21T06:59:00.000Z",
        },
        {
          id: "landing",
          title: countdown.landing.title,
          caption: countdown.landing.caption,
          completeText: countdown.landing.completeText,
          target: { iso: "2026-10-23", label: "Oct 23, 2026" },
          endsAt: "2026-10-23T07:00:00.000Z",
        },
      ],
    });
  });

  it("leaves out a countdown whose date is to be announced, and returns null when both are", () => {
    const now = at("2026-09-11T12:00:00-07:00");
    expect(toCountdownsView({ ...SCHEDULE, applicationDeadline: null }, now)?.timers.map((timer) => timer.id)).toEqual([
      "landing",
    ]);
    expect(toCountdownsView({ ...SCHEDULE, eventDates: null }, now)?.timers.map((timer) => timer.id)).toEqual([
      "launch",
    ]);
    expect(toCountdownsView(UNSET, now)).toBeNull();
  });
});

describe("toCountdownReading", () => {
  const now = at("2026-09-11T12:00:00-07:00");
  const [launch, landing] = toCountdownsView(SCHEDULE, now)?.timers ?? [];

  it("reads days as a number and the smaller units as two digits, with a summary to the minute", () => {
    // 65.5 seconds before the event count as 66: one minute and six seconds.
    expect(toCountdownReading(landing, at("2026-10-22T23:58:54.500-07:00"))).toEqual({
      id: "landing",
      state: "counting",
      units: [
        { unit: "days", value: "0", label: countdown.units.days },
        { unit: "hours", value: "00", label: countdown.units.hours },
        { unit: "minutes", value: "01", label: countdown.units.minutes },
        { unit: "seconds", value: "06", label: countdown.units.seconds },
      ],
      summary: countdown.remaining(0, 0, 1),
    });
    const reading = toCountdownReading(launch, now);
    expect(reading.units.map((unit) => unit.value)).toEqual(["9", "11", "59", "00"]);
    expect(reading.summary).toBe(countdown.remaining(9, 11, 59));
    expect(toCountdownReading(landing, now).units.map((unit) => unit.value)).toEqual(["41", "12", "00", "00"]);
  });

  it("switches to the complete text at the target", () => {
    expect(toCountdownReading(launch, at("2026-09-20T23:59:00-07:00"))).toEqual({
      id: "launch",
      state: "complete",
      units: [],
      summary: countdown.launch.completeText,
    });
  });

  it("never summarizes a unit with nothing left in it", () => {
    for (const days of [0, 1, 2]) {
      for (const hours of [0, 1, 2]) {
        for (const minutes of [0, 1, 2]) {
          expect(countdown.remaining(days, hours, minutes)).not.toMatch(/\b0 /);
        }
      }
    }
  });
});

describe("toScheduleViews", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the timeline and the countdowns for one moment, the current time by default", () => {
    const now = at("2026-09-22T12:00:00-07:00");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const expected = { timeline: toTimelineView(SCHEDULE, now), countdowns: toCountdownsView(SCHEDULE, now) };
    expect(toScheduleViews(SCHEDULE)).toEqual(expected);
    expect(toScheduleViews(SCHEDULE, now)).toEqual(expected);
  });
});

describe("toTimelineView", () => {
  it("lists applications open, the deadline, results, and the event, with their dates", () => {
    const view = toTimelineView(SCHEDULE, at("2026-09-11T12:00:00-07:00"));
    expect(view.title).toBe(timeline.title);
    expect(view.stops.map((stop) => [stop.id, stop.name, stop.when, stop.whenText])).toEqual([
      ["applicationsOpen", timeline.stops.applicationsOpen, null, timeline.openNow],
      [
        "applicationDeadline",
        timeline.stops.applicationDeadline,
        { iso: "2026-09-21T06:59:00.000Z", label: "Sep 20, 2026, 11:59 PM PDT" },
        null,
      ],
      ["resultsReleased", timeline.stops.resultsReleased, { iso: "2026-09-25", label: "Sep 25, 2026" }, null],
      ["event", timeline.stops.event, { iso: "2026-10-23", label: "Oct 23–25, 2026" }, null],
    ]);
  });

  it.each<[string, string, [TimelineStopState, boolean][]]>([
    [
      "while applications are open",
      "2026-09-11T12:00:00-07:00",
      [["active", true], ["upcoming", false], ["upcoming", false], ["upcoming", false]],
    ],
    [
      "a millisecond before the deadline",
      "2026-09-20T23:58:59.999-07:00",
      [["active", true], ["upcoming", false], ["upcoming", false], ["upcoming", false]],
    ],
    [
      "at the deadline",
      "2026-09-20T23:59:00-07:00",
      [["complete", false], ["complete", false], ["upcoming", true], ["upcoming", false]],
    ],
    [
      "on the day results are released",
      "2026-09-25T00:00:00-07:00",
      [["complete", false], ["complete", false], ["complete", false], ["upcoming", true]],
    ],
    [
      "during the event",
      "2026-10-24T12:00:00-07:00",
      [["complete", false], ["complete", false], ["complete", false], ["active", true]],
    ],
    [
      "after the event",
      "2026-10-26T00:00:00-07:00",
      [["complete", false], ["complete", false], ["complete", false], ["complete", false]],
    ],
  ])("marks states and the one current stop %s", (_, now, expected) => {
    const view = toTimelineView(SCHEDULE, at(now));
    expect(view.stops.map((stop) => [stop.state, stop.isCurrent])).toEqual(expected);
  });

  it("labels states as text, reading the current upcoming stop as up next", () => {
    const labels = (now: string) => toTimelineView(SCHEDULE, at(now)).stops.map((stop) => stop.stateLabel);
    const { states } = timeline;
    expect(labels("2026-09-11T12:00:00-07:00")).toEqual([states.active, states.upcoming, states.upcoming, states.upcoming]);
    expect(labels("2026-09-22T12:00:00-07:00")).toEqual([states.complete, states.complete, states.next, states.upcoming]);
    expect(labels("2026-10-24T12:00:00-07:00")).toEqual([states.complete, states.complete, states.complete, states.active]);
  });

  it("says applications are open only while they are", () => {
    const openStop = (now: string) => toTimelineView(SCHEDULE, at(now)).stops[0];
    expect(openStop("2026-09-11T12:00:00-07:00")).toMatchObject({ when: null, whenText: timeline.openNow });
    expect(openStop("2026-09-22T12:00:00-07:00")).toMatchObject({ when: null, whenText: null });
  });

  it("shows dates that are to be announced, keeping applications open until a deadline is set", () => {
    const view = toTimelineView(UNSET, at("2026-09-11T12:00:00-07:00"));
    expect(view.stops.map((stop) => [stop.state, stop.isCurrent, stop.when, stop.whenText])).toEqual([
      ["active", true, null, timeline.openNow],
      ["upcoming", false, null, timeline.toBeAnnounced],
      ["upcoming", false, null, timeline.toBeAnnounced],
      ["upcoming", false, null, timeline.toBeAnnounced],
    ]);
  });

  it("treats a published opening date like any other date", () => {
    const schedule = { ...SCHEDULE, applicationsOpenAt: "2026-09-01T09:00:00-07:00" };
    expect(toTimelineView(schedule, at("2026-08-30T12:00:00-07:00")).stops[0]).toMatchObject({
      state: "upcoming",
      isCurrent: true,
      stateLabel: timeline.states.next,
      when: { iso: "2026-09-01", label: "Sep 1, 2026" },
      whenText: null,
    });
    expect(toTimelineView(schedule, at("2026-09-11T12:00:00-07:00")).stops[0]).toMatchObject({
      state: "active",
      isCurrent: true,
      whenText: null,
    });
  });
});
