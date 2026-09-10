import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { failFromAuth, failFromDatabase } from "@/lib/actions/errors";
import { fail, ok } from "@/lib/actions/result";

describe("action results", () => {
  it("builds success and failure shapes", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
    expect(fail("forbidden")).toEqual({
      ok: false,
      error: { code: "forbidden", message: "You do not have permission to do that." },
    });
    expect(fail("validation_failed", { fieldErrors: {} }).error).not.toHaveProperty("fieldErrors");
  });
});

describe("error mapping", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers database guard hints", () => {
    expect(
      failFromDatabase("test", { code: "42501", message: "Submitted applications can no longer be edited", hint: "application_locked" })
        .error.code,
    ).toBe("application_locked");
    expect(
      failFromDatabase("test", { code: "23514", message: "Complete the review", hint: "review_not_completed" }).error
        .code,
    ).toBe("review_not_completed");
  });

  it("maps Postgres and PostgREST codes without leaking messages", () => {
    const rls = failFromDatabase("test", {
      code: "42501",
      message: 'new row violates row-level security policy for table "applications"',
    });
    expect(rls.error).toEqual({ code: "forbidden", message: "You do not have permission to do that." });

    expect(failFromDatabase("test", { code: "23505", message: "duplicate" }).error.code).toBe("conflict");
    expect(failFromDatabase("test", { code: "PGRST116", message: "0 rows" }).error.code).toBe("not_found");
    expect(
      failFromDatabase("test", {
        code: "23514",
        message: 'new row for relation "applications" violates check constraint "applications_submitted_responses_complete"',
      }).error.code,
    ).toBe("application_incomplete");
    expect(failFromDatabase("test", { code: "XX000", message: "internal" }).error.code).toBe("unexpected_error");
  });

  it("maps Supabase Auth error codes", () => {
    expect(failFromAuth("test", { code: "user_already_exists", message: "exists", status: 422 }).error.code).toBe(
      "email_taken",
    );
    expect(failFromAuth("test", { code: "weak_password", message: "weak", status: 422 }).error.code).toBe(
      "weak_password",
    );
    expect(failFromAuth("test", { code: "invalid_credentials", message: "bad", status: 400 }).error.code).toBe(
      "invalid_credentials",
    );
    expect(failFromAuth("test", { message: "slow down", status: 429 }).error.code).toBe("rate_limited");
    expect(failFromAuth("test", { code: "unexpected_failure", message: "db", status: 500 }).error.code).toBe(
      "unexpected_error",
    );
  });
});
