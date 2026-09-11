import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PortalDraftDashboard } from "@/components/portal/PortalDraftDashboard";
import { PortalSubmittedDashboard } from "@/components/portal/PortalSubmittedDashboard";
import { COPY } from "@/content/copy";
import { requireApplicant } from "@/lib/auth/dal";
import { getMyApplication } from "@/lib/data/applications";
import { APPLICATION_DEADLINE } from "@/lib/event";
import { ROUTES } from "@/lib/routes";
import { toPortalView } from "@/lib/view-models/portal";

export const metadata: Metadata = { title: COPY.meta.titles.portal };

/** Applicant dashboard: Launch Readiness for a draft, or the launched status once submitted. */
export default async function PortalPage() {
  const viewer = await requireApplicant();
  const application = await getMyApplication();

  if (!application) {
    redirect(ROUTES.onboarding);
  }

  const view = toPortalView({ viewer, application, deadline: APPLICATION_DEADLINE });
  return view.kind === "draft" ? <PortalDraftDashboard view={view} /> : <PortalSubmittedDashboard view={view} />;
}
