import { AuthApiError, AuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { GET } from "@/app/auth/callback/route";
import { COPY } from "@/content/copy";
import {
  AUTH_CALLBACK_ERROR_CODES,
  isAuthCallbackErrorCode,
  mapAuthCallbackError,
  parseAuthCallbackParams,
} from "@/lib/auth/callback";

const { createClient, exchangeCodeForSession } = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

// In the app, createClient() writes session cookies through next/headers cookies(), and Next.js
// merges them into the returned redirect. Here the whole server client is replaced, so the tests
// check the redirect itself and that the route never adds cookies of its own.
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ORIGIN = "http://localhost:3000";
const NO_STORE = "private, no-cache, no-store, must-revalidate, max-age=0";
const VALID_CODE = "7f0e4a52-5d3b-4f0c-9d8e-2b1f3c4d5e6f";

function exchangeResult(error: unknown) {
  return error
    ? { data: { user: null, session: null, redirectType: null }, error }
    : { data: { user: { id: "user-1" }, session: { expires_in: 3600 }, redirectType: null }, error: null };
}

/**
 * Calls the route, checks the invariants every response shares, and returns the redirect target as
 * "pathname?search".
 */
async function callback(query: string, headers?: Record<string, string>) {
  const response = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`, { headers }));

  expect(response.status).toBe(307);
  expect(response.headers.get("cache-control")).toBe(NO_STORE);
  expect(response.headers.get("expires")).toBe("0");
  expect(response.headers.get("pragma")).toBe("no-cache");

  const location = response.headers.get("location") ?? "";
  // Codes, tokens, and caller-supplied destinations are never forwarded.
  expect(location).not.toMatch(/code=|next|token/i);
  const url = new URL(location);
  expect(url.origin).toBe(ORIGIN);
  expect(url.hash).toBe("");

  return { response, target: `${url.pathname}${url.search}` };
}

describe("GET /auth/callback", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession } });
    exchangeCodeForSession.mockResolvedValue(exchangeResult(null));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    createClient.mockReset();
    exchangeCodeForSession.mockReset();
  });

  it("exchanges the code and lands on onboarding, ignoring next", async () => {
    const { response, target } = await callback(`?code=${VALID_CODE}&next=%2Forganizer`);

    expect(target).toBe("/onboarding");
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith(VALID_CODE);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("accepts a code of 1023 characters", async () => {
    const code = "a".repeat(1023);

    expect((await callback(`?code=${code}`)).target).toBe("/onboarding");
    expect(exchangeCodeForSession).toHaveBeenCalledWith(code);
  });

  it.each([
    ["no parameters", ""],
    ["an empty code", "?code="],
    ["a code of 1024 characters", `?code=${"a".repeat(1024)}`],
    ["a code far over the limit", `?code=${"a".repeat(4096)}`],
    ["only a next parameter", "?next=%2Fportal"],
    ["a token_hash link", "?token_hash=pkce_abc&type=email"],
  ])("sends %s to invalid_link without calling Supabase", async (_label, query) => {
    expect((await callback(query)).target).toBe("/login?error=invalid_link");
    expect(createClient).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    [
      "error_code=otp_expired",
      "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      "link_expired",
    ],
    ["error_code=flow_state_expired alone", "?error_code=flow_state_expired", "link_expired"],
    ["error_code=flow_state_not_found", "?error=invalid_request&error_code=flow_state_not_found", "link_expired"],
    ["an error without error_code", "?error=server_error", "auth_callback_failed"],
    ["an empty error_code", "?error=access_denied&error_code=", "auth_callback_failed"],
    ["an unknown error_code", "?error=access_denied&error_code=something_new", "auth_callback_failed"],
    ["an error next to a code", `?code=${VALID_CODE}&error=access_denied&error_code=otp_expired`, "link_expired"],
  ])("maps a provider redirect with %s without exchanging", async (_label, query, expected) => {
    expect((await callback(query)).target).toBe(`/login?error=${expected}`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    ["otp_expired", "link_expired"],
    ["flow_state_expired", "link_expired"],
    ["flow_state_not_found", "link_expired"],
    ["pkce_code_verifier_not_found", "confirm_link_other_browser"],
    ["bad_code_verifier", "confirm_link_other_browser"],
  ])("maps a returned %s error to %s without logging", async (code, expected) => {
    exchangeCodeForSession.mockResolvedValue(exchangeResult(new AuthApiError("Auth request failed", 400, code)));

    expect((await callback(`?code=${VALID_CODE}`)).target).toBe(`/login?error=${expected}`);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("maps the real missing-verifier error from @supabase/auth-js", async () => {
    exchangeCodeForSession.mockResolvedValue(exchangeResult(new AuthPKCECodeVerifierMissingError()));

    expect((await callback(`?code=${VALID_CODE}`)).target).toBe("/login?error=confirm_link_other_browser");
  });

  it.each([
    ["an unknown code", new AuthApiError("Unexpected failure", 500, "unexpected_failure")],
    ["no code", new AuthApiError("Bad gateway", 502, undefined)],
  ])("logs and maps a returned error with %s to auth_callback_failed", async (_label, error) => {
    exchangeCodeForSession.mockResolvedValue(exchangeResult(error));

    expect((await callback(`?code=${VALID_CODE}`)).target).toBe("/login?error=auth_callback_failed");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("logs and maps a thrown exchange to auth_callback_failed", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("socket hang up"));

    expect((await callback(`?code=${VALID_CODE}`)).target).toBe("/login?error=auth_callback_failed");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("logs and maps a client that cannot be created to auth_callback_failed", async () => {
    createClient.mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"));

    expect((await callback(`?code=${VALID_CODE}`)).target).toBe("/login?error=auth_callback_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("builds the redirect from the request URL, not forwarded host headers", async () => {
    const { target } = await callback(`?code=${VALID_CODE}`, {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    });

    expect(target).toBe("/onboarding");
  });
});

describe("auth callback helpers", () => {
  it("has copy for every error code", () => {
    expect(Object.keys(COPY.auth.callbackErrors).sort()).toEqual([...AUTH_CALLBACK_ERROR_CODES].sort());
    for (const code of AUTH_CALLBACK_ERROR_CODES) {
      expect(COPY.auth.callbackErrors[code].title.length).toBeGreaterThan(0);
      expect(COPY.auth.callbackErrors[code].body.length).toBeGreaterThan(0);
    }
  });

  it("recognizes only the callback error codes", () => {
    for (const code of AUTH_CALLBACK_ERROR_CODES) {
      expect(isAuthCallbackErrorCode(code)).toBe(true);
    }
    for (const value of ["", "LINK_EXPIRED", "otp_expired", "toString", "__proto__", null, undefined, 1, ["invalid_link"]]) {
      expect(isAuthCallbackErrorCode(value)).toBe(false);
    }
  });

  it("parses codes, provider errors, and everything else as invalid", () => {
    const parse = (query: string | Record<string, string>) => parseAuthCallbackParams(new URLSearchParams(query));

    expect(parse("code=abc&next=/portal")).toEqual({ kind: "code", code: "abc" });
    expect(parse({ code: "a".repeat(1023) })).toEqual({ kind: "code", code: "a".repeat(1023) });
    expect(parse("error=access_denied&error_code=otp_expired")).toEqual({ kind: "provider_error", errorCode: "otp_expired" });
    expect(parse("error=server_error")).toEqual({ kind: "provider_error", errorCode: null });
    expect(parse("error_code=")).toEqual({ kind: "provider_error", errorCode: null });
    expect(parse("code=abc&error=access_denied")).toEqual({ kind: "provider_error", errorCode: null });
    expect(parse("")).toEqual({ kind: "invalid" });
    expect(parse("code=")).toEqual({ kind: "invalid" });
    expect(parse({ code: "a".repeat(1024) })).toEqual({ kind: "invalid" });
    expect(parse("token_hash=abc&type=email")).toEqual({ kind: "invalid" });
  });

  it("maps Supabase error codes and treats anything else as a failure", () => {
    expect(mapAuthCallbackError("otp_expired")).toBe("link_expired");
    expect(mapAuthCallbackError("flow_state_expired")).toBe("link_expired");
    expect(mapAuthCallbackError("flow_state_not_found")).toBe("link_expired");
    expect(mapAuthCallbackError("pkce_code_verifier_not_found")).toBe("confirm_link_other_browser");
    expect(mapAuthCallbackError("bad_code_verifier")).toBe("confirm_link_other_browser");
    for (const code of [null, undefined, "", "unexpected_failure", "OTP_EXPIRED", "toString", "__proto__"]) {
      expect(mapAuthCallbackError(code)).toBe("auth_callback_failed");
    }
  });
});
