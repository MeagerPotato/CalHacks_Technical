import type { Metadata } from "next";

import { MissionControlDashboard } from "@/components/organizer/MissionControlDashboard";
import { ORGANIZER_COPY } from "@/content/copy";
import { requireOrganizer } from "@/lib/auth/dal";
import { getOrganizerDashboard } from "@/lib/data/organizer";
import { toDashboardView } from "@/lib/view-models/organizer-dashboard";

export const metadata: Metadata = { title: ORGANIZER_COPY.meta.titles.dashboard };

/** Mission Control: review progress, status breakdown, Expertise Radar, and recent submissions. */
export default async function OrganizerDashboardPage() {
  await requireOrganizer();
  const dashboard = await getOrganizerDashboard();
  return <MissionControlDashboard view={toDashboardView(dashboard)} />;
}
