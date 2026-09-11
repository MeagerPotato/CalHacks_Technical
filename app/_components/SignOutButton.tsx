"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { LiveStatus, NoticeFromView } from "@/components/ui/Notice";
import { COPY, LOCKED } from "@/content/copy";
import { useNavigationGuard } from "@/lib/client/navigation-guard";
import { toAuthFeedback } from "@/lib/editor/feedback";
import type { NoticeView } from "@/lib/view-models/types";

import { thrownActionNotice } from "./thrown-notice";

/**
 * Signs out this browser session. Inside the portal it first lets a dirty application editor save, or asks before
 * leaving unsaved answers. signOut revalidates the current page, whose guard redirects to /login: the same
 * destination this button navigates to, so the two navigations cannot conflict.
 */
export function SignOutButton() {
  const router = useRouter();
  const { confirmLeave } = useNavigationGuard();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<NoticeView | null>(null);

  function handleSignOut() {
    setNotice(null);
    startTransition(async () => {
      if (!(await confirmLeave())) {
        return;
      }
      try {
        const result = await signOut();
        if (result.ok) {
          router.replace(result.data.redirectTo);
          return;
        }
        // signOut reports rate_limited or unexpected_error; both use the auth notice copy.
        startTransition(() => setNotice(toAuthFeedback(result.error, []).notice));
      } catch (error) {
        startTransition(() => setNotice(thrownActionNotice(error)));
      }
    });
  }

  return (
    <>
      <Button variant="quiet" pending={isPending} onClick={handleSignOut}>
        {LOCKED.auth.signOut}
      </Button>
      <LiveStatus message={isPending ? COPY.auth.signOut.pending : ""} />
      {notice ? <NoticeFromView view={notice} live="assertive" /> : null}
    </>
  );
}
