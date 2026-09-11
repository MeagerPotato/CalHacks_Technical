import { describe, expect, it } from "vitest";

import { signIn, signOut, signUp, updateProfile } from "@/app/actions/auth";
import { loadViewer } from "@/lib/auth/dal";

import {
  actAs,
  callUntypedRpc,
  createApplicationAs,
  createOrganizer,
  createTestClient,
  expectFailure,
  expectOk,
  newPassword,
  queryRows,
  signUpTestUser,
  testEmail,
} from "./helpers";

async function authUserCount(email: string): Promise<number> {
  const rows = await queryRows<{ count: number }>("select count(*)::int as count from auth.users where email = $1", [
    email,
  ]);
  return rows[0].count;
}

async function profileRole(userId: string): Promise<string | undefined> {
  const rows = await queryRows<{ account_role: string }>(
    "select account_role::text as account_role from public.profiles where id = $1",
    [userId],
  );
  return rows[0]?.account_role;
}

async function profileApplicationTypes(userId: string): Promise<string[] | undefined> {
  const rows = await queryRows<{ application_types: string[] }>(
    "select application_types::text[] as application_types from public.profiles where id = $1",
    [userId],
  );
  return rows[0]?.application_types;
}

// Completion gate 1: public signup can create only Hacker or Judge accounts.
describe("signUp action", () => {
  it.each([
    [["hacker"], ["hacker"], "hacker"],
    [["judge"], ["judge"], "judge"],
    [["judge", "hacker"], ["hacker", "judge"], "hacker"],
  ] as const)("creates an account applying for %j", async (requested, applicationTypes, accountRole) => {
    actAs(createTestClient());
    const email = testEmail("signup");

    const data = expectOk(
      await signUp({ email, password: newPassword(), applicationTypes: requested, displayName: "Signup Test" }),
    );

    expect(data).toMatchObject({ requiresEmailConfirmation: false, redirectTo: "/onboarding" });
    expect(data.viewer).toMatchObject({
      email,
      accountRole,
      applicationTypes,
      displayName: "Signup Test",
      isOrganizer: false,
    });
    expect(await profileRole(data.viewer?.userId ?? "")).toBe(accountRole);
    expect(await profileApplicationTypes(data.viewer?.userId ?? "")).toEqual(applicationTypes);
  });

  it("accepts FormData from a form submission, including both checkboxes", async () => {
    actAs(createTestClient());
    const email = testEmail("signup-form");
    const formData = new FormData();
    formData.set("email", `  ${email.toUpperCase()}  `);
    formData.set("password", newPassword());
    formData.append("applicationTypes", "judge");
    formData.append("applicationTypes", "hacker");
    formData.set("displayName", "");

    const data = expectOk(await signUp(formData));

    expect(data.viewer).toMatchObject({ email, accountRole: "hacker", applicationTypes: ["hacker", "judge"] });
  });

  it("refuses Organizer, unknown, duplicate, and empty choices before contacting Supabase Auth", async () => {
    for (const applicationTypes of [["organizer"], ["Organizer"], ["admin"], ["hacker", "organizer"], ["judge", "judge"], [], ""]) {
      actAs(createTestClient());
      const email = testEmail("signup-denied");

      const error = expectFailure(await signUp({ email, password: newPassword(), applicationTypes }), "validation_failed");

      expect(error.fieldErrors, JSON.stringify(applicationTypes)).toHaveProperty("applicationTypes");
      expect(await authUserCount(email)).toBe(0);
    }
  });

  it("reports field errors and duplicate emails", async () => {
    actAs(createTestClient());
    const invalid = expectFailure(
      await signUp({ email: "not-an-email", password: "short", applicationTypes: ["hacker"] }),
      "validation_failed",
    );
    expect(Object.keys(invalid.fieldErrors ?? {}).sort()).toEqual(["email", "password"]);

    const existing = await signUpTestUser({ label: "duplicate", role: "hacker" });
    actAs(createTestClient());
    expectFailure(
      await signUp({ email: existing.email, password: newPassword(), applicationTypes: ["judge"] }),
      "email_taken",
    );
    expect(await profileRole(existing.userId)).toBe("hacker");
  });
});

describe("database role enforcement for direct Supabase Auth calls", () => {
  it.each(["organizer", " Organizer ", "ORGANIZER", "admin"])(
    "rejects account_role %j and creates no user",
    async (accountRole) => {
      const client = createTestClient();
      const email = testEmail("direct-denied");

      const { data, error } = await client.auth.signUp({
        email,
        password: newPassword(),
        options: { data: { account_role: accountRole } },
      });

      expect(error).not.toBeNull();
      expect(data.session).toBeNull();
      expect(await authUserCount(email)).toBe(0);
    },
  );

  it.each([
    ["organizer", { application_types: ["organizer"] }],
    ["organizer beside a real type", { application_types: ["hacker", "organizer"] }],
    ["a duplicate", { application_types: ["judge", "judge"] }],
    ["an empty list", { application_types: [] }],
    ["more than two entries", { application_types: ["hacker", "judge", "hacker"] }],
    ["a string instead of a list", { application_types: "hacker" }],
    ["the wrong casing", { application_types: ["Hacker"] }],
    ["a number", { application_types: [1] }],
    ["an organizer account_role beside valid types", { application_types: ["hacker"], account_role: "organizer" }],
  ])("rejects %s in signup metadata and creates no user", async (_case, data) => {
    const client = createTestClient();
    const email = testEmail("direct-types-denied");

    const result = await client.auth.signUp({ email, password: newPassword(), options: { data } });

    expect(result.error).not.toBeNull();
    expect(result.data.session).toBeNull();
    expect(await authUserCount(email)).toBe(0);
  });

  it("stores requested application types in form order, with the first as the account role", async () => {
    const user = await signUpTestUser({ label: "direct-both", types: ["judge", "hacker"] });

    expect(await profileRole(user.userId)).toBe("hacker");
    expect(await profileApplicationTypes(user.userId)).toEqual(["hacker", "judge"]);
    expect(await loadViewer(user.client)).toMatchObject({ accountRole: "hacker", applicationTypes: ["hacker", "judge"] });
  });

  it("gives a legacy single-role signup that one application type, and a missing role Hacker", async () => {
    const judge = await signUpTestUser({ label: "direct-legacy", role: "judge" });
    expect(await profileApplicationTypes(judge.userId)).toEqual(["judge"]);

    const user = await signUpTestUser({ label: "direct-default" });
    expect(await profileRole(user.userId)).toBe("hacker");
    expect(await profileApplicationTypes(user.userId)).toEqual(["hacker"]);
  });

  it("ignores role and application type changes written to user metadata", async () => {
    const user = await signUpTestUser({ label: "metadata", role: "judge" });

    const { error } = await user.client.auth.updateUser({
      data: { account_role: "organizer", application_types: ["hacker", "judge"] },
    });

    expect(error).toBeNull();
    expect(await loadViewer(user.client)).toMatchObject({ accountRole: "judge", applicationTypes: ["judge"] });
    expect(await profileRole(user.userId)).toBe("judge");
  });

  it("clears application types when an account is promoted to Organizer", async () => {
    const organizer = await createOrganizer("promoted-types");

    expect(await profileRole(organizer.userId)).toBe("organizer");
    expect(await profileApplicationTypes(organizer.userId)).toEqual([]);
    expect(await loadViewer(organizer.client)).toMatchObject({ accountRole: "organizer", applicationTypes: [] });
  });

  it("keeps every owned application when an admin changes application types", async () => {
    const user = await signUpTestUser({ label: "admin-types", types: ["hacker", "judge"] });
    await createApplicationAs(user, "judge", {}, { submit: false });

    await expect(
      queryRows("update public.profiles set account_role = 'hacker', application_types = '{hacker}' where id = $1", [
        user.userId,
      ]),
    ).rejects.toMatchObject({ hint: "role_application_mismatch" });
    // account_role must lead application_types.
    await expect(
      queryRows("update public.profiles set application_types = '{judge}' where id = $1", [user.userId]),
    ).rejects.toMatchObject({ code: "23514" });

    await queryRows("update public.profiles set account_role = 'judge', application_types = '{judge}' where id = $1", [
      user.userId,
    ]);
    expect(await profileApplicationTypes(user.userId)).toEqual(["judge"]);
  });

  it("does not let users write their own role, application types, email, or profile row", async () => {
    const user = await signUpTestUser({ label: "self-promote", role: "hacker" });

    const role = await user.client.from("profiles").update({ account_role: "organizer" }).eq("id", user.userId);
    expect(role.error?.code).toBe("42501");

    const types = await user.client
      .from("profiles")
      .update({ application_types: ["hacker", "judge"] })
      .eq("id", user.userId);
    expect(types.error?.code).toBe("42501");

    const email = await user.client
      .from("profiles")
      .update({ email: testEmail("someone-else") })
      .eq("id", user.userId);
    expect(email.error?.code).toBe("42501");

    const insert = await user.client
      .from("profiles")
      .insert({ id: user.userId, email: user.email, account_role: "organizer" });
    expect(insert.error?.code).toBe("42501");

    const promote = await callUntypedRpc(user.client, "promote_to_organizer", { p_email: user.email });
    expect(promote.error).not.toBeNull();

    expect(await profileRole(user.userId)).toBe("hacker");
    expect(await profileApplicationTypes(user.userId)).toEqual(["hacker"]);
  });
});

describe("signIn and signOut actions", () => {
  it("signs in and sends the user to their role home", async () => {
    const user = await signUpTestUser({ label: "signin", role: "judge" });
    actAs(createTestClient());

    const data = expectOk(await signIn({ email: user.email, password: user.password }));

    expect(data).toMatchObject({ redirectTo: "/portal", viewer: { userId: user.userId, accountRole: "judge" } });
  });

  it("honors only safe next paths that fit the role", async () => {
    const applicant = await signUpTestUser({ label: "next-applicant", role: "hacker" });
    const cases: Array<[string, string]> = [
      ["/portal/mission", "/portal/mission"],
      ["/organizer/applications", "/portal"],
      ["https://evil.example/phish", "/portal"],
      ["//evil.example", "/portal"],
      ["/\\evil.example", "/portal"],
    ];
    for (const [next, expected] of cases) {
      actAs(createTestClient());
      const data = expectOk(await signIn({ email: applicant.email, password: applicant.password, next }));
      expect(data.redirectTo, next).toBe(expected);
    }

    const organizer = await createOrganizer("next-organizer");
    actAs(createTestClient());
    expect(
      expectOk(await signIn({ email: organizer.email, password: organizer.password, next: "/portal/application" }))
        .redirectTo,
    ).toBe("/organizer");
    actAs(createTestClient());
    expect(
      expectOk(
        await signIn({
          email: organizer.email,
          password: organizer.password,
          next: "/organizer/applications?status=submitted",
        }),
      ).redirectTo,
    ).toBe("/organizer/applications?status=submitted");
  });

  it("rejects a wrong password", async () => {
    const user = await signUpTestUser({ label: "wrong-password", role: "hacker" });
    actAs(createTestClient());
    expectFailure(await signIn({ email: user.email, password: newPassword() }), "invalid_credentials");
  });

  it("signs out the current session", async () => {
    const user = await signUpTestUser({ label: "signout", role: "hacker" });
    actAs(user);

    expect(expectOk(await signOut()).redirectTo).toBe("/login");

    expect(await loadViewer(user.client)).toBeNull();
    expectFailure(await updateProfile({ displayName: "After sign out" }), "unauthenticated");
  });
});

describe("updateProfile action", () => {
  it("updates only the display name and validates it", async () => {
    const user = await signUpTestUser({ label: "profile", role: "judge" });
    actAs(user);

    const data = expectOk(await updateProfile({ displayName: "  Renamed Judge  " }));

    expect(data.viewer).toMatchObject({ displayName: "Renamed Judge", accountRole: "judge" });
    expectFailure(await updateProfile({ displayName: "   " }), "validation_failed");
    expectFailure(await updateProfile({ displayName: "x".repeat(81) }), "validation_failed");
  });
});
