// Pure helpers for app/auth/callback/route.ts. Only the PKCE `code` flow is supported: verifying
// token_hash links on GET would allow login CSRF, and the default confirmation email uses ?code=.

/** Error codes the callback sends to /login?error=<code>. Copy lives in COPY.auth.callbackErrors. */
export const AUTH_CALLBACK_ERROR_CODES = [
  "link_expired",
  "confirm_link_other_browser",
  "invalid_link",
  "auth_callback_failed",
] as const;

export type AuthCallbackErrorCode = (typeof AUTH_CALLBACK_ERROR_CODES)[number];

/** The callback query: a code to exchange, an error reported by Supabase Auth, or neither. */
export type AuthCallbackParams =
  | { kind: "code"; code: string }
  | { kind: "provider_error"; errorCode: string | null }
  | { kind: "invalid" };

// Real auth codes are short opaque ids; anything this long is rejected before a network call.
const MAX_CODE_LENGTH = 1024;

// Supabase Auth error codes (AuthError.code or the error_code query parameter) that have their own copy.
// A Map avoids matching inherited object keys such as "toString".
const SUPABASE_ERROR_CODES = new Map<string, AuthCallbackErrorCode>([
  ["otp_expired", "link_expired"],
  ["flow_state_expired", "link_expired"],
  ["flow_state_not_found", "link_expired"],
  // The PKCE verifier cookie is missing or belongs to another signup, so the link was opened elsewhere.
  ["pkce_code_verifier_not_found", "confirm_link_other_browser"],
  ["bad_code_verifier", "confirm_link_other_browser"],
]);

/** True for a known callback error code, such as a trusted value for the /login `error` parameter. */
export function isAuthCallbackErrorCode(value: unknown): value is AuthCallbackErrorCode {
  return typeof value === "string" && (AUTH_CALLBACK_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Reads the callback query. An `error` or `error_code` parameter wins over `code`. A code must be
 * non-empty and shorter than 1024 characters. Every other parameter, including `next`, is ignored.
 */
export function parseAuthCallbackParams(params: URLSearchParams): AuthCallbackParams {
  if (params.has("error") || params.has("error_code")) {
    return { kind: "provider_error", errorCode: params.get("error_code") || null };
  }

  const code = params.get("code");
  if (code && code.length < MAX_CODE_LENGTH) {
    return { kind: "code", code };
  }
  return { kind: "invalid" };
}

/** Maps a Supabase Auth error code to a callback error. Unknown or missing codes are `auth_callback_failed`. */
export function mapAuthCallbackError(code: string | null | undefined): AuthCallbackErrorCode {
  return (code ? SUPABASE_ERROR_CODES.get(code) : undefined) ?? "auth_callback_failed";
}
