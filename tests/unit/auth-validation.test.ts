import { describe, expect, it } from "vitest";

import { profileUpdateSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";

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
