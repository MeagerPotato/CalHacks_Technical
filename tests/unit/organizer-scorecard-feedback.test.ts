import { describe, expect, it } from "vitest";

import { COPY, ORGANIZER_COPY } from "@/content/copy";
import { ACTION_ERROR_MESSAGES, type ActionErrorCode } from "@/lib/actions/result";
import { ROUTES } from "@/lib/routes";
import { toFieldErrors } from "@/lib/validation/errors";
import { REVIEW_SCHEMAS } from "@/lib/validation/review";
import {
  organizerNoticeFor,
  organizerSignInHref,
  queueDoneNotice,
  type OrganizerFeedbackCode,
} from "@/lib/view-models/organizer-feedback";
import {
  applicationsHref,
  isIdentityRevealed,
  parseReviewedReference,
  reviewWorkspaceHref,
  toOrganizerNavItems,
} from "@/lib/view-models/organizer-routes";
import {
  emptyScorecardErrors,
  notesCounterText,
  overallScoreText,
  reviewScoreControlId,
  scoreErrorKey,
  scorecardValuesEqual,
  toReviewDraftPayload,
  toReviewErrorState,
  toReviewSubmissionPayload,
  toScorecardValues,
} from "@/lib/view-models/organizer-scorecard";
import { formatCount, formatScore, toCount, toPercent, toQueueProgressView } from "@/lib/view-models/organizer-shared";
import { draftReviewRecord, fixtureApplicationId, reviewRecord } from "@/tests/fixtures/organizer";
import { completeHackerRubric } from "@/tests/fixtures/reviews";

describe("organizer routes", () => {
  it("marks the current organizer page in the navigation", () => {
    expect(toOrganizerNavItems("/organizer").map((item) => item.current)).toEqual(["page", null]);
    expect(toOrganizerNavItems("/organizer/applications/").map((item) => item.current)).toEqual([null, "page"]);
    expect(
      toOrganizerNavItems(`/organizer/applications/${fixtureApplicationId(1)}`).map((item) => item.current),
    ).toEqual([null, "true"]);
    expect(toOrganizerNavItems("/organizerx").map((item) => item.current)).toEqual([null, null]);
    expect(toOrganizerNavItems(null).map((item) => item.current)).toEqual([null, null]);
    expect(toOrganizerNavItems("/organizer").map((item) => [item.id, item.label, item.href])).toEqual([
      ["dashboard", ORGANIZER_COPY.nav.dashboard, ROUTES.organizer],
      ["applications", ORGANIZER_COPY.nav.applications, ROUTES.organizerApplications],
    ]);
  });

  it("builds list URLs without default values", () => {
    expect(applicationsHref({})).toBe(ROUTES.organizerApplications);
    expect(applicationsHref({ search: "a b", sort: "submitted_desc", page: 1, pageSize: 25 })).toBe(
      "/organizer/applications?search=a+b",
    );
  });

  it("builds workspace URLs for blind mode and arrival", () => {
    const id = fixtureApplicationId(3);
    expect(reviewWorkspaceHref(id)).toBe(`/organizer/applications/${id}`);
    expect(reviewWorkspaceHref(id, { revealIdentity: true })).toBe(`/organizer/applications/${id}?identity=revealed`);
    expect(reviewWorkspaceHref(id, { reviewedReference: "H-1001" })).toBe(`/organizer/applications/${id}?reviewed=H-1001`);
    expect(reviewWorkspaceHref("a/b")).toBe("/organizer/applications/a%2Fb");
  });

  it("reveals identity only for exactly identity=revealed", () => {
    expect(isIdentityRevealed("revealed")).toBe(true);
    expect(isIdentityRevealed(["revealed", "hidden"])).toBe(true);
    for (const value of [undefined, "", "true", "REVEALED", " revealed", ["hidden", "revealed"]]) {
      expect(isIdentityRevealed(value)).toBe(false);
    }
  });

  it("accepts only well-formed blind references for the arrival notice", () => {
    expect(parseReviewedReference("H-1042")).toBe("H-1042");
    expect(parseReviewedReference(["J-7", "H-1"])).toBe("J-7");
    for (const value of [undefined, "", "X-1", "H-", "H-12a", "<b>H-1</b>", "H-1042 ", "Test Hacker"]) {
      expect(parseReviewedReference(value)).toBeNull();
    }
  });
});

describe("organizer shared builders", () => {
  it("formats counts, scores, and percents defensively", () => {
    expect(toCount(3.7)).toBe(3);
    expect(toCount(-1)).toBe(0);
    expect(toCount(Number.NaN)).toBe(0);
    expect(toCount("4")).toBe(0);
    expect(formatCount(12345)).toBe("12,345");
    expect(formatScore(4)).toBe("4.00");
    expect(formatScore(3.5)).toBe("3.50");
    expect(formatScore(null)).toBeNull();
    expect(formatScore(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toPercent(1, 3)).toBe(33);
    expect(toPercent(5, 0)).toBe(0);
    expect(toPercent(9, 4)).toBe(100);
  });

  it("describes queue progress with counts only", () => {
    expect(toQueueProgressView({ total: 1, reviewed: 0, remaining: 1 })).toEqual({
      label: "Review queue",
      percent: 0,
      valueText: "0 of 1 reviewed",
      remainingText: "1 application needs review",
    });
    expect(toQueueProgressView({ total: 0, reviewed: 0, remaining: 0 })).toMatchObject({
      percent: 0,
      valueText: ORGANIZER_COPY.queue.value(0, 0),
      remainingText: "0 applications need review",
    });
  });
});

describe("scorecard values and payloads", () => {
  it("starts blank with every dimension unscored", () => {
    expect(toScorecardValues("hacker", null)).toEqual({
      scores: { motivation: null, initiative: null, growth: null, community: null },
      notes: "",
      recommendation: "",
    });
  });

  it("drops stored scores outside the rubric and unknown recommendations", () => {
    const review = {
      scores: { motivation: 9, initiative: 2.5, growth: 3, extra: 4 },
      notes: "Note",
      recommendation: "definitely" as never,
    };
    expect(toScorecardValues("hacker", review)).toEqual({
      scores: { motivation: null, initiative: null, growth: 3, community: null },
      notes: "Note",
      recommendation: "",
    });
  });

  it("treats missing and null scores as equal when comparing values", () => {
    const blank = toScorecardValues("hacker", null);
    expect(scorecardValuesEqual(blank, { ...blank, scores: {} })).toBe(true);
    expect(scorecardValuesEqual(blank, { ...blank, notes: "x" })).toBe(false);
    expect(scorecardValuesEqual(blank, { ...blank, recommendation: "maybe" })).toBe(false);
    expect(scorecardValuesEqual(blank, { ...blank, scores: { ...blank.scores, growth: 2 } })).toBe(false);
  });

  it("builds a draft payload that clears unscored dimensions and passes the draft schema", () => {
    const payload = toReviewDraftPayload("hacker", toScorecardValues("hacker", draftReviewRecord("hacker")));
    expect(payload).toEqual({
      scores: { motivation: 4, initiative: null, growth: null, community: null },
      notes: "",
      recommendation: null,
    });
    expect(REVIEW_SCHEMAS.hacker.draft.safeParse(payload).success).toBe(true);
  });

  it("builds a submission payload that passes the submission schema for a complete review", () => {
    const payload = toReviewSubmissionPayload("hacker", toScorecardValues("hacker", reviewRecord("hacker")));
    expect(payload).toEqual({
      scores: { ...completeHackerRubric.scores },
      notes: completeHackerRubric.notes,
      recommendation: completeHackerRubric.recommendation,
    });
    expect(REVIEW_SCHEMAS.hacker.submission.safeParse(payload).success).toBe(true);
    expect(toReviewSubmissionPayload("hacker", toScorecardValues("hacker", null)).scores).toEqual({});
  });

  it("shows the live overall score only once every dimension is scored", () => {
    expect(overallScoreText("hacker", toScorecardValues("hacker", reviewRecord("hacker")).scores)).toBe("4.00 out of 5");
    expect(overallScoreText("judge", { expertise: 5, evaluation: 4, motivation: 4, availability: 4 })).toBe(
      "4.25 out of 5",
    );
    expect(overallScoreText("hacker", { motivation: 4, initiative: null })).toBe(
      ORGANIZER_COPY.workspace.scorecard.overallPending,
    );
    expect(notesCounterText("abc", 5000)).toBe("3 of 5000 characters");
  });
});

describe("toReviewErrorState", () => {
  it("maps submission errors to dimensions, the recommendation, and notes in form order", () => {
    const parsed = REVIEW_SCHEMAS.hacker.submission.safeParse({
      scores: { motivation: 4 },
      notes: "x".repeat(5001),
      recommendation: null,
    });
    expect(parsed.success).toBe(false);
    const state = toReviewErrorState("hacker", parsed.success ? undefined : toFieldErrors(parsed.error, 2));

    expect(Object.keys(state.errors.scores)).toEqual(["initiative", "growth", "community"]);
    expect(state.errors.scores.initiative).toEqual(["Score every rubric dimension."]);
    expect(state.errors.recommendation).toEqual(["Choose a recommendation."]);
    expect(state.errors.notes).toEqual(["Use 5000 characters or fewer."]);
    expect(state.summary.map((item) => [item.key, item.href])).toEqual([
      ["scores.initiative", "#review-score-initiative"],
      ["scores.growth", "#review-score-growth"],
      ["scores.community", "#review-score-community"],
      ["recommendation", "#review-recommendation"],
      ["notes", "#review-notes"],
    ]);
    expect(state.summary[0].label).toBe("Initiative and evidence of building/learning");
    expect(state.summary[3].label).toBe("Recommendation");
    expect(state.summary[4].label).toBe("Private organizer notes");
    expect(state.unplaced).toEqual([]);
  });

  it("puts a message about the scores object on the first dimension and returns unknown keys as unplaced", () => {
    const state = toReviewErrorState("judge", {
      scores: ["Score every rubric dimension."],
      reviewer: ["Not a review field."],
      empty: [],
    });
    expect(state.errors.scores).toEqual({ expertise: ["Score every rubric dimension."] });
    expect(state.summary).toEqual([
      {
        key: "scores.expertise",
        label: "Relevant expertise",
        message: "Score every rubric dimension.",
        href: "#review-score-expertise",
      },
    ]);
    expect(state.unplaced).toEqual(["Not a review field."]);
  });

  it("returns empty errors without field errors", () => {
    expect(toReviewErrorState("hacker", undefined)).toEqual({ errors: emptyScorecardErrors(), summary: [], unplaced: [] });
    expect(emptyScorecardErrors()).not.toBe(emptyScorecardErrors());
    expect(reviewScoreControlId("growth")).toBe("review-score-growth");
    expect(scoreErrorKey("growth")).toBe("scores.growth");
  });
});

describe("organizerNoticeFor", () => {
  const codes: OrganizerFeedbackCode[] = [
    ...(Object.keys(ACTION_ERROR_MESSAGES) as ActionErrorCode[]),
    "network",
    "stale_deployment",
  ];

  it("maps every action error code and browser failure to organizer notice copy", () => {
    for (const code of codes) {
      const notice = organizerNoticeFor(code);
      expect(Object.keys(ORGANIZER_COPY.notices), code).toContain(notice.id);
      const copy = ORGANIZER_COPY.notices[notice.id as keyof typeof ORGANIZER_COPY.notices];
      expect(notice.title).toBe(copy.title);
      expect(notice.body).toBe(copy.body);
    }
  });

  it("uses review-specific copy and a refresh action for review and decision codes", () => {
    expect(organizerNoticeFor("review_owned_by_another_organizer")).toEqual({
      id: "review_owned_by_another_organizer",
      tone: "warning",
      title: ORGANIZER_COPY.notices.review_owned_by_another_organizer.title,
      body: ORGANIZER_COPY.notices.review_owned_by_another_organizer.body,
      actions: [{ kind: "reload_latest", label: COPY.notices.actions.reloadLatest }],
    });
    expect(organizerNoticeFor("review_locked").tone).toBe("info");
    expect(organizerNoticeFor("review_not_completed").id).toBe("review_not_completed");
    expect(organizerNoticeFor("conflict").actions.map((action) => action.kind)).toEqual(["retry", "reload_latest"]);
    expect(organizerNoticeFor("stale_deployment").actions.map((action) => action.kind)).toEqual(["reload"]);
  });

  it("links sign-in back to the current path", () => {
    const href = organizerSignInHref("/organizer/applications/abc?identity=revealed");
    expect(href).toBe("/login?next=%2Forganizer%2Fapplications%2Fabc%3Fidentity%3Drevealed");
    expect(organizerNoticeFor("unauthenticated", { signInHref: href }).actions).toEqual([
      { kind: "sign_in_new_tab", label: COPY.notices.actions.signInNewTab, href },
      { kind: "retry", label: COPY.notices.actions.retry },
    ]);
    expect(organizerNoticeFor("unauthenticated").actions[0].href).toBe(ROUTES.login);
  });

  it("uses the unexpected error notice for auth, applicant, and unknown codes", () => {
    for (const code of ["email_taken", "application_locked", "application_incomplete"] as const) {
      expect(organizerNoticeFor(code)).toMatchObject({ id: "unexpected_error", tone: "error" });
    }
    expect(organizerNoticeFor("mystery" as OrganizerFeedbackCode)).toMatchObject({ id: "unexpected_error", tone: "error" });
  });

  it("returns a new object on every call", () => {
    expect(organizerNoticeFor("network")).not.toBe(organizerNoticeFor("network"));
    expect(organizerNoticeFor("network").actions).not.toBe(organizerNoticeFor("network").actions);
  });

  it("builds the queue-done success notice", () => {
    expect(queueDoneNotice()).toEqual({
      id: "queue-done",
      tone: "success",
      title: ORGANIZER_COPY.workspace.queueDone.title,
      body: ORGANIZER_COPY.workspace.queueDone.body,
      actions: [],
    });
  });
});
