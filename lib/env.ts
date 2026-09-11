/**
 * Public Supabase configuration.
 *
 * Only the project URL and the publishable key are used by this app. Both are browser-safe;
 * authorization comes from the user's session plus Row Level Security. NEXT_PUBLIC_ values
 * are inlined at build time, so they are read with literal property access below.
 */
export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

export class UnsafeSupabaseKeyError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a secret or service-role key. " +
        "Use the publishable key (sb_publishable_...) and never expose secret keys to this app.",
    );
    this.name = "UnsafeSupabaseKeyError";
  }
}

function readPublicEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
}

/** Rejects secret keys (sb_secret_...) and legacy JWT keys carrying the service_role role. */
export function assertBrowserSafeSupabaseKey(key: string): void {
  if (key.startsWith("sb_secret_")) {
    throw new UnsafeSupabaseKeyError();
  }

  const segments = key.split(".");
  if (segments.length !== 3) {
    return;
  }

  let role: unknown;
  try {
    role = (JSON.parse(decodeBase64Url(segments[1])) as { role?: unknown }).role;
  } catch {
    return;
  }

  if (role === "service_role") {
    throw new UnsafeSupabaseKeyError();
  }
}

export function hasSupabasePublicEnv(): boolean {
  const { url, publishableKey } = readPublicEnv();
  return Boolean(url && publishableKey);
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const { url, publishableKey } = readPublicEnv();

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  assertBrowserSafeSupabaseKey(publishableKey);
  return { url, publishableKey };
}

type SiteUrlVariable = "SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_URL";

const LOCAL_SITE_URL = "http://localhost:3000";

/** Thrown when a configured site URL is not a usable http(s) origin. The message never repeats the value. */
export class InvalidSiteUrlError extends Error {
  readonly variable: SiteUrlVariable;

  constructor(variable: SiteUrlVariable) {
    super(
      variable === "SITE_URL"
        ? "SITE_URL must be an absolute http:// or https:// URL, such as https://mission-control.example.com."
        : `${variable} must be a hostname without a protocol, path, or query.`,
    );
    this.name = "InvalidSiteUrlError";
    this.variable = variable;
  }
}

function readEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function originFromSiteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidSiteUrlError("SITE_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidSiteUrlError("SITE_URL");
  }
  return url.origin;
}

function originFromVercelHost(variable: Exclude<SiteUrlVariable, "SITE_URL">, host: string): string {
  let url: URL;
  try {
    url = new URL(`https://${host}`);
  } catch {
    throw new InvalidSiteUrlError(variable);
  }
  // Vercel provides bare hostnames. A protocol, path, query, or credentials means a bad override.
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new InvalidSiteUrlError(variable);
  }
  return url.origin;
}

/**
 * Public origin for absolute links in auth emails, such as the /auth/callback confirmation URL.
 * Server-only: SITE_URL and the Vercel variables are not exposed to the browser.
 *
 * Order: SITE_URL; VERCEL_PROJECT_PRODUCTION_URL on Vercel production; VERCEL_URL on Vercel
 * previews; http://localhost:3000 outside production; otherwise null. Request Host headers are
 * never used because the client controls them.
 *
 * @throws {InvalidSiteUrlError} When a configured value is not a usable http(s) origin.
 */
export function getSiteUrl(): string | null {
  const siteUrl = readEnvValue(process.env.SITE_URL);
  if (siteUrl) {
    return originFromSiteUrl(siteUrl);
  }

  const vercelEnv = readEnvValue(process.env.VERCEL_ENV);
  const productionHost = readEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelEnv === "production" && productionHost) {
    return originFromVercelHost("VERCEL_PROJECT_PRODUCTION_URL", productionHost);
  }

  const deploymentHost = readEnvValue(process.env.VERCEL_URL);
  if (vercelEnv === "preview" && deploymentHost) {
    return originFromVercelHost("VERCEL_URL", deploymentHost);
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_SITE_URL;
  }
  return null;
}
