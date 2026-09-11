import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import {
  APPLICATION_FORMS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  RECOMMENDATION_OPTIONS,
  RUBRIC_FORMS,
} from "@/lib/application-config";
import type { ApplicantIdentity, ReviewWorkspace } from "@/lib/data/types";
import { DECISION_STATUSES, isDecisionStatus, type ApplicationType } from "@/lib/domain/enums";
import { toTimestampView } from "@/lib/format/datetime";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import { REVIEW_NOTES_MAX_LENGTH, RUBRIC_SCORE_RANGE } from "@/lib/validation/review";
import { toAnswerSections } from "@/lib/view-models/answers";
import { reviewWorkspaceHref } from "@/lib/view-models/organizer-routes";
import {
  REVIEW_NOTES_ID,
  REVIEW_RECOMMENDATION_ID,
  reviewScoreControlId,
  toScorecardValues,
} from "@/lib/view-models/organizer-scorecard";
import { toQueueProgressView } from "@/lib/view-models/organizer-shared";
import type {
  BlindModeView,
  DecisionReleaseView,
  IdentityView,
  ReviewWorkspaceView,
  ScorecardView,
  ScoreOptionView,
  WorkspaceHeaderView,
} from "@/lib/view-models/organizer-types";
import type { AnswerSectionView, NoticeView } from "@/lib/view-models/types";

// =============================================================================
// Review workspace view model.
//
// Only server code may call `toReviewWorkspaceView` (the workspace page): it formats timestamps in the event time zone.
// Narrative answers are rendered generically from APPLICATION_FORMS, and identity is read in exactly one place,
// `toIdentityView`, so field changes in the form config or the identity DTO stay local.
// =============================================================================

export interface ReviewWorkspaceViewOptions {
  /** Blind reference of the application reviewed just before this one (Save review and continue), already validated. */
  reviewedReference?: string | null;
}

function presentText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Identifying details for a revealed workspace. This is the only organizer view-model code that reads
 * `ApplicantIdentity` fields: the name prefers the application's name answer, then the profile display name; the
 * affiliation label depends on the type; links are kept only when they are http(s) URLs and open in a new tab.
 */
export function toIdentityView(type: ApplicationType, identity: ApplicantIdentity): IdentityView {
  const copy = ORGANIZER_COPY.workspace.identity;
  return {
    title: copy.title,
    missingText: copy.notProvided,
    fields: [
      {
        key: "name",
        label: copy.name,
        text: presentText(identity.preferredName) ?? presentText(identity.displayName),
        links: [],
      },
      { key: "email", label: copy.email, text: presentText(identity.email), links: [] },
      { key: "affiliation", label: copy.affiliation[type], text: presentText(identity.affiliation), links: [] },
      {
        key: "links",
        label: copy.links,
        text: null,
        links: identity.links.filter(isHttpUrl).map((href) => ({ label: href, href })),
      },
    ],
  };
}

/**
 * Read-only narrative answers: every section of the type's form with its fields in form order, minus fields marked
 * `identifying` in APPLICATION_FORMS. Sections left without answers are dropped. New field kinds render through
 * `toAnswerSections` without changes here.
 */
export function toNarrativeSections(type: ApplicationType, narrative: Record<string, unknown>): AnswerSectionView[] {
  const identifying = new Set(
    APPLICATION_FORMS[type].sections.flatMap((section) =>
      section.fields.filter((field) => field.identifying).map((field) => field.key),
    ),
  );
  return toAnswerSections(type, narrative, { editable: false })
    .map((section) => ({ ...section, answers: section.answers.filter((answer) => !identifying.has(answer.key)) }))
    .filter((section) => section.answers.length > 0);
}

function scoreAnchor(score: number, min: number, max: number): string | null {
  const anchors = ORGANIZER_COPY.workspace.scorecard.anchors;
  if (score === min) {
    return anchors.low;
  }
  if (score === max) {
    return anchors.high;
  }
  return score * 2 === min + max ? anchors.middle : null;
}

function scoreOptions(min: number, max: number): ScoreOptionView[] {
  const options: ScoreOptionView[] = [];
  for (let score = min; score <= max; score += 1) {
    options.push({ value: String(score), label: String(score), anchor: scoreAnchor(score, min, max) });
  }
  return options;
}

function toScorecardView(workspace: ReviewWorkspace): ScorecardView {
  const { application, review } = workspace;
  const copy = ORGANIZER_COPY.workspace.scorecard;
  const locked = ORGANIZER_LOCKED.workspace;
  const savedTime = review ? toTimestampView(review.isCompleted ? review.completedAt : review.updatedAt) : null;

  return {
    title: copy.title,
    access: workspace.reviewAccess,
    hint: copy.hint(RUBRIC_SCORE_RANGE.min, RUBRIC_SCORE_RANGE.max),
    dimensions: RUBRIC_FORMS[application.type].map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      controlId: reviewScoreControlId(dimension.key),
      name: `score-${dimension.key}`,
      options: scoreOptions(dimension.minScore, dimension.maxScore),
    })),
    recommendation: {
      id: REVIEW_RECOMMENDATION_ID,
      name: "recommendation",
      label: locked.recommendation,
      hint: copy.recommendationHint,
      options: RECOMMENDATION_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    },
    notes: { id: REVIEW_NOTES_ID, label: locked.notes, hint: copy.notesHint, maxLength: REVIEW_NOTES_MAX_LENGTH },
    maxScore: RUBRIC_SCORE_RANGE.max,
    initialValues: toScorecardValues(application.type, review),
    isCompleted: Boolean(review?.isCompleted),
    saved: review && savedTime ? { prefix: review.isCompleted ? copy.completedAt : copy.draftSavedAt, time: savedTime } : null,
    notSavedText: copy.notSaved,
    overall: { label: copy.overallScore, pendingText: copy.overallPending },
    actions: { saveDraft: locked.saveDraft, saveReview: copy.saveReview, saveAndContinue: locked.saveReviewAndContinue },
    errorSummaryTitle: copy.errorSummaryTitle,
    readOnly: { noScore: copy.noScore, noRecommendation: copy.noRecommendation, noNotes: copy.noNotes },
  };
}

function toDecisionView(workspace: ReviewWorkspace): DecisionReleaseView | null {
  const status = workspace.application.status;
  if (status === "draft") {
    return null;
  }
  const copy = ORGANIZER_COPY.workspace.decision;
  const released = isDecisionStatus(status)
    ? {
        status,
        text: copy.released(APPLICATION_STATUS_LABELS[status]),
        time: toTimestampView(workspace.application.decisionReleasedAt),
        timePrefix: copy.releasedAt,
      }
    : null;
  let state: DecisionReleaseView["state"] = "unavailable";
  if (released) {
    state = "released";
  } else if (workspace.canReleaseDecision) {
    state = "available";
  }

  return {
    state,
    title: copy.title,
    intro: copy.intro,
    legend: copy.legend,
    options: DECISION_STATUSES.map((decision) => ({ value: decision, label: APPLICATION_STATUS_LABELS[decision] })),
    releaseLabel: copy.release,
    confirmTitles: {
      accepted: copy.confirmTitle(APPLICATION_STATUS_LABELS.accepted),
      waitlisted: copy.confirmTitle(APPLICATION_STATUS_LABELS.waitlisted),
    },
    confirmBody: copy.confirmBody,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    unavailableText: state === "unavailable" ? copy.unavailable : null,
    released,
  };
}

function toHeaderView(workspace: ReviewWorkspace): WorkspaceHeaderView {
  const { application } = workspace;
  const next = workspace.nextUnreviewedApplicationId;
  return {
    heading: ORGANIZER_LOCKED.workspace.applicant(application.applicantReference),
    typeLabel: APPLICATION_TYPE_LABELS[application.type],
    status: application.status,
    statusLabel: APPLICATION_STATUS_LABELS[application.status],
    submitted: toTimestampView(application.launchedAt),
    submittedPrefix: ORGANIZER_COPY.workspace.submitted,
    notSubmittedText: ORGANIZER_COPY.rows.notSubmitted,
    back: { label: ORGANIZER_COPY.workspace.backToList, href: ROUTES.organizerApplications },
    // The queue wraps around, so the "next" application can be this one; that is not a next application.
    next:
      next && next !== application.id
        ? { label: ORGANIZER_LOCKED.workspace.nextApplication, href: organizerApplicationRoute(next) }
        : null,
    queue: toQueueProgressView(workspace.queueProgress),
  };
}

function toBlindModeView(workspace: ReviewWorkspace): BlindModeView {
  const copy = ORGANIZER_COPY.workspace.blind;
  const isBlind = workspace.identity === null;
  return {
    isBlind,
    statusText: isBlind ? copy.on : copy.off,
    toggleLabel: isBlind ? copy.reveal : copy.hide,
    toggleHref: reviewWorkspaceHref(workspace.application.id, { revealIdentity: isBlind }),
  };
}

function toNotices(workspace: ReviewWorkspace, reviewedReference: string | null): NoticeView[] {
  const copy = ORGANIZER_COPY.workspace;
  const notices: NoticeView[] = [];

  if (reviewedReference) {
    notices.push({
      id: "review-continued",
      tone: "success",
      title: copy.continued.title(reviewedReference),
      body: copy.continued.body,
      actions: [],
    });
  }

  if (workspace.reviewAccess === "owned_by_another_organizer") {
    notices.push({ id: "review-owned", tone: "info", ...copy.access.owned, actions: [] });
  } else if (workspace.reviewAccess === "locked") {
    const decided = isDecisionStatus(workspace.application.status);
    notices.push({
      id: decided ? "review-decided" : "review-not-submitted",
      tone: "info",
      ...(decided ? copy.access.decided : copy.access.notSubmitted),
      actions: [],
    });
  } else if (workspace.review?.isCompleted) {
    notices.push({ id: "review-completed", tone: "success", ...copy.completed, actions: [] });
  }

  return notices;
}

/**
 * The review workspace for one application. Blind unless the data layer returned identity; narrative answers without
 * identifying fields; the rubric scorecard with anchors for the lowest, middle, and highest scores and the saved
 * review as initial values; decision release (`available` only when `canReleaseDecision`, `released` once decided,
 * otherwise `unavailable`; null for drafts); and notices for review access, a completed review, and arrival through
 * Save review and continue.
 */
export function toReviewWorkspaceView(
  workspace: ReviewWorkspace,
  options: ReviewWorkspaceViewOptions = {},
): ReviewWorkspaceView {
  const { application } = workspace;
  return {
    applicationId: application.id,
    type: application.type,
    reference: application.applicantReference,
    header: toHeaderView(workspace),
    blind: toBlindModeView(workspace),
    identity: workspace.identity ? toIdentityView(application.type, workspace.identity) : null,
    narrative: {
      title: ORGANIZER_COPY.workspace.narrativeTitle,
      sections: toNarrativeSections(application.type, application.narrative as Record<string, unknown>),
    },
    scorecard: toScorecardView(workspace),
    decision: toDecisionView(workspace),
    notices: toNotices(workspace, options.reviewedReference ?? null),
  };
}
