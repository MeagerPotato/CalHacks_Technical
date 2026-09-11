import { describe, expect, it } from "vitest";

import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_FORMS, APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import { formatApplicantReference } from "@/lib/domain/applicant-identity";
import type { ApplicationStatus, ApplicationType } from "@/lib/domain/enums";
import { deriveMissionState } from "@/lib/domain/mission";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { toAnswerSections } from "@/lib/view-models/answers";
import { resolveFieldCopy } from "@/lib/view-models/fields";
import { toMissionView } from "@/lib/view-models/mission";
import { toPortalView, type PortalViewInput } from "@/lib/view-models/portal";
import { toReadinessItems, toSectionNavItems } from "@/lib/view-models/readiness";
import type {
  AnswerSectionView,
  AnswerView,
  MissionLegView,
  PortalDraftView,
  ReadinessItemView,
  SectionNavItemView,
  TimestampView,
} from "@/lib/view-models/types";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const CREATED_AT = "2026-09-01T17:00:00.000Z";
const UPDATED_AT = "2026-09-08T21:15:00.000Z";
const LAUNCHED_AT = "2026-09-09T18:30:00.000Z";
// Postgres returns microseconds; views receive milliseconds.
const REVIEW_STARTED_AT = "2026-09-12T16:05:00.123456+00:00";
const DECISION_RELEASED_AT = "2026-09-20T19:45:00.000Z";
const DEADLINE = "2026-10-01T06:59:00.000Z";

const UPDATED: TimestampView = { iso: UPDATED_AT, label: "Sep 8, 2026, 2:15 PM PDT" };
const LAUNCHED: TimestampView = { iso: LAUNCHED_AT, label: "Sep 9, 2026, 11:30 AM PDT" };
const REVIEW_STARTED: TimestampView = { iso: "2026-09-12T16:05:00.123Z", label: "Sep 12, 2026, 9:05 AM PDT" };
const RELEASED: TimestampView = { iso: DECISION_RELEASED_AT, label: "Sep 20, 2026, 12:45 PM PDT" };
const DEADLINE_VIEW: TimestampView = { iso: DEADLINE, label: "Sep 30, 2026, 11:59 PM PDT" };

const REFERENCE_NUMBER = 1042;
const SUBMITTED_STATUSES = ["submitted", "in_review", "accepted", "waitlisted"] as const;

/** A Hacker draft with About complete and Education started: 4 of 12 required answers. */
const PARTIAL_HACKER = {
  preferredName: "Maya",
  location: "Oakland, CA",
  bio: "Builder of small tools.",
  school: "Example University",
};

interface ApplicationOverrides {
  type?: ApplicationType;
  status?: ApplicationStatus;
  responses?: Record<string, unknown>;
  updatedAt?: string;
  launchedAt?: string | null;
  reviewStartedAt?: string | null;
  decisionReleasedAt?: string | null;
}

/** Builds an applicant DTO the way the data layer does, with workflow timestamps that fit the status. */
function buildApplication(overrides: ApplicationOverrides = {}): ApplicantApplication {
  const type = overrides.type ?? "hacker";
  const status = overrides.status ?? "draft";
  const responses = overrides.responses ?? {};
  const decided = status === "accepted" || status === "waitlisted";
  const launchedAt =
    overrides.launchedAt === undefined ? (status === "draft" ? null : LAUNCHED_AT) : overrides.launchedAt;
  const reviewStartedAt =
    overrides.reviewStartedAt === undefined
      ? status === "in_review" || decided
        ? REVIEW_STARTED_AT
        : null
      : overrides.reviewStartedAt;
  const decisionReleasedAt =
    overrides.decisionReleasedAt === undefined ? (decided ? DECISION_RELEASED_AT : null) : overrides.decisionReleasedAt;
  const completion = calculateApplicationCompletion(type, responses);

  return {
    id: "00000000-0000-4000-8000-000000001042",
    referenceNumber: REFERENCE_NUMBER,
    applicantReference: formatApplicantReference(type, REFERENCE_NUMBER),
    type,
    status,
    completionPercent: completion.percent,
    launchedAt,
    reviewStartedAt,
    decisionReleasedAt,
    createdAt: CREATED_AT,
    updatedAt: overrides.updatedAt ?? UPDATED_AT,
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

function stepHref(step: string): string {
  return `/portal/application?section=${step}`;
}

function readinessIds(
  items: readonly ReadinessItemView[],
  flag: "isCurrent" | "justCompleted" | "needsAttention",
): string[] {
  return items.filter((item) => item[flag]).map((item) => item.id);
}

function navSteps(
  items: readonly SectionNavItemView[],
  flag: "isActive" | "justCompleted" | "needsAttention",
): string[] {
  return items.filter((item) => item[flag]).map((item) => item.step);
}

function answersByKey(sections: readonly AnswerSectionView[]): Record<string, AnswerView> {
  return Object.fromEntries(sections.flatMap((section) => section.answers).map((answer) => [answer.key, answer]));
}

function draftView(input: PortalViewInput): PortalDraftView {
  const view = toPortalView(input);
  if (view.kind !== "draft") {
    throw new Error(`Expected a draft portal view, got ${view.kind}.`);
  }
  return view;
}

// -----------------------------------------------------------------------------
// Launch Readiness and section navigation
// -----------------------------------------------------------------------------

describe("toReadinessItems", () => {
  const partial = calculateApplicationCompletion("hacker", PARTIAL_HACKER);

  it("maps each section's state, label, progress text, and editor href in form order", () => {
    const upcoming = { stateLabel: COPY.readiness.states.not_started, isCurrent: false };
    const unflagged = { justCompleted: false, needsAttention: false };

    expect(toReadinessItems("hacker", partial, {})).toEqual([
      {
        id: "about",
        label: "About you",
        state: "complete",
        stateLabel: COPY.readiness.states.complete,
        isCurrent: false,
        ...unflagged,
        progressText: COPY.readiness.progress(3, 3),
        href: "/portal/application?section=about",
      },
      {
        id: "education",
        label: "Education",
        state: "in_progress",
        stateLabel: COPY.readiness.states.in_progress,
        isCurrent: true,
        ...unflagged,
        progressText: COPY.readiness.progress(1, 3),
        href: stepHref("education"),
      },
      {
        id: "experience",
        label: "Experience",
        state: "not_started",
        ...upcoming,
        ...unflagged,
        progressText: COPY.readiness.progress(0, 3),
        href: stepHref("experience"),
      },
      {
        id: "short_answers",
        label: "Short answers",
        state: "not_started",
        ...upcoming,
        ...unflagged,
        progressText: COPY.readiness.progress(0, 2),
        href: stepHref("short_answers"),
      },
      {
        id: "agreements",
        label: "Agreements",
        state: "not_started",
        ...upcoming,
        ...unflagged,
        progressText: COPY.readiness.progress(0, 1),
        href: stepHref("agreements"),
      },
    ]);
  });

  it("marks the next incomplete section current when no current section is given", () => {
    expect(readinessIds(toReadinessItems("hacker", partial, {}), "isCurrent")).toEqual(["education"]);
    expect(readinessIds(toReadinessItems("hacker", partial, { currentSectionId: null }), "isCurrent")).toEqual([
      "education",
    ]);
  });

  it("marks the given current section instead", () => {
    expect(readinessIds(toReadinessItems("hacker", partial, { currentSectionId: "experience" }), "isCurrent")).toEqual([
      "experience",
    ]);
    expect(readinessIds(toReadinessItems("hacker", partial, { currentSectionId: "about" }), "isCurrent")).toEqual([
      "about",
    ]);
    // On the review step no section is current.
    expect(readinessIds(toReadinessItems("hacker", partial, { currentSectionId: "review" }), "isCurrent")).toEqual([]);
  });

  it("marks nothing current once every section is complete", () => {
    const items = toReadinessItems("judge", calculateApplicationCompletion("judge", validJudgeResponses), {});
    expect(items.map((item) => [item.id, item.label, item.state])).toEqual([
      ["about", "About you", "complete"],
      ["professional", "Professional background", "complete"],
      ["judging", "Judging", "complete"],
      ["short_answers", "Short answers", "complete"],
      ["agreements", "Agreements", "complete"],
    ]);
    expect(items[1].progressText).toBe(COPY.readiness.progress(3, 3));
    expect(readinessIds(items, "isCurrent")).toEqual([]);
  });

  it("flags sections whose saved answers fail the submission schema", () => {
    const invalidLink = calculateApplicationCompletion("hacker", {
      ...PARTIAL_HACKER,
      links: ["ftp://example.com/maya"],
    });
    expect(invalidLink.sections[0].invalidFields).toEqual(["links"]);

    const items = toReadinessItems("hacker", invalidLink, {});
    expect(readinessIds(items, "needsAttention")).toEqual(["about"]);
    expect(items[0]).toMatchObject({ state: "in_progress", isCurrent: true });
  });

  it("flags sections that contain attention field keys and ignores keys from other forms", () => {
    const items = toReadinessItems("hacker", partial, {
      attentionFieldKeys: ["graduationYear", "skills", "motivation", "constructor", ""],
    });
    expect(readinessIds(items, "needsAttention")).toEqual(["education", "experience"]);
  });

  it("marks only the sections completed by the latest save", () => {
    const items = toReadinessItems("hacker", partial, { justCompleted: ["about", "review", "professional"] });
    expect(readinessIds(items, "justCompleted")).toEqual(["about"]);
    expect(readinessIds(toReadinessItems("hacker", partial, {}), "justCompleted")).toEqual([]);
  });
});

describe("toSectionNavItems", () => {
  const partial = calculateApplicationCompletion("hacker", PARTIAL_HACKER);

  it("lists the sections in form order, then review, with the active step", () => {
    const items = toSectionNavItems("hacker", partial, "education", {});
    expect(items.map((item) => item.step)).toEqual([
      "about",
      "education",
      "experience",
      "short_answers",
      "agreements",
      "review",
    ]);
    expect(navSteps(items, "isActive")).toEqual(["education"]);
    expect(items[1]).toEqual({
      step: "education",
      label: "Education",
      state: "in_progress",
      stateLabel: COPY.readiness.states.in_progress,
      isActive: true,
      needsAttention: false,
      justCompleted: false,
      href: stepHref("education"),
    });
  });

  it("labels the review step not started while the application cannot be submitted", () => {
    const items = toSectionNavItems("hacker", partial, "education", {});
    expect(items[items.length - 1]).toEqual({
      step: "review",
      label: COPY.editor.reviewStep,
      state: "review",
      stateLabel: COPY.readiness.states.not_started,
      isActive: false,
      needsAttention: false,
      justCompleted: false,
      href: "/portal/application?section=review",
    });
  });

  it("labels the review step complete once the application can be submitted", () => {
    const complete = calculateApplicationCompletion("judge", validJudgeResponses);
    const items = toSectionNavItems("judge", complete, "review", {});
    expect(items.map((item) => item.state)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "review",
    ]);
    expect(navSteps(items, "isActive")).toEqual(["review"]);
    expect(items[items.length - 1]).toMatchObject({
      step: "review",
      stateLabel: COPY.readiness.states.complete,
      isActive: true,
    });
  });

  it("carries attention and fresh-completion flags on sections, never on review", () => {
    const outOfRange = calculateApplicationCompletion("hacker", { ...PARTIAL_HACKER, graduationYear: 1999 });
    expect(outOfRange.sections[1].invalidFields).toEqual(["graduationYear"]);

    const items = toSectionNavItems("hacker", outOfRange, "about", {
      justCompleted: ["about", "review"],
      attentionFieldKeys: ["proudProject", "review", "motivation"],
    });
    expect(navSteps(items, "needsAttention")).toEqual(["education", "short_answers"]);
    expect(navSteps(items, "justCompleted")).toEqual(["about"]);
  });
});

// -----------------------------------------------------------------------------
// Answers
// -----------------------------------------------------------------------------

describe("toAnswerSections", () => {
  it("groups every field by section in form order with resolved labels", () => {
    for (const [type, responses] of [
      ["hacker", validHackerResponses],
      ["judge", validJudgeResponses],
    ] as const) {
      const sections = toAnswerSections(type, responses, { editable: false });
      const form = APPLICATION_FORMS[type];
      expect(sections.map((section) => [section.id, section.label])).toEqual(
        form.sections.map((section) => [section.id, section.label]),
      );
      expect(sections.flatMap((section) => section.answers.map((answer) => [answer.key, answer.label]))).toEqual(
        form.sections.flatMap((section) =>
          section.fields.map((field) => [field.key, resolveFieldCopy(type, field).label]),
        ),
      );
    }
  });

  it("shows option labels, numbers as strings, link lists, and an accepted agreement", () => {
    const answers = answersByKey(toAnswerSections("hacker", validHackerResponses, { editable: false }));

    expect(answers.preferredName).toMatchObject({ value: "Test Hacker", missingText: null, errors: [] });
    expect(answers.experienceLevel.value).toBe("Intermediate");
    expect(answers.skills.value).toEqual(["Web development", "AI / machine learning"]);
    expect(answers.graduationYear.value).toBe("2027");
    expect(answers.previousHackathonCount.value).toBe("2");
    expect(answers.links.value).toEqual(["https://example.com/test-hacker"]);
    expect(answers.codeOfConductAccepted).toMatchObject({ value: COPY.review.agreementAccepted, missingText: null });
    expect(Object.values(answers).filter((answer) => answer.value === null || answer.missingText !== null)).toEqual([]);
  });

  it("shows judge choices and treats an empty link list and blank optional text as unanswered", () => {
    const answers = answersByKey(toAnswerSections("judge", validJudgeResponses, { editable: false }));

    expect(answers.expertiseAreas.value).toEqual(["Web", "Security"]);
    expect(answers.availability.value).toEqual(["Sunday morning"]);
    expect(answers.preferredCategories.value).toEqual(["Developer tools"]);
    expect(answers.yearsExperience.value).toBe("9");
    expect(answers.links).toMatchObject({ value: null, missingText: COPY.review.notAnswered });
    expect(answers.conflictsOfInterest).toMatchObject({ value: null, missingText: COPY.review.notAnswered });
  });

  it("shows stored values the config does not list as stored", () => {
    const answers = answersByKey(
      toAnswerSections("hacker", { experienceLevel: "wizard", skills: ["web", "juggling"] }, { editable: false }),
    );
    expect(answers.experienceLevel.value).toBe("wizard");
    expect(answers.skills.value).toEqual(["Web development", "juggling"]);
  });

  it("keeps zero as an answer", () => {
    const answers = answersByKey(toAnswerSections("hacker", { previousHackathonCount: 0 }, { editable: false }));
    expect(answers.previousHackathonCount).toMatchObject({ value: "0", missingText: null });
  });

  it("treats blank strings and empty lists as unanswered and marks required fields", () => {
    const answers = answersByKey(
      toAnswerSections(
        "hacker",
        {
          preferredName: "   ",
          bio: "",
          links: ["", "   "],
          skills: [],
          experienceLevel: "",
          graduationYear: Number.NaN,
        },
        { editable: false },
      ),
    );
    const requiredKeys = [
      "preferredName",
      "bio",
      "skills",
      "experienceLevel",
      "graduationYear",
      "school",
      "proudProject",
    ];
    for (const key of requiredKeys) {
      expect(answers[key], key).toMatchObject({ value: null, missingText: COPY.review.notAnsweredRequired });
    }
    expect(answers.links).toMatchObject({ value: null, missingText: COPY.review.notAnswered });

    const judge = answersByKey(toAnswerSections("judge", {}, { editable: false }));
    expect(judge.company).toMatchObject({ value: null, missingText: COPY.review.notAnswered });
    expect(judge.roleTitle).toMatchObject({ value: null, missingText: COPY.review.notAnsweredRequired });
  });

  it.each([
    [true, COPY.review.agreementAccepted],
    [false, COPY.review.agreementNotAccepted],
    [undefined, COPY.review.agreementNotAccepted],
    [null, COPY.review.agreementNotAccepted],
    ["true", COPY.review.agreementNotAccepted],
  ])("shows a stored agreement of %j as %j with no missing text", (stored, expected) => {
    const answers = answersByKey(toAnswerSections("hacker", { codeOfConductAccepted: stored }, { editable: false }));
    expect(answers.codeOfConductAccepted).toMatchObject({ value: expected, missingText: null });
  });

  it("attaches each field's own errors as a copy", () => {
    const fieldErrors = {
      bio: ["Use 600 characters or fewer."],
      links: ["Enter a full link starting with http:// or https://.", "Add up to 5 links."],
      notAField: ["Ignored."],
    };
    const answers = answersByKey(toAnswerSections("hacker", validHackerResponses, { fieldErrors, editable: true }));

    expect(answers.bio.errors).toEqual(fieldErrors.bio);
    expect(answers.bio.errors).not.toBe(fieldErrors.bio);
    expect(answers.links.errors).toEqual(fieldErrors.links);
    expect(
      Object.values(answers)
        .filter((answer) => answer.errors.length > 0)
        .map((answer) => answer.key),
    ).toEqual(["bio", "links"]);

    const withoutErrors = answersByKey(toAnswerSections("hacker", validHackerResponses, { editable: true }));
    expect(Object.values(withoutErrors).filter((answer) => answer.errors.length > 0)).toEqual([]);
  });

  it("shows a saved draft's submission errors beside its answers, including the agreement", () => {
    // Saves as a draft but cannot be submitted: a non-http link, a missing required answer, and no agreement.
    const responses: Record<string, unknown> = { ...validHackerResponses, links: ["ftp://example.com/maya"] };
    delete responses.proudProject;
    delete responses.codeOfConductAccepted;
    const { fieldErrors } = calculateApplicationCompletion("hacker", responses);
    expect(fieldErrors).toEqual({
      links: [expect.any(String)],
      proudProject: [expect.any(String)],
      codeOfConductAccepted: [expect.any(String)],
    });

    const answers = answersByKey(toAnswerSections("hacker", responses, { fieldErrors, editable: true }));
    expect(answers.links).toMatchObject({
      value: ["ftp://example.com/maya"],
      missingText: null,
      errors: fieldErrors.links,
    });
    expect(answers.proudProject).toMatchObject({
      value: null,
      missingText: COPY.review.notAnsweredRequired,
      errors: fieldErrors.proudProject,
    });
    expect(answers.codeOfConductAccepted).toMatchObject({
      value: COPY.review.agreementNotAccepted,
      missingText: null,
      errors: fieldErrors.codeOfConductAccepted,
    });
    expect(
      Object.values(answers)
        .filter((answer) => answer.errors.length > 0)
        .map((answer) => answer.key),
    ).toEqual(["links", "proudProject", "codeOfConductAccepted"]);
  });

  it("adds edit links only while the application is editable", () => {
    const editable = toAnswerSections("hacker", validHackerResponses, { editable: true });
    expect(editable.map((section) => [section.editLabel, section.editHref])).toEqual(
      APPLICATION_FORMS.hacker.sections.map((section) => [
        COPY.review.editSection(section.label),
        stepHref(section.id),
      ]),
    );
    expect(editable[0]).toMatchObject({ id: "about", editHref: "/portal/application?section=about" });

    const readOnly = toAnswerSections("hacker", validHackerResponses, { editable: false });
    expect(readOnly.map((section) => [section.editLabel, section.editHref])).toEqual(
      readOnly.map(() => [null, null]),
    );
  });
});

// -----------------------------------------------------------------------------
// Mission tracker
// -----------------------------------------------------------------------------

describe("toMissionView", () => {
  const launchLeg: MissionLegView = {
    leg: "launch",
    name: LOCKED.mission.legs.launch,
    state: "complete",
    stateLabel: COPY.mission.legStates.complete,
    detail: APPLICATION_STATUS_LABELS.submitted,
    time: LAUNCHED,
    timePrefix: COPY.mission.launched,
  };
  const pendingLandingLeg: MissionLegView = {
    leg: "landing",
    name: LOCKED.mission.legs.landing,
    state: "upcoming",
    stateLabel: COPY.mission.legStates.upcoming,
    detail: COPY.mission.decisionPending,
    time: null,
    timePrefix: null,
  };

  it("shows a submitted application cruising, with its launch time and a received note", () => {
    expect(toMissionView(buildApplication({ status: "submitted", responses: validHackerResponses }))).toEqual({
      stage: "cruise",
      status: "submitted",
      statusLabel: APPLICATION_STATUS_LABELS.submitted,
      headline: LOCKED.mission.cruising,
      legs: [
        launchLeg,
        {
          leg: "cruise",
          name: LOCKED.mission.legs.cruise,
          state: "current",
          stateLabel: COPY.mission.legStates.current,
          detail: APPLICATION_STATUS_LABELS.in_review,
          time: null,
          timePrefix: null,
        },
        pendingLandingLeg,
      ],
      decision: null,
      reviewNote: COPY.mission.received,
    });
  });

  it("shows an application in review, with the review start time and the review note", () => {
    expect(toMissionView(buildApplication({ status: "in_review", responses: validHackerResponses }))).toEqual({
      stage: "cruise",
      status: "in_review",
      statusLabel: APPLICATION_STATUS_LABELS.in_review,
      headline: LOCKED.mission.cruising,
      legs: [
        launchLeg,
        {
          leg: "cruise",
          name: LOCKED.mission.legs.cruise,
          state: "current",
          stateLabel: COPY.mission.legStates.current,
          detail: APPLICATION_STATUS_LABELS.in_review,
          time: REVIEW_STARTED,
          timePrefix: COPY.mission.reviewStarted,
        },
        pendingLandingLeg,
      ],
      decision: null,
      reviewNote: COPY.mission.reviewNote,
    });
  });

  it.each(["accepted", "waitlisted"] as const)("lands a released %s decision with its release time", (status) => {
    expect(toMissionView(buildApplication({ type: "judge", status, responses: validJudgeResponses }))).toEqual({
      stage: "landing",
      status,
      statusLabel: APPLICATION_STATUS_LABELS[status],
      headline: LOCKED.mission.landed,
      legs: [
        launchLeg,
        {
          leg: "cruise",
          name: LOCKED.mission.legs.cruise,
          state: "complete",
          stateLabel: COPY.mission.legStates.complete,
          detail: APPLICATION_STATUS_LABELS.in_review,
          time: REVIEW_STARTED,
          timePrefix: COPY.mission.reviewStarted,
        },
        {
          leg: "landing",
          name: LOCKED.mission.legs.landing,
          state: "complete",
          stateLabel: COPY.mission.legStates.complete,
          detail: APPLICATION_STATUS_LABELS[status],
          time: RELEASED,
          timePrefix: COPY.mission.released,
        },
      ],
      decision: {
        status,
        label: APPLICATION_STATUS_LABELS[status],
        message: COPY.mission.decision[status],
        releasedAt: RELEASED,
      },
      reviewNote: null,
    });
  });

  it.each([...SUBMITTED_STATUSES, "draft"] as const)("never outputs a percentage or an ETA for %s", (status) => {
    const json = JSON.stringify(toMissionView(buildApplication({ status, responses: validHackerResponses })));
    expect(json).not.toContain("%");
    expect(json).not.toContain("ETA");
    expect(json).not.toMatch(/estimat/i);
  });

  it("shows only timestamps the application really has", () => {
    const view = toMissionView(buildApplication({ status: "accepted", reviewStartedAt: null }));
    expect(view.legs[1]).toMatchObject({ state: "complete", time: null, timePrefix: null });
    expect(view.legs[2]).toMatchObject({ time: RELEASED, timePrefix: COPY.mission.released });
  });

  it("derives the stage and legs from the application's own status and timestamps", () => {
    const accepted = buildApplication({ status: "accepted" });
    const staleSnapshot = deriveMissionState({
      status: "draft",
      launched_at: null,
      review_started_at: null,
      decision_released_at: null,
    });
    const stale = { ...accepted, mission: staleSnapshot } as ApplicantApplication;
    expect(toMissionView(stale)).toEqual(toMissionView(accepted));
  });

  it("maps a draft through the domain derivation instead of throwing: assembly, every leg upcoming", () => {
    const view = toMissionView(buildApplication({ status: "draft", responses: validHackerResponses }));
    expect(view).toMatchObject({
      stage: "assembly",
      status: "draft",
      statusLabel: APPLICATION_STATUS_LABELS.draft,
      headline: LOCKED.mission.cruising,
      decision: null,
      reviewNote: null,
    });
    expect(view.legs.map((leg) => [leg.leg, leg.state, leg.stateLabel, leg.time, leg.timePrefix])).toEqual([
      ["launch", "upcoming", COPY.mission.legStates.upcoming, null, null],
      ["cruise", "upcoming", COPY.mission.legStates.upcoming, null, null],
      ["landing", "upcoming", COPY.mission.legStates.upcoming, null, null],
    ]);
    expect(view.legs[2].detail).toBe(COPY.mission.decisionPending);
  });
});

// -----------------------------------------------------------------------------
// Portal
// -----------------------------------------------------------------------------

describe("toPortalView", () => {
  const viewer = { displayName: "Ada Builder" };

  it("invites an unsaved, empty draft to start at the first section", () => {
    const application = buildApplication({ updatedAt: CREATED_AT });
    expect(toPortalView({ viewer, application, deadline: null })).toEqual({
      kind: "draft",
      welcome: {
        greeting: COPY.portal.greeting("Ada Builder"),
        typeLabel: APPLICATION_TYPE_LABELS.hacker,
        reference: COPY.portal.reference("H-1042"),
      },
      progress: {
        percent: 0,
        valueText: COPY.portal.progressValue(0),
        nextStep: { label: "About you", href: "/portal/application?section=about" },
        lastSaved: null,
        cta: { label: COPY.portal.startCta, href: "/portal/application?section=about" },
      },
      deadline: null,
      readiness: toReadinessItems("hacker", application.completion, {}),
    });
  });

  it("continues a partial draft at the next incomplete section, with the last saved time", () => {
    const view = draftView({ viewer, application: buildApplication({ responses: PARTIAL_HACKER }), deadline: null });
    expect(view.progress).toEqual({
      percent: 33,
      valueText: COPY.portal.progressValue(33),
      nextStep: { label: "Education", href: stepHref("education") },
      lastSaved: UPDATED,
      cta: { label: COPY.portal.continueCta, href: stepHref("education") },
    });
    expect(readinessIds(view.readiness, "isCurrent")).toEqual(["education"]);
  });

  it("offers the start call to action only when nothing is complete and nothing was saved", () => {
    // Saved with only an optional answer: still 0 percent, but no longer a fresh start.
    const optionalOnly = draftView({
      viewer,
      application: buildApplication({ responses: { links: ["https://example.com/maya"] } }),
      deadline: null,
    });
    expect(optionalOnly.progress).toMatchObject({
      percent: 0,
      lastSaved: UPDATED,
      cta: { label: COPY.portal.continueCta, href: stepHref("about") },
    });

    // Timestamps still equal: no last saved time, but answered progress is not a fresh start either.
    const unsaved = draftView({
      viewer,
      application: buildApplication({ responses: PARTIAL_HACKER, updatedAt: CREATED_AT }),
      deadline: null,
    });
    expect(unsaved.progress).toMatchObject({ percent: 33, lastSaved: null, cta: { label: COPY.portal.continueCta } });
  });

  it("sends a submittable draft to review", () => {
    const view = draftView({
      viewer,
      application: buildApplication({ type: "judge", responses: validJudgeResponses }),
      deadline: null,
    });
    expect(view.welcome).toEqual({
      greeting: COPY.portal.greeting("Ada Builder"),
      typeLabel: APPLICATION_TYPE_LABELS.judge,
      reference: COPY.portal.reference("J-1042"),
    });
    expect(view.progress).toEqual({
      percent: 100,
      valueText: COPY.portal.progressValue(100),
      nextStep: { label: COPY.editor.reviewStep, href: "/portal/application?section=review" },
      lastSaved: UPDATED,
      cta: { label: COPY.portal.reviewCta, href: "/portal/application?section=review" },
    });
    expect(readinessIds(view.readiness, "isCurrent")).toEqual([]);
  });

  it("falls back to review when an unsubmittable draft reports no incomplete section", () => {
    const complete = buildApplication({ responses: validHackerResponses });
    const application = {
      ...complete,
      completion: { ...complete.completion, percent: 99, isSubmittable: false },
    } as ApplicantApplication;
    expect(application.completion.nextIncompleteSectionId).toBeNull();

    expect(draftView({ viewer, application, deadline: null }).progress).toMatchObject({
      nextStep: { label: COPY.editor.reviewStep, href: stepHref("review") },
      cta: { label: COPY.portal.continueCta, href: stepHref("review") },
    });
  });

  it.each([
    ["the display name first", "Ada Builder", { preferredName: "Maya" }, "Ada Builder"],
    ["a trimmed preferred name", null, { preferredName: "  Maya  " }, "Maya"],
    ["the preferred name when the display name is blank", "   ", { preferredName: "Maya" }, "Maya"],
    ["no name when the preferred name is blank", null, { preferredName: "   " }, null],
    ["no name when neither exists", null, {}, null],
  ] as const)("greets with %s", (_case, displayName, responses, name) => {
    const application = buildApplication({ responses });
    const view = toPortalView({ viewer: { displayName }, application, deadline: null });
    expect(view.welcome.greeting).toBe(COPY.portal.greeting(name));
  });

  it("formats a set deadline in both variants and keeps it null while to be announced", () => {
    const submitted = buildApplication({ status: "submitted", responses: validHackerResponses });
    expect(toPortalView({ viewer, application: buildApplication(), deadline: DEADLINE }).deadline).toEqual(
      DEADLINE_VIEW,
    );
    expect(toPortalView({ viewer, application: submitted, deadline: DEADLINE }).deadline).toEqual(DEADLINE_VIEW);
    expect(toPortalView({ viewer, application: buildApplication(), deadline: null }).deadline).toBeNull();
    expect(toPortalView({ viewer, application: submitted, deadline: null }).deadline).toBeNull();
  });

  it.each(SUBMITTED_STATUSES)("shows a %s application's status, launch time, and links", (status) => {
    const application = buildApplication({ status, responses: validHackerResponses });
    expect(toPortalView({ viewer: { displayName: null }, application, deadline: null })).toEqual({
      kind: "submitted",
      welcome: {
        greeting: COPY.portal.greeting("Test Hacker"),
        typeLabel: APPLICATION_TYPE_LABELS.hacker,
        reference: COPY.portal.reference("H-1042"),
      },
      status,
      statusLabel: APPLICATION_STATUS_LABELS[status],
      launched: LAUNCHED,
      deadline: null,
      trackHref: "/portal/mission",
      viewHref: "/portal/application",
    });
  });
});
