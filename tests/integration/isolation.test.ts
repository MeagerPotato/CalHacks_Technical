import { beforeAll, describe, expect, it } from "vitest";

import { DataAccessError } from "@/lib/data/errors";
import {
  fetchApplicantIdentity,
  fetchApplicationList,
  fetchNextUnreviewedApplicationId,
  fetchOrganizerDashboard,
} from "@/lib/data/organizer";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";
import {
  callUntypedRpc,
  createApplicationAs,
  createOrganizer,
  createTestClient,
  queryRows,
  signUpTestUser,
  type TestUser,
} from "./helpers";

// Completion gate 5: an ordinary applicant cannot read other applications, reviews, or organizer data.

let applicant: TestUser;
let otherApplicant: TestUser;
let ownAppId: string;
let otherAppId: string;

beforeAll(async () => {
  [applicant, otherApplicant] = await Promise.all([
    signUpTestUser({ label: "isolation-hacker", role: "hacker" }),
    signUpTestUser({ label: "isolation-judge", role: "judge" }),
  ]);
  [ownAppId, otherAppId] = await Promise.all([
    createApplicationAs(applicant, "hacker", validHackerResponses, { submit: true }),
    createApplicationAs(otherApplicant, "judge", validJudgeResponses, { submit: true }),
  ]);

  // Organizer reviews exist for both applications, including the applicant's own.
  const organizer = await createOrganizer("isolation-organizer");
  for (const applicationId of [ownAppId, otherAppId]) {
    const { error } = await organizer.client
      .from("reviews")
      .insert({ application_id: applicationId, reviewer_id: organizer.userId, notes: "Private organizer note" });
    if (error) {
      throw new Error(`Review setup failed: ${error.code}`);
    }
  }
});

describe("applicant data isolation", () => {
  it("returns only the applicant's own application", async () => {
    const { data, error } = await applicant.client.from("applications").select("id, user_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: ownAppId, user_id: applicant.userId }]);

    const other = await applicant.client.from("applications").select("id, responses").eq("id", otherAppId).maybeSingle();
    expect(other).toMatchObject({ data: null, error: null });

    const [{ count }] = await queryRows<{ count: number }>("select count(*)::int as count from public.applications");
    expect(count).toBeGreaterThan(1);
  });

  it("returns no reviews, not even reviews of the applicant's own application", async () => {
    const { data, error } = await applicant.client.from("reviews").select("id, notes");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const [{ count }] = await queryRows<{ count: number }>(
      "select count(*)::int as count from public.reviews where application_id = $1",
      [ownAppId],
    );
    expect(count).toBe(1);
  });

  it("returns only the applicant's own profile", async () => {
    const { data, error } = await applicant.client.from("profiles").select("id, email, account_role");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: applicant.userId, email: applicant.email, account_role: "hacker" }]);
  });

  it("refuses every organizer read function", async () => {
    const responses = await Promise.all([
      applicant.client.rpc("get_organizer_overview"),
      applicant.client.rpc("get_application_status_breakdown"),
      applicant.client.rpc("get_judge_expertise_counts"),
      applicant.client.rpc("list_review_applications", {}),
      applicant.client.rpc("get_next_unreviewed_application_id", {}),
    ]);

    for (const { data, error } of responses) {
      expect(data).toBeNull();
      expect(error).toMatchObject({ code: "42501", hint: "forbidden" });
    }
  });

  it("gets forbidden from the organizer data access layer", async () => {
    await expect(fetchOrganizerDashboard(applicant.client)).rejects.toBeInstanceOf(DataAccessError);
    await expect(fetchOrganizerDashboard(applicant.client)).rejects.toMatchObject({ code: "forbidden" });
    await expect(fetchApplicationList(applicant.client, {})).rejects.toMatchObject({ code: "forbidden" });
    await expect(fetchNextUnreviewedApplicationId(applicant.client)).rejects.toMatchObject({ code: "forbidden" });
    expect(await fetchApplicantIdentity(applicant.client, otherAppId)).toBeNull();
  });

  it("cannot write reviews or call private helpers through the Data API", async () => {
    const insert = await applicant.client
      .from("reviews")
      .insert({ application_id: ownAppId, reviewer_id: applicant.userId, notes: "Self review" });
    expect(insert.error?.code).toBe("42501");

    for (const fn of ["is_organizer", "current_account_role", "promote_to_organizer"]) {
      const { error } = await callUntypedRpc(applicant.client, fn);
      expect(error, fn).not.toBeNull();
    }
  });
});

describe("signed-out visitors", () => {
  it("cannot read tables or call organizer functions", async () => {
    const anon = createTestClient();

    const results = await Promise.all([
      anon.from("profiles").select("id"),
      anon.from("applications").select("id"),
      anon.from("reviews").select("id"),
      anon.rpc("get_organizer_overview"),
    ]);

    for (const { data, error } of results) {
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
  });
});
