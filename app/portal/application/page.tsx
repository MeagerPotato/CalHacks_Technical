import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { COPY } from "@/content/copy";
import { getMyApplication } from "@/lib/data/applications";
import { resolveInitialStep } from "@/lib/editor/steps";
import { toTimestampView } from "@/lib/format/datetime";
import { ROUTES } from "@/lib/routes";

import { ApplicationWorkspace } from "./_components/ApplicationWorkspace";

export const metadata: Metadata = { title: COPY.meta.titles.application };

/** Application editor for drafts and the read-only view once submitted. */
export default async function ApplicationPage({ searchParams }: PageProps<"/portal/application">) {
  const application = await getMyApplication();

  if (!application) {
    redirect(ROUTES.onboarding);
  }

  // Never redirect on status here. saveApplication and submitApplication revalidate this page inside their own
  // responses, so a render redirect would race the editor's client navigation (such as the liftoff screen).
  // Submitted applications render read-only inside the workspace instead.
  const { section } = await searchParams;

  return (
    <ApplicationWorkspace
      application={application}
      initialStep={resolveInitialStep(application.type, section, application.completion)}
      lastSaved={application.updatedAt === application.createdAt ? null : toTimestampView(application.updatedAt)}
      launched={toTimestampView(application.launchedAt)}
    />
  );
}
