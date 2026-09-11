import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MissionTracker } from "@/components/mission/MissionTracker";
import { COPY } from "@/content/copy";
import { getMyApplication } from "@/lib/data/applications";
import { ROUTES } from "@/lib/routes";
import { toMissionView } from "@/lib/view-models/mission";

export const metadata: Metadata = { title: COPY.meta.titles.mission };

/**
 * Rocket Mission Tracker, built only from real status and workflow timestamps. Drafts have not launched, so they
 * go back to the portal. The only mutation this page hosts is sign-out, whose re-render redirect matches its own
 * client navigation.
 */
export default async function MissionPage() {
  const application = await getMyApplication();

  if (!application) {
    redirect(ROUTES.onboarding);
  }
  if (application.status === "draft") {
    redirect(ROUTES.portal);
  }

  return (
    <MissionTracker
      view={toMissionView(application)}
      backHref={ROUTES.portal}
      backLabel={COPY.mission.backToPortal}
      progressLabel={COPY.mission.progressLabel}
      releasedPrefix={COPY.mission.released}
    />
  );
}
