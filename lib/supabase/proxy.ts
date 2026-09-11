import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/env";
import { ROUTES, isProtectedPath } from "@/lib/routes";
import type { Database } from "@/types/database";

// The login redirect depends on the session cookie, so it must never be cached. @supabase/ssr sends these
// values when it writes cookies; they are also the fallback for a signed-out request that writes none.
const NO_STORE_HEADERS = {
  "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0",
  expires: "0",
  pragma: "no-cache",
} as const;

// Only page loads are redirected. Server Action fetches (POST) follow redirects, so a 307 would
// replace the action's `unauthenticated` result with the login page HTML.
const REDIRECT_METHODS = new Set(["GET", "HEAD"]);

/**
 * Refreshes the Supabase session cookies on every matched request and performs an optimistic,
 * uncacheable redirect to /login for GET and HEAD requests to protected paths when no valid session exists.
 *
 * This is a navigation convenience only. Authorization is enforced by the data access layer,
 * every Server Action, and Row Level Security.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!hasSupabasePublicEnv()) {
    return response;
  }

  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not add logic between creating the client and getClaims(): the call refreshes an
  // expiring session and must run before any response is produced.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = typeof data?.claims?.sub === "string";

  if (!isSignedIn && REDIRECT_METHODS.has(request.method) && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = ROUTES.login;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    for (const [header, fallback] of Object.entries(NO_STORE_HEADERS)) {
      redirect.headers.set(header, response.headers.get(header) ?? fallback);
    }
    return redirect;
  }

  return response;
}
