import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { updateApplicationStatus } from "@/app/actions/applications";
import {
  findNextUnreviewedApplication,
  revealApplicantIdentity,
  saveReview,
  submitReview,
} from "@/app/actions/reviews";
import { getMyApplication } from "@/lib/data/applications";
import { getOrganizerDashboard, getReviewWorkspace, listApplications } from "@/lib/data/organizer";
import type { ApplicationListPage } from "@/lib/data/types";
import type { DecisionStatus } from "@/lib/domain/enums";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";
import {
  actAs,
  createApplicationAs,
  createOrganizer,
  createTestClient,
  expectFailure,
  expectOk,
  queryRows,
  redirectError,
  signUpTestUser,
  type TestUser,
} from "./helpers";

// Completion gate 4: an Organizer can list applications, save a review, and release only
// Accepted or Waitlisted.

/** Unique search token so list assertions only see this file's applications. */
const token = `wf${randomUUID().replace(/-/g, "").slice(0, 10)}`;

const completeHackerRubric = {
  scores: { motivation: 4, initiative: 5, growth: 3, community: 4 },
  notes: "Strong fit.",
  recommendation: "strong_yes",
} as const;

const completeJudgeRubric = {
  scores: { expertise: 5, evaluation: 4, motivation: 4, availability: 3 },
  recommendation: "yes",
} as const;

let organizer: TestUser;
let otherOrganizer: TestUser;
let hacker: TestUser;
let blindApplicant: TestUser;
let hackerAppId: string;
let judgeAppId: string;
let draftAppId: string;
let blindAppId: string;
let queueAppId: string;

function ids(page: ApplicationListPage): string[] {
  return page.items.map((item) => item.id);
}

beforeAll(async () => {
  [organizer, otherOrganizer] = await Promise.all([
    createOrganizer(`${token}-org`),
    createOrganizer(`${token}-org2`),
  ]);

  const [judge, drafter, queued] = await Promise.all([
    signUpTestUser({ label: `${token}-judge`, role: "judge" }),
    signUpTestUser({ label: `${token}-drafter`, role: "hacker" }),
    signUpTestUser({ label: `${token}-queued`, role: "hacker" }),
  ]);
  [hacker, blindApplicant] = await Promise.all([
    signUpTestUser({ label: `${token}-hacker`, role: "hacker" }),
    signUpTestUser({ label: `${token}-blind`, role: "hacker" }),
  ]);

  [hackerAppId, judgeAppId, draftAppId, blindAppId, queueAppId] = await Promise.all([
    createApplicationAs(hacker, "hacker", validHackerResponses, { submit: true }),
    createApplicationAs(judge, "judge", { ...validJudgeResponses, expertiseAreas: ["climate", "mobile"] }, { submit: true }),
    createApplicationAs(drafter, "hacker", { preferredName: "Draft Only" }, { submit: false }),
    createApplicationAs(blindApplicant, "hacker", validHackerResponses, { submit: true }),
    createApplicationAs(queued, "hacker", validHackerResponses, { submit: true }),
  ]);
});

describe("organizer application list and dashboard", () => {
  it("lists submitted applications with filters and pagination, excluding drafts by default", async () => {
    actAs(organizer);

    const all = await listApplications({ search: token });
    expect(ids(all).sort()).toEqual([blindAppId, hackerAppId, judgeAppId, queueAppId].sort());
    expect(all.total).toBe(4);

    expect(ids(await listApplications({ search: token, type: "judge" }))).toEqual([judgeAppId]);
    expect(ids(await listApplications({ search: token, status: "draft" }))).toEqual([draftAppId]);
    expect((await listApplications({ search: token, reviewState: "reviewed" })).total).toBe(0);

    const page = await listApplications({ search: token, pageSize: 3, page: 2, sort: "submitted_asc" });
    expect(page).toMatchObject({ total: 4, page: 2, pageSize: 3, pageCount: 2 });
    expect(page.items).toHaveLength(1);

    const item = all.items.find((entry) => entry.id === hackerAppId);
    expect(item).toMatchObject({
      type: "hacker",
      status: "submitted",
      applicantEmail: hacker.email,
      affiliation: validHackerResponses.school,
      review: null,
    });
    expect(item?.applicantReference).toMatch(/^H-\d+$/);
    expect(item?.launchedAt).not.toBeNull();
  });

  it("returns dashboard aggregates, including Judge expertise coverage", async () => {
    actAs(organizer);

    const dashboard = await getOrganizerDashboard();

    const [counts] = await queryRows<{ total: number; drafts: number; submitted: number }>(
      `select count(*)::int as total,
              (count(*) filter (where status = 'draft'))::int as drafts,
              (count(*) filter (where status <> 'draft'))::int as submitted
       from public.applications`,
    );
    expect(dashboard.overview).toMatchObject({
      totalApplications: counts.total,
      draftCount: counts.drafts,
      submittedCount: counts.submitted,
    });
    expect(dashboard.statusBreakdown.reduce((sum, entry) => sum + entry.total, 0)).toBe(counts.total);
    expect(dashboard.queueProgress.total).toBe(counts.submitted);

    const [climate] = await queryRows<{ count: number }>(
      `select count(*)::int as count
       from public.applications
       where application_type = 'judge' and status <> 'draft' and responses -> 'expertiseAreas' ? 'climate'`,
    );
    expect(climate.count).toBeGreaterThanOrEqual(1);
    expect(dashboard.expertiseCoverage).toHaveLength(12);
    expect(dashboard.expertiseCoverage.find((entry) => entry.expertise === "climate")?.judgeCount).toBe(climate.count);
    expect(dashboard.expertiseGaps).not.toContain("climate");
    expect(dashboard.recentSubmissions.length).toBeGreaterThan(0);
    expect(dashboard.nextUnreviewedApplicationId).not.toBeNull();
  });
});

describe("blind review workspace", () => {
  it("hides applicant identity by default and reveals it on request", async () => {
    actAs(organizer);

    const blind = await getReviewWorkspace(blindAppId);
    expect(blind).toMatchObject({
      isBlind: true,
      identity: null,
      review: null,
      reviewAccess: "editable",
      canReleaseDecision: false,
    });
    expect(blind?.application.applicantReference).toMatch(/^H-\d+$/);
    for (const key of ["preferredName", "school", "links"]) {
      expect(blind?.application.narrative).not.toHaveProperty(key);
    }
    expect(blind?.application.narrative).toMatchObject({
      major: validHackerResponses.major,
      buildGoals: validHackerResponses.buildGoals,
    });

    const identity = expectOk(await revealApplicantIdentity(blindAppId));
    expect(identity).toMatchObject({
      applicationId: blindAppId,
      email: blindApplicant.email,
      preferredName: validHackerResponses.preferredName,
      affiliation: validHackerResponses.school,
      links: validHackerResponses.links,
    });

    const revealed = await getReviewWorkspace(blindAppId, { revealIdentity: true });
    expect(revealed).toMatchObject({ isBlind: false, identity: { email: blindApplicant.email } });

    expect(await getReviewWorkspace(randomUUID())).toBeNull();
    expect(await getReviewWorkspace("not-a-uuid")).toBeNull();
    expectFailure(await revealApplicantIdentity(randomUUID()), "not_found");
  });
});

describe("review and decision workflow", () => {
  it("validates rubric input before writing anything", async () => {
    actAs(organizer);

    const error = expectFailure(
      await saveReview(hackerAppId, { scores: { motivation: 9, expertise: 3 } }),
      "validation_failed",
    );
    expect(error.fieldErrors).toHaveProperty(["scores.motivation"]);

    const [row] = await queryRows<{ status: string; reviews: number }>(
      `select a.status::text as status,
              (select count(*)::int from public.reviews r where r.application_id = a.id) as reviews
       from public.applications a
       where a.id = $1`,
      [hackerAppId],
    );
    expect(row).toEqual({ status: "submitted", reviews: 0 });

    expectFailure(await saveReview(draftAppId, { notes: "Too early" }), "invalid_status_transition");
    expectFailure(await saveReview(randomUUID(), { notes: "Missing" }), "not_found");
  });

  it("saves draft reviews, merges changes, and moves the application into review", async () => {
    actAs(organizer);

    const saved = expectOk(
      await saveReview(hackerAppId, { scores: { motivation: 4, initiative: 5 }, notes: "Promising start." }),
    );
    expect(saved.review).toMatchObject({
      reviewerId: organizer.userId,
      isMine: true,
      isCompleted: false,
      overallScore: null,
      notes: "Promising start.",
      scores: { motivation: 4, initiative: 5 },
      recommendation: null,
    });
    expect(saved.application.status).toBe("in_review");
    expect(saved.application.reviewStartedAt).not.toBeNull();

    const merged = expectOk(
      await saveReview(hackerAppId, { scores: { growth: 3, initiative: null }, recommendation: "yes" }),
    );
    expect(merged.review.scores).toEqual({ motivation: 4, growth: 3 });
    expect(merged.review).toMatchObject({ notes: "Promising start.", recommendation: "yes" });

    actAs(hacker);
    expect(await getMyApplication()).toMatchObject({
      status: "in_review",
      mission: { stage: "cruise", isUnderReview: true },
    });
  });

  it("completes the review, then releases only Accepted or Waitlisted", async () => {
    actAs(organizer);

    expectFailure(await updateApplicationStatus(hackerAppId, "accepted"), "review_not_completed");

    const incomplete = expectFailure(
      await submitReview(hackerAppId, { scores: { motivation: 4, growth: 3 }, recommendation: "yes" }),
      "validation_failed",
    );
    expect(incomplete.fieldErrors).toHaveProperty(["scores.initiative"]);

    const completed = expectOk(await submitReview(hackerAppId, completeHackerRubric));
    expect(completed.review).toMatchObject({
      isCompleted: true,
      overallScore: 4,
      recommendation: "strong_yes",
      notes: "Strong fit.",
    });
    expect(completed.review.completedAt).not.toBeNull();
    expect(completed.nextApplicationId).not.toBe(hackerAppId);
    expect(completed.queueProgress).not.toBeNull();

    expectFailure(await saveReview(hackerAppId, { notes: "Back to draft" }), "review_already_completed");

    for (const status of ["rejected", "draft", "submitted", "in_review"]) {
      const error = expectFailure(
        await updateApplicationStatus(hackerAppId, status as unknown as DecisionStatus),
        "validation_failed",
      );
      expect(error.fieldErrors).toHaveProperty("status");
    }

    const decision = expectOk(await updateApplicationStatus(hackerAppId, "accepted"));
    expect(decision).toMatchObject({ applicationId: hackerAppId, status: "accepted" });
    expect(decision.decisionReleasedAt).toBeTruthy();

    // Decisions are final and lock the review.
    expectFailure(await updateApplicationStatus(hackerAppId, "waitlisted"), "invalid_status_transition");
    expectFailure(await submitReview(hackerAppId, completeHackerRubric), "review_locked");

    actAs(hacker);
    const mine = await getMyApplication();
    expect(mine).toMatchObject({
      status: "accepted",
      isEditable: false,
      mission: { stage: "landing", decision: "accepted" },
    });
    expect(mine?.decisionReleasedAt).not.toBeNull();
  });

  it("refuses decisions for drafts and for applications without a completed review", async () => {
    actAs(organizer);
    expectFailure(await updateApplicationStatus(draftAppId, "accepted"), "invalid_status_transition");
    expectFailure(await updateApplicationStatus(blindAppId, "waitlisted"), "review_not_completed");
    expectFailure(await updateApplicationStatus(randomUUID(), "accepted"), "not_found");
  });

  it("keeps each review with the organizer who started it", async () => {
    actAs(organizer);
    expectOk(await saveReview(judgeAppId, { scores: { expertise: 5 } }));

    actAs(otherOrganizer);
    expectFailure(await saveReview(judgeAppId, { scores: { evaluation: 2 } }), "review_owned_by_another_organizer");
    expectFailure(await submitReview(judgeAppId, completeJudgeRubric), "review_owned_by_another_organizer");

    const hijack = await otherOrganizer.client
      .from("reviews")
      .update({ notes: "Hijacked" })
      .eq("application_id", judgeAppId)
      .select("id");
    expect(hijack).toMatchObject({ error: null, data: [] });

    const duplicate = await otherOrganizer.client
      .from("reviews")
      .insert({ application_id: judgeAppId, reviewer_id: otherOrganizer.userId });
    expect(duplicate.error?.code).toBe("23505");

    actAs(organizer);
    const completed = expectOk(await submitReview(judgeAppId, completeJudgeRubric));
    expect(completed.review).toMatchObject({ overallScore: 4, recommendation: "yes", scores: completeJudgeRubric.scores });

    // Any organizer may release the official decision once the review is complete.
    actAs(otherOrganizer);
    expect(expectOk(await updateApplicationStatus(judgeAppId, "waitlisted")).status).toBe("waitlisted");
  });
});

describe("review queue", () => {
  async function walkQueue(user: TestUser): Promise<string[]> {
    actAs(user);
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let step = 0; step < 500; step += 1) {
      const next: string | null = expectOk(await findNextUnreviewedApplication(cursor)).applicationId;
      if (!next || seen.includes(next)) {
        break;
      }
      seen.push(next);
      cursor = next;
    }
    return seen;
  }

  it("visits each unreviewed application once and skips other organizers' draft reviews", async () => {
    actAs(organizer);
    expectOk(await saveReview(queueAppId, { notes: "Started" }));

    const mine = await walkQueue(organizer);
    const theirs = await walkQueue(otherOrganizer);

    expect(mine).toEqual(expect.arrayContaining([queueAppId, blindAppId]));
    expect(theirs).toContain(blindAppId);
    expect(theirs).not.toContain(queueAppId);
    for (const finished of [hackerAppId, judgeAppId, draftAppId]) {
      expect(mine).not.toContain(finished);
      expect(theirs).not.toContain(finished);
    }

    const visited = [...new Set([...mine, ...theirs])];
    const rows = await queryRows<{ status: string; completed: boolean }>(
      `select a.status::text as status, (r.completed_at is not null) as completed
       from public.applications a
       left join public.reviews r on r.application_id = a.id
       where a.id = any($1::uuid[])`,
      [visited],
    );
    expect(rows).toHaveLength(visited.length);
    for (const row of rows) {
      expect(["submitted", "in_review"]).toContain(row.status);
      expect(row.completed).toBe(false);
    }
  });

  it("reports review access for claimed and decided applications", async () => {
    actAs(otherOrganizer);
    expect((await getReviewWorkspace(queueAppId))?.reviewAccess).toBe("owned_by_another_organizer");
    expect(await getReviewWorkspace(hackerAppId)).toMatchObject({ reviewAccess: "locked", canReleaseDecision: false });
  });
});

describe("organizer writes through the Data API", () => {
  it("cannot edit applicant answers or skip workflow rules", async () => {
    const client = organizer.client;

    const tamper = await client
      .from("applications")
      .update({ responses: { preferredName: "Tampered" } })
      .eq("id", blindAppId)
      .select("id");
    expect(tamper.error?.code).toBe("42501");

    const skipReview = await client.from("applications").update({ status: "accepted" }).eq("id", blindAppId).select("id");
    expect(skipReview.error?.hint).toBe("review_not_completed");

    const backToDraft = await client.from("applications").update({ status: "draft" }).eq("id", blindAppId).select("id");
    expect(backToDraft.error).not.toBeNull();

    const [row] = await queryRows<{ status: string; name: string }>(
      "select status::text as status, responses ->> 'preferredName' as name from public.applications where id = $1",
      [blindAppId],
    );
    expect(row).toEqual({ status: "submitted", name: validHackerResponses.preferredName });
  });

  it("cannot promote an account that already owns an application", async () => {
    await expect(queryRows("select private.promote_to_organizer($1)", [hacker.email])).rejects.toThrow();
  });
});

describe("organizer-only access", () => {
  it("rejects applicants and signed-out users", async () => {
    actAs(hacker);
    const results = [
      await saveReview(blindAppId, { notes: "Not allowed" }),
      await submitReview(blindAppId, completeHackerRubric),
      await updateApplicationStatus(blindAppId, "accepted"),
      await revealApplicantIdentity(blindAppId),
      await findNextUnreviewedApplication(),
    ];
    for (const result of results) {
      expectFailure(result, "forbidden");
    }
    await expect(getOrganizerDashboard()).rejects.toMatchObject(redirectError());
    await expect(listApplications()).rejects.toMatchObject(redirectError());
    await expect(getReviewWorkspace(blindAppId)).rejects.toMatchObject(redirectError());

    actAs(createTestClient());
    expectFailure(await saveReview(blindAppId, {}), "unauthenticated");
    expectFailure(await updateApplicationStatus(blindAppId, "accepted"), "unauthenticated");
  });
});
