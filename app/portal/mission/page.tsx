import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MissionTracker } from "@/components/mission/MissionTracker";
import { COPY } from "@/content/copy";
import { requireApplicant } from "@/lib/auth/dal";
import { getMyApplication } from "@/lib/data/applications";
import { ROUTES, portalMissionRoute, portalRoute, resolveApplicationType } from "@/lib/routes";
import { toMissionView } from "@/lib/view-models/mission";

export const metadata: Metadata = { title: COPY.meta.titles.mission };

/**
 * Rocket Mission Tracker for one application (`?type=`), built only from real status and workflow timestamps. Drafts
 * have not launched, so they go back to their portal dashboard. The only mutation this page hosts is sign-out, whose
 * re-render redirect matches its own client navigation.
 */
export default async function MissionPage({ searchParams }: PageProps<"/portal/mission">) {
  const viewer = await requireApplicant();
  const { type: rawType } = await searchParams;
  const selected = resolveApplicationType(viewer.applicationTypes, rawType);

  if (selected && !selected.canonical) {
    redirect(portalMissionRoute(selected.type));
  }

  const application = selected ? await getMyApplication(selected.type) : null;

  if (!application) {
    redirect(ROUTES.onboarding);
  }
  if (application.status === "draft") {
    redirect(portalRoute(application.type));
  }

  return (
    <MissionTracker
      view={toMissionView(application)}
      backHref={portalRoute(application.type)}
      backLabel={COPY.mission.backToPortal}
      progressLabel={COPY.mission.progressLabel}
      releasedPrefix={COPY.mission.released}
    />
  );
}
