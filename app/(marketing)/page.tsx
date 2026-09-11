import { connection } from "next/server";

import { LiveCountdowns } from "@/app/_components/LiveCountdowns";
import { LandingView } from "@/components/marketing/LandingView";
import { EVENT_SCHEDULE } from "@/lib/event";
import { toScheduleViews } from "@/lib/view-models/schedule";

/**
 * Public landing page. It never reads the session, but it renders per request, so the timeline's current stop and
 * the countdowns start from the time of the visit rather than the time of the build.
 */
export default async function LandingPage() {
  await connection();
  const { timeline, countdowns } = toScheduleViews(EVENT_SCHEDULE);

  return (
    <LandingView timeline={timeline} countdowns={countdowns ? <LiveCountdowns view={countdowns} /> : null} />
  );
}
