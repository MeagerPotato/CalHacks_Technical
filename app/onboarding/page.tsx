import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/app/_components/SignOutButton";
import { AuthShell } from "@/components/layout/AuthShell";
import { COPY } from "@/content/copy";
import { APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import { requireApplicant } from "@/lib/auth/dal";
import { getMyApplications } from "@/lib/data/applications";
import { ROUTES } from "@/lib/routes";

import { OnboardingForm } from "./_components/OnboardingForm";

export const metadata: Metadata = { title: COPY.onboarding.title };

/** Confirms the applications chosen at signup and the display name, then creates every draft application. */
export default async function OnboardingPage() {
  const viewer = await requireApplicant();
  const applications = await getMyApplications();

  if (viewer.applicationTypes.every((type) => applications.some((application) => application.type === type))) {
    // createApplications revalidates this page, so this render redirect also runs inside that action's response.
    // It targets the same URL OnboardingForm navigates to on success, so the two navigations cannot race.
    redirect(ROUTES.portal);
  }

  return (
    <AuthShell
      title={COPY.onboarding.title}
      description={COPY.onboarding.description}
      actions={<SignOutButton />}
      footer={<p>{COPY.onboarding.wrongRole}</p>}
    >
      <OnboardingForm
        applicationTypeLabels={viewer.applicationTypes.map((type) => APPLICATION_TYPE_LABELS[type])}
        continueHref={ROUTES.portal}
        defaultDisplayName={viewer.displayName}
      />
    </AuthShell>
  );
}
