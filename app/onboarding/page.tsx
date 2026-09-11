import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/app/_components/SignOutButton";
import { AuthShell } from "@/components/layout/AuthShell";
import { COPY } from "@/content/copy";
import { ACCOUNT_ROLE_LABELS } from "@/lib/application-config";
import { requireApplicant } from "@/lib/auth/dal";
import { getMyApplication } from "@/lib/data/applications";
import { ROUTES } from "@/lib/routes";

import { OnboardingForm } from "./_components/OnboardingForm";

export const metadata: Metadata = { title: COPY.onboarding.title };

/** Confirms the account type and display name, then creates the draft application. */
export default async function OnboardingPage() {
  const viewer = await requireApplicant();
  const application = await getMyApplication();

  if (application) {
    // createApplication revalidates this page, so this render redirect also runs inside that action's response.
    // It targets the same route OnboardingForm navigates to on success, so the two navigations cannot race.
    redirect(ROUTES.portalApplication);
  }

  return (
    <AuthShell
      title={COPY.onboarding.title}
      description={COPY.onboarding.description}
      actions={<SignOutButton />}
      footer={<p>{COPY.onboarding.wrongRole}</p>}
    >
      <OnboardingForm accountRoleLabel={ACCOUNT_ROLE_LABELS[viewer.accountRole]} defaultDisplayName={viewer.displayName} />
    </AuthShell>
  );
}
