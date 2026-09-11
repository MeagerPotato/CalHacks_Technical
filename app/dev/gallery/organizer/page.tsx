import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GallerySection } from "@/components/dev/GallerySection";
import { ApplicationsView } from "@/components/organizer/ApplicationsView";
import { DecisionRelease } from "@/components/organizer/DecisionRelease";
import { IdentityPanel } from "@/components/organizer/IdentityPanel";
import { MissionControlDashboard } from "@/components/organizer/MissionControlDashboard";
import { NarrativePanel } from "@/components/organizer/NarrativePanel";
import { OrganizerNav } from "@/components/organizer/OrganizerNav";
import { ReviewWorkspaceLayout } from "@/components/organizer/ReviewWorkspaceLayout";
import { Scorecard } from "@/components/organizer/Scorecard";
import { WorkspaceHeader } from "@/components/organizer/WorkspaceHeader";
import { AppLink } from "@/components/ui/AppLink";
import { NoticeFromView } from "@/components/ui/Notice";
import { PageNotFound } from "@/components/ui/PageState";
import { ORGANIZER_COPY } from "@/content/copy";
import { ROUTES } from "@/lib/routes";

import {
  applicationsVariants,
  dashboardVariants,
  navVariants,
  organizerNotices,
  workspaceVariants,
  type OrganizerGalleryVariant,
} from "./_fixtures";

// Development-only text in this file describes the gallery itself; product copy comes from content/copy.ts.

export const metadata: Metadata = { title: "Organizer gallery", robots: { index: false, follow: false } };

const GALLERY_PATH = "/dev/gallery/organizer";

type Selection = Record<"dashboard" | "applications" | "workspace", string>;

function pickVariant<T>(
  raw: string | string[] | undefined,
  variants: readonly OrganizerGalleryVariant<T>[],
): OrganizerGalleryVariant<T> {
  return variants.find((variant) => variant.id === raw) ?? variants[0];
}

function variantHref(selection: Selection, key: keyof Selection, id: string, anchor: string): string {
  return `${GALLERY_PATH}?${new URLSearchParams({ ...selection, [key]: id }).toString()}#${anchor}`;
}

function VariantLinks<T>({
  variants,
  selection,
  paramKey,
  anchor,
}: {
  variants: readonly OrganizerGalleryVariant<T>[];
  selection: Selection;
  paramKey: keyof Selection;
  anchor: string;
}) {
  return variants.map((variant) => (
    <AppLink
      key={variant.id}
      href={variantHref(selection, paramKey, variant.id, anchor)}
      aria-current={variant.id === selection[paramKey] ? "true" : undefined}
    >
      {variant.label}
    </AppLink>
  ));
}

/**
 * Every organizer view and state, built from the real view models and the shared organizer test fixtures. It reads no
 * Supabase data, is never linked, and returns 404 in production builds. Views with fixed ids show one variant at a
 * time, chosen with ?dashboard=, ?applications=, and ?workspace=. Controls have no handlers here; the containers in
 * app/organizer own behavior.
 */
export default async function OrganizerGalleryPage({ searchParams }: PageProps<"/dev/gallery/organizer">) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const dashboard = pickVariant(params.dashboard, dashboardVariants);
  const applications = pickVariant(params.applications, applicationsVariants);
  const workspace = pickVariant(params.workspace, workspaceVariants);
  const selection: Selection = { dashboard: dashboard.id, applications: applications.id, workspace: workspace.id };
  const state = workspace.view;
  const { view } = state;
  const hasNotices = state.clientNotice !== null || view.notices.length > 0;

  return (
    <main id="main" tabIndex={-1}>
      <GallerySection
        id="gallery-organizer-nav"
        title="Organizer navigation"
        description="aria-current on the current page, and on Applications inside a review workspace."
      >
        {navVariants.map((variant) => (
          <OrganizerNav key={variant.id} label={`${ORGANIZER_COPY.nav.label}: ${variant.label}`} items={variant.view} />
        ))}
      </GallerySection>

      <GallerySection
        id="gallery-organizer-dashboard"
        title={`Mission Control dashboard: ${dashboard.label}`}
        description="Choose a variant."
      >
        <VariantLinks
          variants={dashboardVariants}
          selection={selection}
          paramKey="dashboard"
          anchor="gallery-organizer-dashboard"
        />
        <MissionControlDashboard view={dashboard.view} />
      </GallerySection>

      <GallerySection
        id="gallery-organizer-applications"
        title={`Applications table: ${applications.label}`}
        description="The table shows from the md breakpoint; stacked cards show below it."
      >
        <VariantLinks
          variants={applicationsVariants}
          selection={selection}
          paramKey="applications"
          anchor="gallery-organizer-applications"
        />
        <ApplicationsView view={applications.view} />
      </GallerySection>

      <GallerySection
        id="gallery-organizer-workspace"
        title={`Review workspace: ${workspace.label}`}
        description="Blind and revealed identity, every review access state, errors, notices, and decision release."
      >
        <VariantLinks
          variants={workspaceVariants}
          selection={selection}
          paramKey="workspace"
          anchor="gallery-organizer-workspace"
        />
        <ReviewWorkspaceLayout
          isBlind={view.blind.isBlind}
          access={view.scorecard.access}
          header={<WorkspaceHeader header={view.header} blind={view.blind} />}
          notices={
            hasNotices ? (
              <>
                {state.clientNotice ? <NoticeFromView view={state.clientNotice} /> : null}
                {view.notices.map((notice) => (
                  <NoticeFromView key={notice.id} view={notice} />
                ))}
              </>
            ) : undefined
          }
          identity={view.identity ? <IdentityPanel identity={view.identity} /> : undefined}
          narrative={<NarrativePanel title={view.narrative.title} sections={view.narrative.sections} />}
          scorecard={
            <Scorecard
              view={view.scorecard}
              values={state.values}
              overallText={state.overallText}
              notesCounter={state.notesCounter}
              errors={state.errors}
              summaryItems={state.summaryItems}
            />
          }
          decision={
            view.decision ? (
              <DecisionRelease
                view={view.decision}
                step={state.decisionStep}
                choice={state.decisionChoice}
                error={state.decisionError}
              />
            ) : undefined
          }
        />
      </GallerySection>

      <GallerySection
        id="gallery-organizer-notices"
        title="Organizer notices"
        description="One notice per distinct organizer feedback code."
      >
        {organizerNotices.map((notice) => (
          <NoticeFromView key={notice.id} view={notice} />
        ))}
      </GallerySection>

      <GallerySection
        id="gallery-organizer-page-states"
        title="Organizer page states"
        description="Rendered without their main landmark."
      >
        <PageNotFound
          title={ORGANIZER_COPY.workspace.notFound.title}
          message={ORGANIZER_COPY.workspace.notFound.body}
          homeHref={ROUTES.organizerApplications}
          homeLabel={ORGANIZER_COPY.workspace.backToList}
          standalone={false}
        />
      </GallerySection>
    </main>
  );
}
