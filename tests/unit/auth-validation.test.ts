import { describe, expect, it } from "vitest";

import { profileUpdateSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { toPlainInput } from "@/lib/validation/form-data";

const validSignUp = {
  email: "  New.Applicant@Example.com ",
  password: "correct-horse-battery",
  accountRole: "hacker",
};

describe("signUpSchema", () => {
  it("accepts hacker and judge and normalizes the email", () => {
    const hacker = signUpSchema.parse(validSignUp);
    expect(hacker).toMatchObject({ email: "new.applicant@example.com", accountRole: "hacker" });
    expect(signUpSchema.parse({ ...validSignUp, accountRole: "judge" }).accountRole).toBe("judge");
  });

  it("never accepts organizer or any other role", () => {
    for (const accountRole of ["organizer", "admin", "Organizer", "", undefined, null]) {
      expect(signUpSchema.safeParse({ ...validSignUp, accountRole }).success).toBe(false);
    }
  });

  it("enforces password length", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...validSignUp, password: "x".repeat(73) }).success).toBe(false);
  });

  it("rejects invalid emails", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, email: "not-an-email" }).success).toBe(false);
  });

  it("treats a blank display name as absent", () => {
    expect(signUpSchema.parse({ ...validSignUp, displayName: "   " }).displayName).toBeUndefined();
    expect(signUpSchema.parse({ ...validSignUp, displayName: " Maya " }).displayName).toBe("Maya");
  });
});

describe("signInSchema", () => {
  it("requires email and password", () => {
    expect(signInSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@example.com", password: "anything" }).success).toBe(true);
  });
});

describe("profileUpdateSchema", () => {
  it("requires a non-blank display name within the limit", () => {
    expect(profileUpdateSchema.safeParse({ displayName: "  " }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ displayName: "x".repeat(81) }).success).toBe(false);
    expect(profileUpdateSchema.parse({ displayName: " Maya " }).displayName).toBe("Maya");
  });
});

describe("auth FormData input", () => {
  it("parses a progressively enhanced form and drops React's $ACTION_ fields", () => {
    const formData = new FormData();
    formData.append("$ACTION_ID_abc", "");
    formData.append("$ACTION_REF_1", "");
    formData.append("email", "  Maya@Example.com ");
    formData.append("password", "correct-horse-battery");
    formData.append("accountRole", "judge");

    const signIn = signInSchema.parse(toPlainInput(formData));
    const signUp = signUpSchema.parse(toPlainInput(formData));

    expect(signIn).toEqual({ email: "maya@example.com", password: "correct-horse-battery" });
    expect(signUp).toEqual({ email: "maya@example.com", password: "correct-horse-battery", accountRole: "judge" });
    for (const output of [signIn, signUp]) {
      expect(Object.keys(output).filter((key) => key.startsWith("$ACTION"))).toEqual([]);
    }
  });
});
