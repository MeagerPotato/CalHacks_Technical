import { describe, expect, it } from "vitest";

import { ORGANIZER_COPY } from "@/content/copy";
import { APPLICATION_FORMS, RECOMMENDATION_OPTIONS, RUBRIC_FORMS } from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { toTimestampView } from "@/lib/format/datetime";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import { toIdentityView, toNarrativeSections, toReviewWorkspaceView } from "@/lib/view-models/organizer-review";
import { validHackerResponses, validJudgeResponses } from "@/tests/fixtures/applications";
import {
  ORGANIZER_TIMES,
  OTHER_REVIEWER_ID,
  applicantIdentity,
  draftReviewRecord,
  fixtureApplicationId,
  reviewRecord,
  reviewWorkspace,
} from "@/tests/fixtures/organizer";

const RESPONSES: Record<ApplicationType, Record<string, unknown>> = {
  hacker: validHackerResponses,
  judge: validJudgeResponses,
};

function fieldKeys(type: ApplicationType, identifying: boolean): string[] {
  return APPLICATION_FORMS[type].sections.flatMap((section) =>
    section.fields.filter((field) => field.identifying === identifying).map((field) => field.key),
  );
}

function storedStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() === "" ? [] : [value];
  }
  return Array.isArray(value) ? value.flatMap(storedStrings) : [];
}

describe("toNarrativeSections", () => {
  it.each(["hacker", "judge"] as const)("renders every non-identifying %s field in form order, read-only", (type) => {
    const sections = toNarrativeSections(type, RESPONSES[type]);
    expect(sections.flatMap((section) => section.answers.map((answer) => answer.key))).toEqual(fieldKeys(type, false));
    expect(sections.every((section) => section.editHref === null && section.editLabel === null)).toBe(true);
  });

  it.each(["hacker", "judge"] as const)("never shows a stored identifying %s answer", (type) => {
    const rendered = JSON.stringify(toNarrativeSections(type, RESPONSES[type]));
    const identifyingValues = fieldKeys(type, true).flatMap((key) => storedStrings(RESPONSES[type][key]));
    expect(identifyingValues.length).toBeGreaterThan(0);
    for (const value of identifyingValues) {
      expect(rendered).not.toContain(value);
    }
  });

  it("shows missing text for unanswered narrative questions", () => {
    const answers = toNarrativeSections("judge", {}).flatMap((section) => section.answers);
    expect(answers.length).toBe(fieldKeys("judge", false).length);
    expect(answers.every((answer) => answer.value === null || typeof answer.value === "string")).toBe(true);
  });
});

describe("toIdentityView", () => {
  it("reads the About you details, email, affiliation, and http links in form order", () => {
    expect(toIdentityView("hacker", applicantIdentity("hacker"))).toEqual({
      title: "Applicant identity",
      missingText: "Not provided",
      fields: [
        { key: "name", label: "Name", text: "Test Hacker", links: [] },
        { key: "email", label: "Email", text: "applicant-1@example.com", links: [] },
        { key: "birthdate", label: "Birthdate", text: "Feb 14, 2006", links: [] },
        { key: "countryOfResidence", label: "Country of residence", text: "United States", links: [] },
        { key: "cityOfResidence", label: "City of residence", text: "Berkeley", links: [] },
        { key: "affiliation", label: "School", text: "Example University", links: [] },
        {
          key: "links",
          label: "Links",
          text: null,
          links: [{ label: "https://example.com/test-hacker", href: "https://example.com/test-hacker" }],
        },
      ],
    });
  });

  it("labels a Judge affiliation and falls back to the display name", () => {
    const view = toIdentityView("judge", { ...applicantIdentity("judge"), fullName: " ", affiliation: null });
    expect(view.fields[0].text).toBe("Ada Builder");
    expect(view.fields[5]).toEqual({ key: "affiliation", label: "Company / organization", text: null, links: [] });
    expect(view.fields[6].links).toEqual([]);
  });

  it("leaves out details that are missing or not valid", () => {
    const view = toIdentityView("hacker", {
      ...applicantIdentity("hacker"),
      birthdate: "2006-02-30",
      countryOfResidence: "XX",
      cityOfResidence: "   ",
    });
    expect(view.fields.slice(2, 5).map((field) => [field.key, field.text])).toEqual([
      ["birthdate", null],
      ["countryOfResidence", null],
      ["cityOfResidence", null],
    ]);
    const empty = toIdentityView("hacker", {
      ...applicantIdentity("hacker"),
      birthdate: null,
      countryOfResidence: null,
      cityOfResidence: null,
    });
    expect(empty.fields.slice(2, 5).map((field) => field.text)).toEqual([null, null, null]);
  });

  it("drops links that are not http or https URLs", () => {
    const view = toIdentityView("hacker", {
      ...applicantIdentity("hacker"),
      links: ["javascript:alert(1)", "ftp://example.com", "https://", "HTTPS://Example.com/Profile"],
    });
    expect(view.fields[6].links).toEqual([{ label: "HTTPS://Example.com/Profile", href: "HTTPS://Example.com/Profile" }]);
  });
});

describe("toReviewWorkspaceView", () => {
  it("builds a blind, editable workspace for a submitted application", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ status: "submitted" }));
    const path = organizerApplicationRoute(fixtureApplicationId(1));
    expect(view.applicationId).toBe(fixtureApplicationId(1));
    expect(view.reference).toBe("H-1001");
    expect(view.header).toEqual({
      heading: "Applicant H-1001",
      typeLabel: "Hacker",
      status: "submitted",
      statusLabel: "Application submitted",
      submitted: toTimestampView(ORGANIZER_TIMES.launched),
      submittedPrefix: "Submitted",
      notSubmittedText: "Not submitted",
      back: { label: "Back to applications", href: ROUTES.organizerApplications },
      next: { label: "Next application", href: organizerApplicationRoute(fixtureApplicationId(2)) },
      queue: { label: "Review queue", percent: 43, valueText: "3 of 7 reviewed", remainingText: "4 applications need review" },
    });
    expect(view.blind).toEqual({
      isBlind: true,
      statusText: ORGANIZER_COPY.workspace.blind.on,
      toggleLabel: "Show identifying details",
      toggleHref: `${path}?identity=revealed`,
    });
    expect(view.identity).toBeNull();
    expect(view.narrative.title).toBe(ORGANIZER_COPY.workspace.narrativeTitle);
    expect(view.scorecard.access).toBe("editable");
    expect(view.scorecard.saved).toBeNull();
    expect(view.decision).toMatchObject({ state: "unavailable", unavailableText: ORGANIZER_COPY.workspace.decision.unavailable });
    expect(view.notices).toEqual([]);
  });

  it("shows identity only when the data layer returned it", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ revealIdentity: true }));
    expect(view.blind).toEqual({
      isBlind: false,
      statusText: ORGANIZER_COPY.workspace.blind.off,
      toggleLabel: "Hide identifying details",
      toggleHref: organizerApplicationRoute(fixtureApplicationId(1)),
    });
    expect(view.identity?.fields.map((field) => field.key)).toEqual([
      "name",
      "email",
      "birthdate",
      "countryOfResidence",
      "cityOfResidence",
      "affiliation",
      "links",
    ]);
  });

  it("omits Next application when the queue has nothing else", () => {
    expect(toReviewWorkspaceView(reviewWorkspace({ nextUnreviewedApplicationId: null })).header.next).toBeNull();
    expect(
      toReviewWorkspaceView(reviewWorkspace({ nextUnreviewedApplicationId: fixtureApplicationId(1) })).header.next,
    ).toBeNull();
  });

  it("builds the rubric from RUBRIC_FORMS with anchors for the lowest, middle, and highest scores", () => {
    const { scorecard } = toReviewWorkspaceView(reviewWorkspace({ type: "judge" }));
    expect(scorecard.dimensions.map((dimension) => [dimension.key, dimension.label])).toEqual(
      RUBRIC_FORMS.judge.map((dimension) => [dimension.key, dimension.label]),
    );
    const [first] = scorecard.dimensions;
    expect(first.controlId).toBe("review-score-expertise");
    expect(first.name).toBe("score-expertise");
    expect(first.options).toEqual([
      { value: "1", label: "1", anchor: "Little evidence" },
      { value: "2", label: "2", anchor: null },
      { value: "3", label: "3", anchor: "Some evidence" },
      { value: "4", label: "4", anchor: null },
      { value: "5", label: "5", anchor: "Strong evidence" },
    ]);
    expect(scorecard.hint).toBe(ORGANIZER_COPY.workspace.scorecard.hint(1, 5));
    expect(scorecard.recommendation).toEqual({
      id: "review-recommendation",
      name: "recommendation",
      label: "Recommendation",
      hint: ORGANIZER_COPY.workspace.scorecard.recommendationHint,
      options: RECOMMENDATION_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    });
    expect(scorecard.notes).toEqual({
      id: "review-notes",
      label: "Private organizer notes",
      hint: ORGANIZER_COPY.workspace.scorecard.notesHint,
      maxLength: 5000,
    });
    expect(scorecard.maxScore).toBe(5);
    expect(scorecard.actions).toEqual({
      saveDraft: "Save draft",
      saveReview: "Save review",
      saveAndContinue: "Save review and continue",
    });
  });

  it("starts the scorecard from a saved draft review", () => {
    const { scorecard } = toReviewWorkspaceView(reviewWorkspace({ review: draftReviewRecord("hacker") }));
    expect(scorecard.initialValues).toEqual({
      scores: { motivation: 4, initiative: null, growth: null, community: null },
      notes: "",
      recommendation: "",
    });
    expect(scorecard.isCompleted).toBe(false);
    expect(scorecard.saved).toEqual({ prefix: "Draft saved", time: toTimestampView(ORGANIZER_TIMES.reviewStarted) });
  });

  it("offers decision release once the organizer's review is complete", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ review: reviewRecord("hacker") }));
    expect(view.scorecard.saved).toEqual({ prefix: "Review completed", time: toTimestampView(ORGANIZER_TIMES.reviewed) });
    expect(view.decision).toEqual({
      state: "available",
      title: "Decision",
      intro: ORGANIZER_COPY.workspace.decision.intro,
      legend: ORGANIZER_COPY.workspace.decision.legend,
      options: [
        { value: "accepted", label: "Accepted" },
        { value: "waitlisted", label: "Waitlisted" },
      ],
      releaseLabel: "Release decision",
      confirmTitles: { accepted: "Release the Accepted decision?", waitlisted: "Release the Waitlisted decision?" },
      confirmBody: ORGANIZER_COPY.workspace.decision.confirmBody,
      confirmLabel: "Confirm release",
      cancelLabel: "Cancel",
      unavailableText: null,
      released: null,
    });
    expect(view.notices.map((notice) => notice.id)).toEqual(["review-completed"]);
  });

  it("shows another organizer's review read-only", () => {
    const view = toReviewWorkspaceView(
      reviewWorkspace({ review: reviewRecord("hacker", { isMine: false, reviewerId: OTHER_REVIEWER_ID }) }),
    );
    expect(view.scorecard.access).toBe("owned_by_another_organizer");
    expect(view.notices).toEqual([
      { id: "review-owned", tone: "info", ...ORGANIZER_COPY.workspace.access.owned, actions: [] },
    ]);
    expect(view.decision?.state).toBe("available");
  });

  it("locks a draft application and offers no decision", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ status: "draft" }));
    expect(view.scorecard.access).toBe("locked");
    expect(view.header.submitted).toBeNull();
    expect(view.decision).toBeNull();
    expect(view.notices).toEqual([
      { id: "review-not-submitted", tone: "info", ...ORGANIZER_COPY.workspace.access.notSubmitted, actions: [] },
    ]);
  });

  it("shows a released decision and locks the review", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ status: "waitlisted", review: reviewRecord("hacker") }));
    expect(view.scorecard.access).toBe("locked");
    expect(view.notices.map((notice) => notice.id)).toEqual(["review-decided"]);
    expect(view.decision).toMatchObject({
      state: "released",
      unavailableText: null,
      released: {
        status: "waitlisted",
        text: "Decision released: Waitlisted",
        time: toTimestampView(ORGANIZER_TIMES.decided),
        timePrefix: "Released",
      },
    });
  });

  it("puts the arrival notice first after Save review and continue", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ review: reviewRecord("hacker") }), {
      reviewedReference: "J-1009",
    });
    expect(view.notices.map((notice) => notice.id)).toEqual(["review-continued", "review-completed"]);
    expect(view.notices[0]).toEqual({
      id: "review-continued",
      tone: "success",
      title: "Review for Applicant J-1009 saved",
      body: ORGANIZER_COPY.workspace.continued.body,
      actions: [],
    });
  });
});
