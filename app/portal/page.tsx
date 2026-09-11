import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PortalDraftDashboard } from "@/components/portal/PortalDraftDashboard";
import { PortalSubmittedDashboard } from "@/components/portal/PortalSubmittedDashboard";
import { COPY } from "@/content/copy";
import { requireApplicant } from "@/lib/auth/dal";
import { getMyApplications } from "@/lib/data/applications";
import { APPLICATION_DEADLINE } from "@/lib/event";
import { ROUTES, portalRoute, resolveApplicationType } from "@/lib/routes";
import { toPortalView } from "@/lib/view-models/portal";

export const metadata: Metadata = { title: COPY.meta.titles.portal };

/**
 * Applicant dashboard for one application, chosen by `?type=`: Launch Readiness for a draft, or the launched status
 * once submitted. An account with both applications can switch between them here.
 */
export default async function PortalPage({ searchParams }: PageProps<"/portal">) {
  const viewer = await requireApplicant();
  const { type: rawType } = await searchParams;
  const selected = resolveApplicationType(viewer.applicationTypes, rawType);

  if (selected && !selected.canonical) {
    redirect(portalRoute(selected.type));
  }

  const applications = await getMyApplications();
  const application = applications.find((candidate) => candidate.type === selected?.type);
  // Onboarding creates every application the account applies for, so a missing one sends the applicant back there.
  const missingApplication = viewer.applicationTypes.some(
    (type) => !applications.some((candidate) => candidate.type === type),
  );

  if (!application || missingApplication) {
    redirect(ROUTES.onboarding);
  }

  const view = toPortalView({
    viewer,
    application,
    applicationTypes: applications.map((candidate) => candidate.type),
    deadline: APPLICATION_DEADLINE,
  });
  return view.kind === "draft" ? <PortalDraftDashboard view={view} /> : <PortalSubmittedDashboard view={view} />;
}
