import { COPY } from "@/content/copy";
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import { REVIEW_STEP, applicationStepHref } from "@/lib/editor/steps";
import { toTimestampView } from "@/lib/format/datetime";
import { ROUTES } from "@/lib/routes";
import { getSectionLabel } from "@/lib/view-models/fields";
import { toReadinessItems } from "@/lib/view-models/readiness";
import type {
  LinkView,
  PortalDraftView,
  PortalSubmittedView,
  PortalView,
  PortalWelcomeView,
} from "@/lib/view-models/types";

// =============================================================================
// Applicant portal dashboard view model.
//
// Only server code may call this (the portal page): it formats timestamps in the event time zone, and formatting in
// the browser could produce a different label and a hydration mismatch. A draft gets its progress, next step, and
// Launch Readiness; a launched application gets its status and links to the mission tracker and the read-only
// application.
// =============================================================================

/** Input for the portal dashboard. */
export interface PortalViewInput {
  viewer: { displayName: string | null };
  application: ApplicantApplication;
  /** ISO 8601 instant, or null while the deadline is to be announced. */
  deadline: string | null;
}

function presentText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toWelcome(viewer: PortalViewInput["viewer"], application: ApplicantApplication): PortalWelcomeView {
  // The profile display name wins; the full-name answer covers accounts without one. A blank name is no name.
  const name = presentText(viewer.displayName) ?? presentText(application.responses.fullName);
  return {
    greeting: COPY.portal.greeting(name),
    typeLabel: APPLICATION_TYPE_LABELS[application.type],
    reference: COPY.portal.reference(application.applicantReference),
  };
}

// Review is next once the application can be submitted, and also when no incomplete section is reported, so a draft
// always has somewhere to go.
function toNextStep(application: ApplicantApplication): LinkView {
  const { completion } = application;
  const sectionId = completion.nextIncompleteSectionId;
  const step = completion.isSubmittable || sectionId === null ? REVIEW_STEP : sectionId;
  return { label: getSectionLabel(application.type, step), href: applicationStepHref(step) };
}

// Creating an application sets created_at and updated_at to the same instant, and every update moves updated_at, so
// equal values mean the draft has never been saved.
function isUnsaved(application: ApplicantApplication): boolean {
  return application.updatedAt === application.createdAt;
}

function toCtaLabel(application: ApplicantApplication): string {
  const { completion } = application;
  if (completion.percent === 0 && isUnsaved(application)) {
    return COPY.portal.startCta;
  }
  return completion.isSubmittable ? COPY.portal.reviewCta : COPY.portal.continueCta;
}

function toDraftView(application: ApplicantApplication, welcome: PortalWelcomeView, deadline: string | null) {
  const { completion } = application;
  const nextStep = toNextStep(application);
  return {
    kind: "draft",
    welcome,
    progress: {
      percent: completion.percent,
      valueText: COPY.portal.progressValue(completion.percent),
      nextStep,
      lastSaved: isUnsaved(application) ? null : toTimestampView(application.updatedAt),
      cta: { label: toCtaLabel(application), href: nextStep.href },
    },
    deadline: toTimestampView(deadline),
    readiness: toReadinessItems(application.type, completion, {}),
  } satisfies PortalDraftView;
}

function toSubmittedView(application: ApplicantApplication, welcome: PortalWelcomeView, deadline: string | null) {
  return {
    kind: "submitted",
    welcome,
    status: application.status,
    statusLabel: APPLICATION_STATUS_LABELS[application.status],
    launched: toTimestampView(application.launchedAt),
    deadline: toTimestampView(deadline),
    trackHref: ROUTES.portalMission,
    viewHref: ROUTES.portalApplication,
  } satisfies PortalSubmittedView;
}

/**
 * The portal dashboard for the signed-in applicant's application.
 *
 * - Draft: a greeting using the display name, else a non-blank full-name answer; progress with the next step
 *   (the next incomplete section, or review); a start, continue, or review call to action that links to that step;
 *   the last-saved time (null until the first save); the deadline; and Launch Readiness items.
 * - Any other status: the status label, launch time, deadline, and links to the mission tracker and the submitted
 *   application.
 *
 * `deadline` is null in both variants while it is to be announced.
 */
export function toPortalView(input: PortalViewInput): PortalView {
  const { viewer, application, deadline } = input;
  const welcome = toWelcome(viewer, application);
  return application.status === "draft"
    ? toDraftView(application, welcome, deadline)
    : toSubmittedView(application, welcome, deadline);
}
