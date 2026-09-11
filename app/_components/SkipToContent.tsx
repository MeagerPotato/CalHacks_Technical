"use client";

import type { MouseEvent } from "react";

import { SkipLink } from "@/components/ui/SkipLink";
import { COPY } from "@/content/copy";
import { isModifiedClick } from "@/lib/editor/steps";

const MAIN_ID = "main";

/**
 * The skip link on every page. It moves focus to the main landmark itself: following the fragment would add a history
 * entry without App Router state, and Back to such an entry leaves the rendered page out of step with the URL.
 */
export function SkipToContent() {
  function focusMain(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById(MAIN_ID);
    if (!main || isModifiedClick(event)) {
      return;
    }
    event.preventDefault();
    main.focus();
  }

  return <SkipLink targetId={MAIN_ID} label={COPY.common.skipToContent} onActivate={focusMain} />;
}
