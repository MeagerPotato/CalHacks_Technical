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
