import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createApplication, saveApplication, submitApplication } from "@/app/actions/applications";
import { getMyApplication } from "@/lib/data/applications";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";
import {
  actAs,
  createOrganizer,
  createTestClient,
  expectFailure,
  expectOk,
  queryRows,
  redirectError,
  signUpTestUser,
} from "./helpers";

interface StoredApplication {
  status: string;
  responses: Record<string, unknown>;
  completion_percent: number;
  launched_at: Date | null;
}

async function storedApplication(id: string): Promise<StoredApplication | undefined> {
  const rows = await queryRows<StoredApplication>(
    "select status::text as status, responses, completion_percent, launched_at from public.applications where id = $1",
    [id],
  );
  return rows[0];
}

describe("createApplication action", () => {
  it("creates one draft whose type matches the account role", async () => {
    const hacker = await signUpTestUser({ label: "create", role: "hacker" });
    actAs(hacker);

    const created = expectOk(await createApplication());

    expect(created).toMatchObject({
      type: "hacker",
      status: "draft",
      completionPercent: 0,
      isEditable: true,
      launchedAt: null,
      reviewStartedAt: null,
      decisionReleasedAt: null,
      responses: {},
    });
    expect(created.applicantReference).toMatch(/^H-\d+$/);
    expect(created.completion).toMatchObject({ percent: 0, isSubmittable: false });
    expect(created.mission).toMatchObject({ stage: "assembly", isSubmitted: false });

    expect(expectOk(await createApplication("hacker")).id).toBe(created.id);
    expectFailure(await createApplication("judge"), "application_type_mismatch");
    expectFailure(await createApplication("organizer" as unknown as "hacker"), "validation_failed");
    expect((await getMyApplication())?.id).toBe(created.id);

    const rows = await queryRows<{ count: number }>(
      "select count(*)::int as count from public.applications where user_id = $1",
      [hacker.userId],
    );
    expect(rows[0].count).toBe(1);
  });

  it("requires a signed-in Hacker or Judge", async () => {
    actAs(createTestClient());
    expectFailure(await createApplication(), "unauthenticated");
    expectFailure(await saveApplication(randomUUID(), {}), "unauthenticated");
    expectFailure(await submitApplication(randomUUID()), "unauthenticated");
    await expect(getMyApplication()).rejects.toMatchObject(redirectError());

    const organizer = await createOrganizer("create-organizer");
    actAs(organizer);
    expectFailure(await createApplication(), "forbidden");
    expectFailure(await saveApplication(randomUUID(), {}), "forbidden");
    expectFailure(await submitApplication(randomUUID()), "forbidden");
    await expect(getMyApplication()).rejects.toMatchObject(redirectError());
  });
});

// Completion gate 2: an applicant can save and submit only their own application.
describe("saveApplication action", () => {
  it("merges partial drafts and computes completion on the server", async () => {
    const judge = await signUpTestUser({ label: "draft", role: "judge" });
    actAs(judge);
    const { id } = expectOk(await createApplication());

    const first = expectOk(
      await saveApplication(id, {
        preferredName: "  Draft Judge  ",
        yearsExperience: 4,
        expertiseAreas: ["web"],
        // Not part of the draft contract; ignored rather than trusted.
        completion_percent: 100,
        status: "submitted",
      }),
    );

    expect(first.responses).toEqual({ preferredName: "Draft Judge", yearsExperience: 4, expertiseAreas: ["web"] });
    expect(first).toMatchObject({ status: "draft", isEditable: true, launchedAt: null });
    expect(first.completionPercent).toBe(first.completion.percent);
    expect(first.completionPercent).toBeGreaterThan(0);
    expect(first.completionPercent).toBeLessThan(100);

    const second = expectOk(await saveApplication(id, { location: "Remote", preferredName: null, bio: "   " }));
    const expectedResponses = { location: "Remote", yearsExperience: 4, expertiseAreas: ["web"] };
    expect(second.responses).toEqual(expectedResponses);

    const stored = await storedApplication(id);
    expect(stored).toMatchObject({
      status: "draft",
      completion_percent: second.completionPercent,
      launched_at: null,
      responses: expectedResponses,
    });
  });

  it("returns field errors for invalid values without saving them", async () => {
    const hacker = await signUpTestUser({ label: "invalid-draft", role: "hacker" });
    actAs(hacker);
    const { id } = expectOk(await createApplication());

    const error = expectFailure(
      await saveApplication(id, {
        graduationYear: 1900,
        skills: ["web", "not-a-skill"],
        links: "https://example.com",
        unknownField: "ignored",
      }),
      "validation_failed",
    );

    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual(["graduationYear", "links", "skills"]);
    expectFailure(await saveApplication(id, "not an object"), "validation_failed");
    expect((await storedApplication(id))?.responses).toEqual({});
  });

  it("does not let one applicant read or change another applicant's application", async () => {
    const owner = await signUpTestUser({ label: "owner", role: "hacker" });
    const intruder = await signUpTestUser({ label: "intruder", role: "judge" });
    actAs(owner);
    const { id } = expectOk(await createApplication());
    expectOk(await saveApplication(id, { preferredName: "Owner" }));

    actAs(intruder);
    expectFailure(await saveApplication(id, { preferredName: "Intruder" }), "not_found");
    expectFailure(await submitApplication(id), "not_found");

    const read = await intruder.client.from("applications").select("id").eq("id", id);
    expect(read.data).toEqual([]);
    const write = await intruder.client
      .from("applications")
      .update({ responses: { preferredName: "Intruder" } })
      .eq("id", id)
      .select("id");
    expect(write.data).toEqual([]);

    expect(await storedApplication(id)).toMatchObject({ status: "draft", responses: { preferredName: "Owner" } });
  });

  it("keeps every answer when saves overlap", async () => {
    const hacker = await signUpTestUser({ label: "overlap", role: "hacker" });
    actAs(hacker);
    const { id } = expectOk(await createApplication());

    const results = await Promise.all([
      saveApplication(id, { preferredName: "Overlap" }),
      saveApplication(id, { location: "Remote" }),
      saveApplication(id, { major: "Mathematics" }),
    ]);
    for (const result of results) {
      expectOk(result);
    }

    expect((await storedApplication(id))?.responses).toEqual({
      preferredName: "Overlap",
      location: "Remote",
      major: "Mathematics",
    });
  });
});

// Completion gate 3: submitted applications are locked from applicant edits.
describe("submitApplication action", () => {
  it("refuses incomplete applications and lists what is missing", async () => {
    const hacker = await signUpTestUser({ label: "incomplete", role: "hacker" });
    actAs(hacker);
    const { id } = expectOk(await createApplication());
    expectOk(await saveApplication(id, { preferredName: "Partial" }));

    const error = expectFailure(await submitApplication(id), "application_incomplete");

    expect(error.fieldErrors).toHaveProperty("bio");
    expect(error.fieldErrors).toHaveProperty("codeOfConductAccepted");
    expect(error.fieldErrors).not.toHaveProperty("preferredName");
    expect((await storedApplication(id))?.status).toBe("draft");
  });

  it.each([
    ["hacker", validHackerResponses],
    ["judge", validJudgeResponses],
  ] as const)("submits a complete %s application and locks it", async (role, responses) => {
    const applicant = await signUpTestUser({ label: `submit-${role}`, role });
    actAs(applicant);
    const { id } = expectOk(await createApplication());
    expectOk(await saveApplication(id, responses));

    const submitted = expectOk(await submitApplication(id));

    expect(submitted).toMatchObject({
      type: role,
      status: "submitted",
      completionPercent: 100,
      isEditable: false,
      reviewStartedAt: null,
      decisionReleasedAt: null,
    });
    expect(submitted.launchedAt).not.toBeNull();
    expect(submitted.mission).toMatchObject({ stage: "cruise", isSubmitted: true, decision: null });

    expectFailure(await saveApplication(id, { bio: "Edited after launch" }), "application_locked");
    expectFailure(await submitApplication(id), "application_locked");
    expect((await getMyApplication())?.responses).toMatchObject({ bio: responses.bio });
  });

  it("keeps submitted applications locked against direct Data API writes", async () => {
    const judge = await signUpTestUser({ label: "locked", role: "judge" });
    actAs(judge);
    const { id } = expectOk(await createApplication());
    expectOk(await saveApplication(id, validJudgeResponses));
    expectOk(await submitApplication(id));

    // Rows outside the UPDATE policy are skipped: zero rows change and no error is raised.
    const edit = await judge.client
      .from("applications")
      .update({ responses: { ...validJudgeResponses, bio: "Tampered" } })
      .eq("id", id)
      .select("id");
    expect(edit).toMatchObject({ error: null, data: [] });

    const unsubmit = await judge.client.from("applications").update({ status: "draft" }).eq("id", id).select("id");
    expect(unsubmit).toMatchObject({ error: null, data: [] });

    // Columns without a client grant are rejected outright.
    const timestamps = await judge.client.from("applications").update({ launched_at: null }).eq("id", id);
    expect(timestamps.error?.code).toBe("42501");

    const remove = await judge.client.from("applications").delete().eq("id", id);
    expect(remove.error?.code).toBe("42501");

    const stored = await storedApplication(id);
    expect(stored).toMatchObject({ status: "submitted", responses: { bio: validJudgeResponses.bio } });
    expect(stored?.launched_at).not.toBeNull();
  });

  it("blocks direct Data API shortcuts on drafts", async () => {
    const hacker = await signUpTestUser({ label: "shortcut", role: "hacker" });

    const insertSubmitted = await hacker.client
      .from("applications")
      .insert({ user_id: hacker.userId, application_type: "hacker", status: "submitted" });
    expect(insertSubmitted.error?.code).toBe("42501");

    const wrongType = await hacker.client
      .from("applications")
      .insert({ user_id: hacker.userId, application_type: "judge" });
    expect(wrongType.error).not.toBeNull();

    actAs(hacker);
    const { id } = expectOk(await createApplication());

    // Submitting incomplete answers directly fails the database completeness constraint.
    const incomplete = await hacker.client.from("applications").update({ status: "submitted" }).eq("id", id).select("id");
    expect(incomplete.error?.code).toBe("23514");

    // Answers the Server Actions would reject cannot be stored directly either.
    const junkDraft = await hacker.client
      .from("applications")
      .update({ responses: { skills: ["web", "not-a-skill"], graduationYear: 1900, injectedKey: "x" } })
      .eq("id", id)
      .select("id");
    expect(junkDraft.error?.code).toBe("23514");

    // A draft may hold blank or unfinished answers, but submitting them is refused.
    const unfinished = await hacker.client
      .from("applications")
      .update({ responses: { ...validHackerResponses, bio: "\t", links: ["javascript:alert(1)"] } })
      .eq("id", id)
      .select("id");
    expect(unfinished.error).toBeNull();
    const invalidSubmit = await hacker.client
      .from("applications")
      .update({ status: "submitted" })
      .eq("id", id)
      .select("id");
    expect(invalidSubmit.error?.code).toBe("23514");

    // One Judge cannot inflate Expertise Radar coverage with unknown or excess areas.
    const judge = await signUpTestUser({ label: "radar", role: "judge" });
    const radar = await judge.client.from("applications").insert({
      user_id: judge.userId,
      application_type: "judge",
      responses: { ...validJudgeResponses, expertiseAreas: ["web", "fake_area"] },
    });
    expect(radar.error?.code).toBe("23514");

    // Applicants cannot move their own application into review or a decision.
    for (const status of ["in_review", "accepted", "waitlisted"] as const) {
      const jump = await hacker.client.from("applications").update({ status }).eq("id", id).select("id");
      expect(jump.error?.code, status).toBe("42501");
    }

    expect(await storedApplication(id)).toMatchObject({ status: "draft", launched_at: null });
  });
});
