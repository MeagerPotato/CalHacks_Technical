import type { Ref } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { Card } from "@/components/ui/Card";
import { COPY } from "@/content/copy";

const TITLE_ID = "check-email-title";

export interface CheckEmailNoticeProps {
  /** The address the confirmation link was sent to. */
  email: string;
  signInHref: string;
  /** The signup form focuses this heading when the notice replaces the form. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Shown in place of the signup form when the new account must confirm its email before signing in. */
export function CheckEmailNotice({ email, signInHref, headingRef }: CheckEmailNoticeProps) {
  return (
    <Card labelledBy={TITLE_ID} data-testid="check-email">
      <div className="flex flex-col gap-4">
        <h2 id={TITLE_ID} ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
          {COPY.auth.checkEmail.title}
        </h2>
        {/* A long address has no break opportunities, so let it wrap anywhere instead of overflowing at 320px. */}
        <p className="wrap-anywhere">{COPY.auth.checkEmail.body(email)}</p>
        <div>
          <AppLink href={signInHref} variant="primary">
            {COPY.auth.checkEmail.signInLink}
          </AppLink>
        </div>
      </div>
    </Card>
  );
}
