import { COPY } from "@/content/copy";
import type { EventSchedule } from "@/lib/event";
import { toDateRangeView, toDateView, toTimestampView } from "@/lib/format/datetime";
import type {
  CountdownTimerView,
  CountdownsView,
  TimelineStopId,
  TimelineStopState,
  TimelineView,
  TimestampView,
} from "@/lib/view-models/types";

// =============================================================================
// Schedule view models: the landing page's mission timeline, and the countdowns on the landing page and the portal.
//
// Only server code may call these builders, because they format dates in the event time zone. `now` is the server
// clock (epoch milliseconds) when the page renders; tests pass a fixed one.
// =============================================================================

interface StopTiming {
  id: TimelineStopId;
  /** When the stop begins, or null while it is to be announced. */
  startsAt: number | null;
  /** When it is over; the same as `startsAt` for a single moment, or null while it is to be announced. */
  endsAt: number | null;
  when: TimestampView | null;
}

function instantOf(iso: string | null | undefined): number | null {
  const view = toTimestampView(iso);
  return view === null ? null : Date.parse(view.iso);
}

function stopTimings(schedule: EventSchedule): StopTiming[] {
  const deadline = instantOf(schedule.applicationDeadline);
  const results = instantOf(schedule.resultsReleasedOn);
  const { eventDates } = schedule;
  return [
    {
      id: "applicationsOpen",
      // No published opening date means applications are already open.
      startsAt: schedule.applicationsOpenAt === null ? Number.NEGATIVE_INFINITY : instantOf(schedule.applicationsOpenAt),
      // Applications stay open until the deadline, and indefinitely while it is to be announced.
      endsAt: deadline ?? Number.POSITIVE_INFINITY,
      when: toDateView(schedule.applicationsOpenAt),
    },
    {
      id: "applicationDeadline",
      startsAt: deadline,
      endsAt: deadline,
      when: toTimestampView(schedule.applicationDeadline),
    },
    {
      id: "resultsReleased",
      startsAt: results,
      endsAt: results,
      when: toDateView(schedule.resultsReleasedOn),
    },
    {
      id: "event",
      startsAt: instantOf(eventDates?.startsAt),
      endsAt: instantOf(eventDates?.endsAt),
      when: eventDates ? toDateRangeView(eventDates.startsAt, eventDates.endsAt) : null,
    },
  ];
}

function stopState({ startsAt, endsAt }: StopTiming, now: number): TimelineStopState {
  if (startsAt === null || endsAt === null || now < startsAt) {
    return "upcoming";
  }
  return now >= endsAt ? "complete" : "active";
}

function whenText(timing: StopTiming, state: TimelineStopState): string | null {
  if (timing.when !== null) {
    return null;
  }
  if (timing.id === "applicationsOpen" && state !== "upcoming") {
    // "Open now" only while it is true; a finished stop with no published date needs no date line.
    return state === "active" ? COPY.schedule.timeline.openNow : null;
  }
  return COPY.schedule.timeline.toBeAnnounced;
}

/**
 * The mission timeline at `now`. Each stop is complete once it is over, active while in progress (applications while
 * they are open, the event while it runs), and upcoming otherwise. The current stop is the active one, or the next
 * upcoming one when none is active, so its label reads "Up next". After the event, no stop is current.
 */
export function toTimelineView(schedule: EventSchedule, now: number): TimelineView {
  const { timeline } = COPY.schedule;
  const timings = stopTimings(schedule);
  const states = timings.map((timing) => stopState(timing, now));
  const active = states.indexOf("active");
  const current = active === -1 ? states.indexOf("upcoming") : active;

  return {
    title: timeline.title,
    stops: timings.map((timing, index) => {
      const state = states[index];
      const isCurrent = index === current;
      return {
        id: timing.id,
        name: timeline.stops[timing.id],
        state,
        stateLabel: state === "upcoming" && isCurrent ? timeline.states.next : timeline.states[state],
        isCurrent,
        when: timing.when,
        whenText: whenText(timing, state),
      };
    }),
  };
}

/**
 * The countdown panel: time to launch (the application deadline) and time to landing (the first day of the event),
 * each only when its date is set. Returns null when neither is. `now` becomes `renderedAt`.
 */
export function toCountdownsView(schedule: EventSchedule, now: number): CountdownsView | null {
  const { countdown } = COPY.schedule;
  const timers: CountdownTimerView[] = [];

  const deadline = toTimestampView(schedule.applicationDeadline);
  if (deadline) {
    timers.push({ id: "launch", ...countdown.launch, target: deadline, endsAt: deadline.iso });
  }

  const eventStart = toTimestampView(schedule.eventDates?.startsAt);
  const eventDay = toDateView(schedule.eventDates?.startsAt);
  if (eventStart && eventDay) {
    // Only the day is published, so the target shows as a date.
    timers.push({ id: "landing", ...countdown.landing, target: eventDay, endsAt: eventStart.iso });
  }

  return timers.length === 0 ? null : { title: countdown.title, renderedAt: now, timers };
}

export interface ScheduleViews {
  timeline: TimelineView;
  countdowns: CountdownsView | null;
}

/**
 * The timeline and the countdown panel for one moment, by default the time of the call. Pages call it once per
 * request, so both views agree and no Server Component reads the clock during render.
 */
export function toScheduleViews(schedule: EventSchedule, now: number = Date.now()): ScheduleViews {
  return { timeline: toTimelineView(schedule, now), countdowns: toCountdownsView(schedule, now) };
}
