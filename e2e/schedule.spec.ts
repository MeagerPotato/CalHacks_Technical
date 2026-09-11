import { expect, test } from "@playwright/test";

import { COPY } from "@/content/copy";
import { EVENT_SCHEDULE } from "@/lib/event";
import { toDateRangeView, toDateView, toTimestampView } from "@/lib/format/datetime";
import { ROUTES } from "@/lib/routes";

const { countdown, timeline } = COPY.schedule;

test("the landing page timeline lists the configured schedule in order", async ({ page }) => {
  await page.goto(ROUTES.home);
  const section = page.getByTestId("mission-timeline");

  await expect(section.getByRole("heading", { level: 2 })).toHaveText(timeline.title);
  await expect(section.getByRole("heading", { level: 3 })).toHaveText([
    timeline.stops.applicationsOpen,
    timeline.stops.applicationDeadline,
    timeline.stops.resultsReleased,
    timeline.stops.event,
  ]);

  const { eventDates } = EVENT_SCHEDULE;
  const dates = [
    ["applicationDeadline", toTimestampView(EVENT_SCHEDULE.applicationDeadline)],
    ["resultsReleased", toDateView(EVENT_SCHEDULE.resultsReleasedOn)],
    ["event", eventDates ? toDateRangeView(eventDates.startsAt, eventDates.endsAt) : null],
  ] as const;
  for (const [id, date] of dates) {
    const stop = section.getByTestId(`timeline-stop-${id}`);
    if (date) {
      await expect(stop.locator("time")).toHaveAttribute("datetime", date.iso);
      await expect(stop.locator("time")).toHaveText(date.label);
    } else {
      await expect(stop).toContainText(timeline.toBeAnnounced);
    }
  }

  // The current stop, in progress or up next, is announced as the current step. There is never more than one.
  expect(await section.locator('[aria-current="step"]').count()).toBeLessThanOrEqual(1);
});

test("the countdowns tick every second", async ({ page }) => {
  // The server renders with the real clock; once the countdowns hydrate they read this browser clock instead.
  await page.clock.install({ time: new Date("2026-09-11T11:59:00-07:00") });
  await page.goto(ROUTES.home);
  // Mid-minute, so the tick that lands within the next 1.1 seconds cannot cross into another minute.
  await page.clock.pauseAt(new Date("2026-09-11T12:00:30-07:00"));
  await page.clock.runFor(1100);

  const launch = page.getByTestId("countdown-launch");
  await expect(launch).toHaveAttribute("data-state", "counting");
  await expect(page.getByTestId("countdown-landing")).toHaveAttribute("data-state", "counting");
  // About 12:00:31 PM on September 11 to 11:59 PM on September 20.
  await expect(launch.locator("[data-countdown-summary]")).toHaveText(countdown.remaining(9, 11, 58));
  await expect(launch.locator('[data-unit="days"] [data-countdown-value]')).toHaveText("9");

  const seconds = launch.locator('[data-unit="seconds"] [data-countdown-value]');
  const running = await seconds.textContent();
  await page.clock.runFor(2000);
  await expect(seconds).not.toHaveText(running ?? "");
});
