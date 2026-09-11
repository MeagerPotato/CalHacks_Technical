import type { Metadata } from "next";

import { AuthShell } from "@/components/layout/AuthShell";
import { AppLink } from "@/components/ui/AppLink";
import { COPY } from "@/content/copy";
import { ROUTES } from "@/lib/routes";

import { SignupForm } from "./_components/SignupForm";

export const metadata: Metadata = { title: COPY.auth.signup.title };

/** Public Hacker or Judge signup. No signed-in redirect (see docs/infrastructure/backend-contract.md). */
export default function SignupPage() {
  return (
    <AuthShell
      title={COPY.auth.signup.title}
      description={COPY.auth.signup.description}
      footer={
        <p>
          {COPY.auth.signup.haveAccount} <AppLink href={ROUTES.login}>{COPY.auth.signup.signInLink}</AppLink>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
