import { NextResponse, type NextRequest } from "next/server";

import { logServerError } from "@/lib/actions/errors";
import { mapAuthCallbackError, parseAuthCallbackParams, type AuthCallbackErrorCode } from "@/lib/auth/callback";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// Same headers @supabase/ssr sends with session cookies, so neither the redirect nor its cookies are cached.
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

function redirectResponse(request: NextRequest, path: string, errorCode?: AuthCallbackErrorCode): NextResponse {
  // A fixed path on the request origin. Incoming parameters (code, next, tokens) are never copied.
  const target = new URL(path, request.url);
  if (errorCode) {
    target.searchParams.set("error", errorCode);
  }
  return NextResponse.redirect(target, { headers: NO_STORE_HEADERS });
}

/**
 * Completes an email confirmation link (PKCE). The code is exchanged for a session whose cookies
 * are written through next/headers cookies(); Next.js merges them into this redirect. Success goes
 * to /onboarding (its guard routes each role onward) and `next` is ignored. Failures go to
 * /login?error=<AuthCallbackErrorCode>.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = parseAuthCallbackParams(request.nextUrl.searchParams);

  if (params.kind === "invalid") {
    return redirectResponse(request, ROUTES.login, "invalid_link");
  }
  if (params.kind === "provider_error") {
    return redirectResponse(request, ROUTES.login, mapAuthCallbackError(params.errorCode));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      const errorCode = mapAuthCallbackError(error.code);
      // Expired or cross-browser links are expected outcomes; only unexplained failures are logged.
      if (errorCode === "auth_callback_failed") {
        logServerError("authCallback:exchange", error);
      }
      return redirectResponse(request, ROUTES.login, errorCode);
    }
  } catch (exchangeError) {
    logServerError("authCallback:exchange", exchangeError);
    return redirectResponse(request, ROUTES.login, "auth_callback_failed");
  }

  return redirectResponse(request, ROUTES.onboarding);
}
