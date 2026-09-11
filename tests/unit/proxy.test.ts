import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/proxy";

interface CookieToSet {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

interface CookieMethods {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieToSet[], headers: Record<string, string>): void;
}

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

const ORIGIN = "http://localhost:3000";
const AUTH_COOKIE = "sb-127-auth-token";
// The headers @supabase/ssr passes to setAll whenever it writes session cookies.
const SSR_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};
const clearedCookie: CookieToSet = { name: AUTH_COOKIE, value: "", options: { path: "/", maxAge: 0 } };
const refreshedCookie: CookieToSet = { name: AUTH_COOKIE, value: "base64-refreshed", options: { path: "/", maxAge: 400 } };

/**
 * Simulates `supabase.auth.getClaims()`. With `writesCookie`, the client first writes that cookie
 * through setAll, the way @supabase/ssr refreshes a session or clears a stale one.
 */
function mockSession(options: { signedIn: boolean; writesCookie?: CookieToSet }): void {
  createServerClient.mockImplementation((_url: string, _key: string, config: { cookies: CookieMethods }) => ({
    auth: {
      getClaims: async () => {
        if (options.writesCookie) {
          config.cookies.setAll([options.writesCookie], SSR_CACHE_HEADERS);
        }
        return { data: options.signedIn ? { claims: { sub: "user-1" } } : null, error: null };
      },
    },
  }));
}

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, init);
}

function expectNoStore(response: NextResponse): void {
  expect(response.headers.get("cache-control")).toBe(SSR_CACHE_HEADERS["Cache-Control"]);
  expect(response.headers.get("expires")).toBe("0");
  expect(response.headers.get("pragma")).toBe("no-cache");
}

function expectPassThrough(response: NextResponse): void {
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_unit_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    createServerClient.mockReset();
  });

  // A visitor with no session cookie makes @supabase/ssr write nothing, so no-store cannot depend on it.
  it("redirects a signed-out GET to /login with the path and query and no-store", async () => {
    mockSession({ signedIn: false });

    const response = await updateSession(request("/portal?x=1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fportal%3Fx%3D1`);
    expectNoStore(response);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears a stale session cookie on the signed-out redirect", async () => {
    mockSession({ signedIn: false, writesCookie: clearedCookie });

    const response = await updateSession(request("/portal?x=1", { headers: { cookie: `${AUTH_COOKIE}=forged` } }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fportal%3Fx%3D1`);
    expectNoStore(response);
    expect(response.cookies.get(AUTH_COOKIE)?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it.each(["/onboarding", "/portal/application?section=education", "/organizer/applications?status=submitted&page=2"])(
    "redirects a signed-out GET to %s and keeps it as next",
    async (path) => {
      mockSession({ signedIn: false });

      const response = await updateSession(request(path));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location") ?? "");
      expect(`${location.origin}${location.pathname}`).toBe(`${ORIGIN}/login`);
      expect([...location.searchParams]).toEqual([["next", path]]);
      expectNoStore(response);
    },
  );

  it("redirects a signed-out HEAD request with no-store", async () => {
    mockSession({ signedIn: false });

    const response = await updateSession(request("/portal", { method: "HEAD" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fportal`);
    expectNoStore(response);
  });

  it("lets a signed-out Server Action POST through while still copying cookies and no-store", async () => {
    mockSession({ signedIn: false, writesCookie: clearedCookie });

    const response = await updateSession(
      request("/portal/application?section=about", { method: "POST", headers: { "next-action": "abc123" } }),
    );

    expectPassThrough(response);
    expectNoStore(response);
    expect(response.cookies.get(AUTH_COOKIE)?.value).toBe("");
  });

  it.each(["PUT", "PATCH", "DELETE", "OPTIONS"])("never redirects a signed-out %s request", async (method) => {
    mockSession({ signedIn: false });

    expectPassThrough(await updateSession(request("/portal", { method })));
  });

  it("lets a signed-in request through with its refreshed session cookie", async () => {
    mockSession({ signedIn: true, writesCookie: refreshedCookie });

    const response = await updateSession(request("/portal"));

    expectPassThrough(response);
    expectNoStore(response);
    expect(response.cookies.get(AUTH_COOKIE)?.value).toBe("base64-refreshed");
  });

  it.each(["/", "/login?next=%2Fportal", "/signup", "/auth/callback?code=abc"])(
    "does not redirect the public path %s",
    async (path) => {
      mockSession({ signedIn: false });

      const response = await updateSession(request(path));

      expectPassThrough(response);
      // Pass-through responses keep Phase 1 behavior: cache headers come only from @supabase/ssr cookie writes.
      expect(response.headers.get("cache-control")).toBeNull();
    },
  );

  it("passes requests through without a Supabase client when the public env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expectPassThrough(await updateSession(request("/portal")));
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
