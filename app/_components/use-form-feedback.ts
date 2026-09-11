"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { fieldControlId } from "@/lib/editor/steps";
import type { FieldErrors } from "@/lib/validation/errors";
import type { NoticeView, SummaryItemView } from "@/lib/view-models/types";

/** Validation and action feedback for the auth and onboarding forms. */
export interface FormFeedback {
  fieldErrors: FieldErrors;
  summary: SummaryItemView[];
  notice: NoticeView | null;
}

export const EMPTY_FEEDBACK: FormFeedback = { fieldErrors: {}, summary: [], notice: null };

/** Reads a text value from FormData; missing or file values become an empty string. */
export function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Feedback state for the small forms. Inputs stay uncontrolled (the forms submit with onSubmit, so React never
 * resets them), and showing feedback with summary items moves focus to the error summary once it has rendered.
 */
export function useFormFeedback() {
  const [feedback, setFeedback] = useState<FormFeedback>(EMPTY_FEEDBACK);
  const [summaryFocusToken, setSummaryFocusToken] = useState(0);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (summaryFocusToken > 0) {
      summaryRef.current?.focus();
    }
  }, [summaryFocusToken]);

  const showFeedback = useCallback((next: FormFeedback) => {
    setFeedback(next);
    if (next.summary.length > 0) {
      setSummaryFocusToken((token) => token + 1);
    }
  }, []);

  /**
   * Removes the notice when a new attempt starts. An unchanged notice would not be announced again, so a second
   * identical failure would pass silently; a notice that is removed and re-inserted is announced.
   */
  const clearNotice = useCallback(() => {
    setFeedback((current) => (current.notice ? { ...current, notice: null } : current));
  }, []);

  /** Error summary links focus their control; the href remains the no-JavaScript fallback. */
  const focusSummaryItem = useCallback((item: SummaryItemView, event: MouseEvent<HTMLAnchorElement>) => {
    const control = document.getElementById(fieldControlId(item.key));
    if (control) {
      event.preventDefault();
      control.focus();
    }
  }, []);

  return { feedback, showFeedback, clearNotice, summaryRef, focusSummaryItem };
}
