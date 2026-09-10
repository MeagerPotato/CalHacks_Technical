import { describe, expect, it } from "vitest";

import { signIn, signOut, signUp, updateProfile } from "@/app/actions/auth";
import { loadViewer } from "@/lib/auth/dal";

import {
  actAs,
  callUntypedRpc,
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

// Completion gate 1: public signup can create only Hacker or Judge accounts.
describe("signUp action", () => {
  it.each(["hacker", "judge"] as const)("creates a %s account and profile", async (accountRole) => {
    actAs(createTestClient());
    const email = testEmail(`signup-${accountRole}`);

    const data = expectOk(await signUp({ email, password: newPassword(), accountRole, displayName: "Signup Test" }));

    expect(data).toMatchObject({ requiresEmailConfirmation: false, redirectTo: "/onboarding" });
    expect(data.viewer).toMatchObject({ email, accountRole, displayName: "Signup Test", isOrganizer: false });
    expect(await profileRole(data.viewer?.userId ?? "")).toBe(accountRole);
  });

  it("accepts FormData from a form submission", async () => {
    actAs(createTestClient());
    const email = testEmail("signup-form");
    const formData = new FormData();
    formData.set("email", `  ${email.toUpperCase()}  `);
    formData.set("password", newPassword());
    formData.set("accountRole", "judge");
    formData.set("displayName", "");

    const data = expectOk(await signUp(formData));

    expect(data.viewer).toMatchObject({ email, accountRole: "judge" });
  });

  it("refuses Organizer and unknown roles before contacting Supabase Auth", async () => {
    for (const accountRole of ["organizer", "Organizer", "admin", ""]) {
      actAs(createTestClient());
      const email = testEmail("signup-denied");

      const error = expectFailure(
        await signUp({ email, password: newPassword(), accountRole: accountRole as unknown as "hacker" }),
        "validation_failed",
      );

      expect(error.fieldErrors).toHaveProperty("accountRole");
      expect(await authUserCount(email)).toBe(0);
    }
  });

  it("reports field errors and duplicate emails", async () => {
    actAs(createTestClient());
    const invalid = expectFailure(
      await signUp({ email: "not-an-email", password: "short", accountRole: "hacker" }),
      "validation_failed",
    );
    expect(Object.keys(invalid.fieldErrors ?? {}).sort()).toEqual(["email", "password"]);

    const existing = await signUpTestUser({ label: "duplicate", role: "hacker" });
    actAs(createTestClient());
    expectFailure(await signUp({ email: existing.email, password: newPassword(), accountRole: "judge" }), "email_taken");
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

  it("defaults a missing role to Hacker", async () => {
    const user = await signUpTestUser({ label: "direct-default" });
    expect(await profileRole(user.userId)).toBe("hacker");
  });

  it("ignores role changes written to user metadata", async () => {
    const user = await signUpTestUser({ label: "metadata", role: "judge" });

    const { error } = await user.client.auth.updateUser({ data: { account_role: "organizer" } });

    expect(error).toBeNull();
    expect((await loadViewer(user.client))?.accountRole).toBe("judge");
    expect(await profileRole(user.userId)).toBe("judge");
  });

  it("does not let users write their own role, email, or profile row", async () => {
    const user = await signUpTestUser({ label: "self-promote", role: "hacker" });

    const role = await user.client.from("profiles").update({ account_role: "organizer" }).eq("id", user.userId);
    expect(role.error?.code).toBe("42501");

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
