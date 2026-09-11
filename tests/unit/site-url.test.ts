import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signUp } from "@/app/actions/auth";
import { ACTION_ERROR_MESSAGES } from "@/lib/actions/result";
import { InvalidSiteUrlError, getSiteUrl } from "@/lib/env";

const { authSignUp, createClient } = vi.hoisted(() => ({ authSignUp: vi.fn(), createClient: vi.fn() }));

// signUp runs up to the Supabase call: the server client, viewer loading, and revalidation are replaced.
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/auth/dal", () => ({ loadViewer: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

interface SiteEnv {
  NODE_ENV?: string;
  SITE_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
}

/** Sets exactly the variables getSiteUrl reads. Omitted ones are removed so the shell or CI cannot leak in. */
function stubSiteEnv(env: SiteEnv): void {
  vi.stubEnv("NODE_ENV", env.NODE_ENV ?? "test");
  vi.stubEnv("SITE_URL", env.SITE_URL);
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV);
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", env.VERCEL_PROJECT_PRODUCTION_URL);
  vi.stubEnv("VERCEL_URL", env.VERCEL_URL);
}

function siteUrlError(env: SiteEnv): InvalidSiteUrlError {
  stubSiteEnv(env);
  try {
    getSiteUrl();
  } catch (error) {
    if (error instanceof InvalidSiteUrlError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected getSiteUrl() to throw InvalidSiteUrlError.");
}

const VERCEL_PRODUCTION = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_PRODUCTION_URL: "launchpad.example.com",
  VERCEL_URL: "launchpad-abc123-team.vercel.app",
} satisfies SiteEnv;

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["https://launchpad.example.com", "https://launchpad.example.com"],
    ["https://launchpad.example.com/", "https://launchpad.example.com"],
    ["https://Launchpad.Example.com/apply/?ref=email#top", "https://launchpad.example.com"],
    ["  http://localhost:4000/  ", "http://localhost:4000"],
    ["https://launchpad.example.com:443", "https://launchpad.example.com"],
    ["http://127.0.0.1:3100", "http://127.0.0.1:3100"],
  ])("returns the origin of SITE_URL %j", (value, expected) => {
    stubSiteEnv({ NODE_ENV: "production", SITE_URL: value });
    expect(getSiteUrl()).toBe(expected);
  });

  it("prefers SITE_URL over the Vercel variables", () => {
    stubSiteEnv({ ...VERCEL_PRODUCTION, SITE_URL: "https://apply.example.org" });
    expect(getSiteUrl()).toBe("https://apply.example.org");
  });

  it("ignores a blank SITE_URL", () => {
    stubSiteEnv({ ...VERCEL_PRODUCTION, SITE_URL: "   " });
    expect(getSiteUrl()).toBe("https://launchpad.example.com");
  });

  it.each([
    "secret-host.invalid",
    "not a secret url",
    "//secret-host.invalid",
    "ftp://secret-host.invalid",
    "javascript:alert('secret')",
    "mailto:secret@example.com",
    "secret:3000",
  ])("rejects SITE_URL %j without echoing it", (value) => {
    const error = siteUrlError({ NODE_ENV: "production", SITE_URL: value });

    expect(error.name).toBe("InvalidSiteUrlError");
    expect(error.variable).toBe("SITE_URL");
    expect(error.message).not.toContain("secret");
  });

  it("uses the production hostname on Vercel production", () => {
    stubSiteEnv(VERCEL_PRODUCTION);
    expect(getSiteUrl()).toBe("https://launchpad.example.com");
  });

  it("uses the deployment hostname on Vercel previews", () => {
    stubSiteEnv({ ...VERCEL_PRODUCTION, VERCEL_ENV: "preview", VERCEL_URL: " launchpad-git-feature-team.vercel.app " });
    expect(getSiteUrl()).toBe("https://launchpad-git-feature-team.vercel.app");
  });

  it.each([
    ["production", "VERCEL_PROJECT_PRODUCTION_URL", "https://secret-host.invalid"],
    ["production", "VERCEL_PROJECT_PRODUCTION_URL", "secret-host.invalid/apply"],
    ["preview", "VERCEL_URL", "secret host.invalid"],
    ["preview", "VERCEL_URL", "secret-host.invalid?ref=email"],
    ["preview", "VERCEL_URL", "user:secret@host.invalid"],
  ] as const)("rejects a malformed Vercel %s hostname in %s without echoing it", (vercelEnv, variable, value) => {
    const error = siteUrlError({ NODE_ENV: "production", VERCEL_ENV: vercelEnv, [variable]: value });

    expect(error.variable).toBe(variable);
    expect(error.message).not.toContain("secret");
  });

  it.each([
    [
      "Vercel production without a production hostname",
      { NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "launchpad-abc123-team.vercel.app" },
    ],
    [
      "Vercel preview without a deployment hostname",
      { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "launchpad.example.com" },
    ],
    ["a production build with nothing configured", { NODE_ENV: "production" }],
    [
      "a production build with only blank values",
      { NODE_ENV: "production", SITE_URL: " ", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "" },
    ],
  ])("returns null for %s", (_label, env: SiteEnv) => {
    stubSiteEnv(env);
    expect(getSiteUrl()).toBeNull();
  });

  it.each(["development", "test"])("falls back to the local dev server when NODE_ENV is %s", (nodeEnv) => {
    stubSiteEnv({ NODE_ENV: nodeEnv });
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("falls back to the local dev server under vercel dev", () => {
    stubSiteEnv({ NODE_ENV: "development", VERCEL_ENV: "development", VERCEL_URL: "localhost:3000" });
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});

describe("signUp confirmation redirect", () => {
  const input = { email: "maya@example.com", password: "correct-horse-battery", accountRole: "hacker" } as const;

  beforeEach(() => {
    authSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    createClient.mockResolvedValue({ auth: { signUp: authSignUp } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    authSignUp.mockReset();
    createClient.mockReset();
  });

  it.each([
    ["the local dev server", {}, "http://localhost:3000/auth/callback"],
    [
      "SITE_URL, without its path or query",
      { NODE_ENV: "production", SITE_URL: "https://apply.example.org/ignored/?ref=email" },
      "https://apply.example.org/auth/callback",
    ],
    ["Vercel production", VERCEL_PRODUCTION, "https://launchpad.example.com/auth/callback"],
  ])("sends /auth/callback on %s as emailRedirectTo", async (_label, env: SiteEnv, expected) => {
    stubSiteEnv(env);

    expect(await signUp(input)).toEqual({
      ok: true,
      data: { viewer: null, requiresEmailConfirmation: true, redirectTo: "/login" },
    });
    expect(authSignUp).toHaveBeenCalledExactlyOnceWith({
      email: "maya@example.com",
      password: "correct-horse-battery",
      options: { data: { account_role: "hacker" }, emailRedirectTo: expected },
    });
  });

  it("sends no emailRedirectTo from a production build with no configured origin", async () => {
    stubSiteEnv({ NODE_ENV: "production" });

    await signUp(input);

    expect(authSignUp).toHaveBeenCalledExactlyOnceWith({
      email: "maya@example.com",
      password: "correct-horse-battery",
      options: { data: { account_role: "hacker" } },
    });
  });

  it("logs an invalid SITE_URL and fails before creating a Supabase client", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubSiteEnv({ NODE_ENV: "production", SITE_URL: "ftp://secret-host.invalid" });

    expect(await signUp(input)).toEqual({
      ok: false,
      error: { code: "unexpected_error", message: ACTION_ERROR_MESSAGES.unexpected_error },
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(authSignUp).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      "[launchpad] signUp:siteUrl",
      expect.objectContaining({ message: expect.not.stringContaining("secret") }),
    );
  });

  it("still rejects invalid input before reading the site URL", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubSiteEnv({ NODE_ENV: "production", SITE_URL: "ftp://secret-host.invalid" });
    const formData = new FormData();
    formData.append("email", "maya@example.com");
    formData.append("password", "correct-horse-battery");
    formData.append("accountRole", "organizer");

    expect(await signUp(formData)).toMatchObject({
      ok: false,
      error: { code: "validation_failed", fieldErrors: { accountRole: expect.any(Array) } },
    });
    expect(consoleError).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
