import type { Metadata } from "next";

import { AuthShell } from "@/components/layout/AuthShell";
import { AppLink } from "@/components/ui/AppLink";
import { Notice } from "@/components/ui/Notice";
import { COPY } from "@/content/copy";
import { isAuthCallbackErrorCode } from "@/lib/auth/callback";
import { ROUTES } from "@/lib/routes";

import { LoginForm } from "./_components/LoginForm";

export const metadata: Metadata = { title: COPY.auth.login.title };

/** Longest `next` value forwarded to signIn, which re-validates it with getSafeRedirectPath and the role check. */
const NEXT_MAX_LENGTH = 2048;

/** Sign-in page. No signed-in redirect: signing in again simply replaces the session. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.length > 0 && next.length <= NEXT_MAX_LENGTH ? next : undefined;
  const callbackError = isAuthCallbackErrorCode(error) ? error : null;

  return (
    <AuthShell
      title={COPY.auth.login.title}
      description={COPY.auth.login.description}
      footer={
        <p>
          {COPY.auth.login.noAccount} <AppLink href={ROUTES.signup}>{COPY.auth.login.createAccountLink}</AppLink>
        </p>
      }
    >
      {callbackError ? (
        <Notice id={`callback-${callbackError}`} tone="warning" title={COPY.auth.callbackErrors[callbackError].title}>
          {COPY.auth.callbackErrors[callbackError].body}
        </Notice>
      ) : null}
      <LoginForm next={nextPath} />
    </AuthShell>
  );
}
