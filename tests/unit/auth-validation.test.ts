import { describe, expect, it } from "vitest";

import { profileUpdateSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";
import { toPlainInput } from "@/lib/validation/form-data";

const validSignUp = {
  email: "  New.Applicant@Example.com ",
  password: "correct-horse-battery",
  applicationTypes: ["hacker"],
};

describe("signUpSchema", () => {
  it("accepts Hacker, Judge, or both, in form order, and normalizes the email", () => {
    expect(signUpSchema.parse(validSignUp)).toMatchObject({
      email: "new.applicant@example.com",
      applicationTypes: ["hacker"],
    });
    expect(signUpSchema.parse({ ...validSignUp, applicationTypes: ["judge"] }).applicationTypes).toEqual(["judge"]);
    expect(signUpSchema.parse({ ...validSignUp, applicationTypes: ["judge", "hacker"] }).applicationTypes).toEqual([
      "hacker",
      "judge",
    ]);
  });

  it("reads one checked checkbox, which FormData sends as a plain string", () => {
    expect(signUpSchema.parse({ ...validSignUp, applicationTypes: "judge" }).applicationTypes).toEqual(["judge"]);
  });

  it.each([
    ["organizer", ["organizer"]],
    ["organizer beside a real type", ["hacker", "organizer"]],
    ["organizer as a string", "organizer"],
    ["an unknown type", ["admin"]],
    ["the wrong casing", ["Hacker"]],
    ["a duplicate", ["hacker", "hacker"]],
    ["more than two", ["hacker", "judge", "hacker"]],
    ["no choice", []],
    ["a blank string", ""],
    ["a missing value", undefined],
    ["null", null],
    ["an object", { hacker: true }],
    ["a number", [1]],
  ])("rejects %s, reporting it on applicationTypes", (_case, applicationTypes) => {
    const result = signUpSchema.safeParse({ ...validSignUp, applicationTypes });
    expect(result.success).toBe(false);
    expect(Object.keys(toFieldErrors(result.error!))).toEqual(["applicationTypes"]);
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
    formData.append("applicationTypes", "judge");
    formData.append("applicationTypes", "hacker");

    const signIn = signInSchema.parse(toPlainInput(formData));
    const signUp = signUpSchema.parse(toPlainInput(formData));

    expect(signIn).toEqual({ email: "maya@example.com", password: "correct-horse-battery" });
    expect(signUp).toEqual({
      email: "maya@example.com",
      password: "correct-horse-battery",
      applicationTypes: ["hacker", "judge"],
    });
    for (const output of [signIn, signUp]) {
      expect(Object.keys(output).filter((key) => key.startsWith("$ACTION"))).toEqual([]);
    }
  });
});
