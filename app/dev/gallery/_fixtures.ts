import { ACTION_ERROR_MESSAGES, type ActionErrorCode } from "@/lib/actions/result";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationStatus, ApplicationType } from "@/lib/domain/enums";
import { deriveMissionState } from "@/lib/domain/mission";
import { noticeForError, toSummaryItems, type FeedbackCode } from "@/lib/editor/feedback";
import { selectSaveStatus } from "@/lib/editor/reducer";
import { applicationStepHref, sectionForField } from "@/lib/editor/steps";
import { toTimestampView } from "@/lib/format/datetime";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { toAnswerSections } from "@/lib/view-models/answers";
import { toMissionView } from "@/lib/view-models/mission";
import { toPortalView } from "@/lib/view-models/portal";
import { toReadinessItems, toSectionNavItems } from "@/lib/view-models/readiness";
import type { MissionView, NoticeView, PortalView } from "@/lib/view-models/types";
import {
  draftInvalidHackerResponses,
  partialHackerResponses,
  validHackerResponses,
  validJudgeResponses,
} from "@/tests/fixtures/applications";

// Development gallery fixtures. Every view model is built by the real pure functions from test fixture answers,
// so the gallery shows exactly what the product renders. Never imported by product routes (lint-restricted).

const CREATED_AT = "2026-09-01T17:00:00.000Z";
const UPDATED_AT = "2026-09-08T21:15:00.000Z";
const LAUNCHED_AT = "2026-09-09T18:30:00.000Z";
const REVIEW_STARTED_AT = "2026-09-12T16:05:00.000Z";
const DECISION_RELEASED_AT = "2026-09-20T19:45:00.000Z";
/** A sample deadline for the deadline card only; the product shows "To be announced" until one is configured. */
const SAMPLE_DEADLINE = "2026-10-01T06:59:00.000Z";

export interface GalleryVariant<T> {
  id: string;
  label: string;
  view: T;
}

function buildApplication(
  index: number,
  type: ApplicationType,
  responses: Record<string, unknown>,
  status: ApplicationStatus,
  updatedAt = UPDATED_AT,
): ApplicantApplication {
  const decided = status === "accepted" || status === "waitlisted";
  const launchedAt = status === "draft" ? null : LAUNCHED_AT;
  const reviewStartedAt = status === "in_review" || decided ? REVIEW_STARTED_AT : null;
  const decisionReleasedAt = decided ? DECISION_RELEASED_AT : null;
  const completion = calculateApplicationCompletion(type, responses);
  const referenceNumber = 1000 + index;

  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    referenceNumber,
    applicantReference: `${type === "hacker" ? "H" : "J"}-${referenceNumber}`,
    type,
    status,
    completionPercent: completion.percent,
    launchedAt,
    reviewStartedAt,
    decisionReleasedAt,
    createdAt: CREATED_AT,
    updatedAt,
    responses,
    completion,
    mission: deriveMissionState({
      status,
      launched_at: launchedAt,
      review_started_at: reviewStartedAt,
      decision_released_at: decisionReleasedAt,
    }),
    isEditable: status === "draft",
  } as ApplicantApplication;
}

const viewer = { displayName: "Ada Builder" };

const emptyDraft = buildApplication(1, "hacker", {}, "draft", CREATED_AT);
const partialDraft = buildApplication(2, "hacker", partialHackerResponses, "draft");
const invalidDraft = buildApplication(3, "hacker", draftInvalidHackerResponses, "draft");
const readyDraft = buildApplication(4, "judge", validJudgeResponses, "draft");

const submittedApplications = [
  buildApplication(5, "hacker", validHackerResponses, "submitted"),
  buildApplication(6, "hacker", validHackerResponses, "in_review"),
  buildApplication(7, "judge", validJudgeResponses, "accepted"),
  buildApplication(8, "hacker", validHackerResponses, "waitlisted"),
];

export const sampleTimestamp = toTimestampView(UPDATED_AT);

/** Every portal dashboard state. The gallery renders one at a time so the dashboard's fixed ids stay unique. */
export const portalViews: GalleryVariant<PortalView>[] = [
  { id: "not-started", label: "Draft, not started", view: toPortalView({ viewer, application: emptyDraft, deadline: null }) },
  { id: "in-progress", label: "Draft, in progress", view: toPortalView({ viewer, application: partialDraft, deadline: null }) },
  {
    id: "ready",
    label: "Draft, ready to submit, with a deadline",
    view: toPortalView({ viewer, application: readyDraft, deadline: SAMPLE_DEADLINE }),
  },
  ...submittedApplications.map((application) => ({
    id: application.status,
    label: APPLICATION_STATUS_LABELS[application.status],
    view: toPortalView({ viewer, application, deadline: null }),
  })),
];

/** Mission tracker states for every submitted status. */
export const missionViews: GalleryVariant<MissionView>[] = submittedApplications.map((application) => ({
  id: application.status,
  label: APPLICATION_STATUS_LABELS[application.status],
  view: toMissionView(application),
}));

export const readinessItems = toReadinessItems("hacker", partialDraft.completion, {
  justCompleted: ["about"],
  attentionFieldKeys: ["graduationYear"],
});

export const sectionNavItems = toSectionNavItems("hacker", partialDraft.completion, "education", {
  justCompleted: ["about"],
  attentionFieldKeys: ["graduationYear"],
});

export const reviewAnswerSections = toAnswerSections("hacker", invalidDraft.responses, {
  fieldErrors: invalidDraft.completion.fieldErrors,
  editable: true,
});

export const submittedAnswerSections = toAnswerSections("hacker", validHackerResponses, { editable: false });

export const summaryItems = toSummaryItems("hacker", invalidDraft.completion.fieldErrors, (key) =>
  applicationStepHref(sectionForField("hacker", key) ?? "review", key),
);

const FEEDBACK_CODES = [
  ...(Object.keys(ACTION_ERROR_MESSAGES) as ActionErrorCode[]),
  "network",
  "stale_deployment",
  "unconfirmed_submit",
] satisfies FeedbackCode[];

export const notices: NoticeView[] = FEEDBACK_CODES.flatMap((code) => {
  const notice = noticeForError(code, { signInHref: "/login" });
  return notice ? [notice] : [];
});

// One view per save status state: saved, saving, dirty, invalid (a dirty answer with an error), error, and blocked.
export const saveStatusViews = [
  selectSaveStatus({ phase: "editing", saveStatus: "idle", dirtyKeys: [], errors: {} }),
  selectSaveStatus({ phase: "editing", saveStatus: "saving", dirtyKeys: ["bio"], errors: {} }),
  selectSaveStatus({ phase: "editing", saveStatus: "idle", dirtyKeys: ["bio"], errors: {} }),
  selectSaveStatus({
    phase: "editing",
    saveStatus: "idle",
    dirtyKeys: ["links"],
    errors: invalidDraft.completion.fieldErrors,
  }),
  selectSaveStatus({ phase: "editing", saveStatus: "error", dirtyKeys: ["bio"], errors: {} }),
  selectSaveStatus({ phase: "locked", saveStatus: "idle", dirtyKeys: [], errors: {} }),
];
