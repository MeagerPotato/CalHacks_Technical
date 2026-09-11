"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type MouseEvent } from "react";

import { classifyThrownAction } from "@/app/_components/action-errors";
import { updateApplicationStatus } from "@/app/actions/applications";
import { saveReview, submitReview } from "@/app/actions/reviews";
import type { DecisionReleaseStep } from "@/components/organizer/DecisionRelease";
import type { ScorecardAction } from "@/components/organizer/Scorecard";
import type { FieldCounter } from "@/components/ui/Field";
import { ORGANIZER_COPY } from "@/content/copy";
import type { ActionError } from "@/lib/actions/result";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-config";
import { useNavigationGuard } from "@/lib/client/navigation-guard";
import type { ReviewRecord } from "@/lib/data/types";
import { DECISION_STATUSES, RECOMMENDATIONS, type DecisionStatus, type Recommendation } from "@/lib/domain/enums";
import { toFieldErrors, toFormErrors } from "@/lib/validation/errors";
import { REVIEW_SCHEMAS } from "@/lib/validation/review";
import {
  organizerNoticeFor,
  organizerSignInHref,
  type OrganizerFeedbackCode,
} from "@/lib/view-models/organizer-feedback";
import { REVIEWED_QUERY_PARAM, reviewWorkspaceHref } from "@/lib/view-models/organizer-routes";
import {
  emptyScorecardErrors,
  notesCounterText,
  overallScoreText,
  scorecardValuesEqual,
  toReviewDraftPayload,
  toReviewErrorState,
  toReviewSubmissionPayload,
  toScorecardValues,
  type ReviewErrorState,
} from "@/lib/view-models/organizer-scorecard";
import type { ReviewWorkspaceView, ScorecardValues } from "@/lib/view-models/organizer-types";
import type { NoticeActionKind, NoticeView, SummaryItemView } from "@/lib/view-models/types";

/** Appended when repeating an identical announcement, because screen readers ignore unchanged live text. */
const REPEAT_MARKER = String.fromCharCode(160);

type FocusTarget = "summary" | "heading" | "decision-heading" | "decision-choice" | "decision-confirm" | "release-button";

type LastAction = ScorecardAction | "decision";

type WriteOutcome =
  | { outcome: "saved"; nextApplicationId: string | null }
  | { outcome: "invalid" | "failed" | "blocked" };

function isDecisionChoice(value: string): value is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(value);
}

function toRecommendationValue(value: string): Recommendation | "" {
  return (RECOMMENDATIONS as readonly string[]).includes(value) ? (value as Recommendation) : "";
}

/**
 * State for one review workspace (one application id; a different id mounts a new workspace).
 *
 * - Scorecard values start from the saved review. When the server's saved review changes (a save here, a refresh, or
 *   another tab), it becomes the new baseline, and also the form values unless there are unsaved edits.
 * - Saves are explicit and single-flight. Save review and Save review and continue validate with the submission schema
 *   first, so missing scores and the recommendation are reported without a round trip; the error summary takes focus.
 * - Save review and continue opens the next unreviewed application with `?reviewed=<reference>`; that page focuses its
 *   `h1`, announces the arrival notice, and removes the parameter. With nothing left, a success notice stays here.
 * - Blind mode lives in `?identity=revealed`: the toggle replaces the URL (unsaved edits survive, because the page
 *   keeps its state across search-parameter changes) and the new state is announced.
 * - Decision release is two steps: choose, then confirm. Unsaved review edits block it. Cancel returns focus to
 *   Release decision; a release focuses the decision heading.
 * - Internal links and sign-out flush unsaved edits through the navigation guard; closing the tab warns.
 */
export function useReviewWorkspace(view: ReviewWorkspaceView) {
  const router = useRouter();
  const { register } = useNavigationGuard();
  const { scorecard } = view;
  const editable = scorecard.access === "editable";

  const [values, setValues] = useState<ScorecardValues>(scorecard.initialValues);
  const [baseline, setBaseline] = useState<ScorecardValues>(scorecard.initialValues);
  const [pending, setPending] = useState<ScorecardAction | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [errorState, setErrorState] = useState<ReviewErrorState | null>(null);
  const [notice, setNotice] = useState<NoticeView | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [decisionStep, setDecisionStep] = useState<DecisionReleaseStep>("choose");
  const [decisionChoice, setDecisionChoice] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; token: number } | null>(null);
  const [identityPending, startIdentityTransition] = useTransition();

  const dirty = editable && !scorecardValuesEqual(values, baseline);

  // Adopt a changed saved review during render, so the form never shows one frame of stale values.
  const initialSignature = JSON.stringify(scorecard.initialValues);
  const [syncedSignature, setSyncedSignature] = useState(initialSignature);
  if (syncedSignature !== initialSignature) {
    setSyncedSignature(initialSignature);
    setBaseline(scorecard.initialValues);
    if (!dirty) {
      setValues(scorecard.initialValues);
    }
  }

  // Announce blind mode once the page data for the new state arrives.
  const [announcedBlind, setAnnouncedBlind] = useState(view.blind.isBlind);
  if (announcedBlind !== view.blind.isBlind) {
    setAnnouncedBlind(view.blind.isBlind);
    setAnnouncement(view.blind.statusText);
  }

  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const decisionHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const releaseRef = useRef<HTMLButtonElement>(null);
  const inFlightRef = useRef(false);
  const navigatingRef = useRef(false);
  const lastActionRef = useRef<LastAction>("draft");
  const latestRef = useRef({ view, values, notice, dirty });

  useLayoutEffect(() => {
    latestRef.current = { view, values, notice, dirty };
  });

  const announce = useCallback((message: string) => {
    setAnnouncement((previous) => (message !== "" && previous === message ? `${message}${REPEAT_MARKER}` : message));
  }, []);

  const requestFocus = useCallback((target: FocusTarget) => {
    setFocusRequest((previous) => ({ target, token: (previous?.token ?? 0) + 1 }));
  }, []);

  const reportFailure = useCallback(
    (code: OrganizerFeedbackCode) => {
      const next = organizerNoticeFor(code, {
        signInHref: organizerSignInHref(`${window.location.pathname}${window.location.search}`),
      });
      // An unchanged alert is not announced again, so a repeated failure repeats its title in the live status.
      announce(latestRef.current.notice?.id === next.id ? next.title : "");
      setNotice(next);
    },
    [announce],
  );

  const showValidation = useCallback(
    (error: Pick<ActionError, "fieldErrors" | "formErrors">): boolean => {
      const state = toReviewErrorState(latestRef.current.view.type, error.fieldErrors);
      const formErrors = [...state.unplaced, ...(error.formErrors ?? [])];
      if (state.summary.length === 0 && formErrors.length === 0) {
        return false;
      }
      setErrorState({ ...state, unplaced: formErrors });
      setNotice(null);
      announce("");
      requestFocus("summary");
      return true;
    },
    [announce, requestFocus],
  );

  const writeReview = useCallback(
    async (mode: "draft" | "complete"): Promise<WriteOutcome> => {
      const { view: current, values: currentValues } = latestRef.current;
      if (current.scorecard.access !== "editable") {
        return { outcome: "blocked" };
      }

      const schemas = REVIEW_SCHEMAS[current.type];
      const payload =
        mode === "draft"
          ? toReviewDraftPayload(current.type, currentValues)
          : toReviewSubmissionPayload(current.type, currentValues);
      const parsed = (mode === "draft" ? schemas.draft : schemas.submission).safeParse(payload);
      if (!parsed.success) {
        showValidation({ fieldErrors: toFieldErrors(parsed.error, 2), formErrors: toFormErrors(parsed.error) });
        return { outcome: "invalid" };
      }

      function failed(error: ActionError): WriteOutcome {
        if (error.code === "validation_failed" && showValidation(error)) {
          return { outcome: "invalid" };
        }
        reportFailure(error.code);
        return { outcome: "failed" };
      }

      try {
        let review: ReviewRecord;
        let nextApplicationId: string | null = null;
        if (mode === "draft") {
          const result = await saveReview(current.applicationId, payload);
          if (!result.ok) {
            return failed(result.error);
          }
          review = result.data.review;
        } else {
          const result = await submitReview(current.applicationId, payload);
          if (!result.ok) {
            return failed(result.error);
          }
          review = result.data.review;
          nextApplicationId = result.data.nextApplicationId;
        }
        setBaseline(toScorecardValues(current.type, review));
        setErrorState(null);
        setNotice(null);
        return { outcome: "saved", nextApplicationId };
      } catch (error) {
        reportFailure(classifyThrownAction(error));
        return { outcome: "failed" };
      }
    },
    [reportFailure, showValidation],
  );

  const save = useCallback(
    async (action: ScorecardAction) => {
      if (inFlightRef.current || navigatingRef.current) {
        return;
      }
      const status = ORGANIZER_COPY.workspace.status;
      inFlightRef.current = true;
      lastActionRef.current = action;
      setPending(action);
      announce(status.saving);
      try {
        const written = await writeReview(action === "draft" ? "draft" : "complete");
        if (written.outcome !== "saved") {
          return;
        }
        if (action !== "continue") {
          announce(action === "draft" ? status.draftSaved : status.reviewSaved);
          return;
        }
        const current = latestRef.current.view;
        const next = written.nextApplicationId;
        if (next && next !== current.applicationId) {
          navigatingRef.current = true;
          announce(status.reviewSaved);
          router.push(reviewWorkspaceHref(next, { reviewedReference: current.reference }));
          return;
        }
        const done = ORGANIZER_COPY.workspace.queueDone;
        setNotice({ id: "queue-done", tone: "success", title: done.title, body: done.body, actions: [] });
        announce(done.title);
      } finally {
        inFlightRef.current = false;
        if (!navigatingRef.current) {
          setPending(null);
        }
      }
    },
    [announce, router, writeReview],
  );

  const confirmRelease = useCallback(
    async (choice: string) => {
      if (inFlightRef.current || navigatingRef.current || !isDecisionChoice(choice)) {
        return;
      }
      inFlightRef.current = true;
      lastActionRef.current = "decision";
      setDecisionPending(true);
      announce(ORGANIZER_COPY.workspace.status.releasing);
      try {
        const result = await updateApplicationStatus(latestRef.current.view.applicationId, choice);
        if (!result.ok) {
          reportFailure(result.error.code);
          return;
        }
        setNotice(null);
        setDecisionStep("choose");
        setDecisionChoice("");
        announce(ORGANIZER_COPY.workspace.decision.released(APPLICATION_STATUS_LABELS[result.data.status]));
        requestFocus("decision-heading");
      } catch (error) {
        reportFailure(classifyThrownAction(error));
      } finally {
        inFlightRef.current = false;
        setDecisionPending(false);
      }
    },
    [announce, reportFailure, requestFocus],
  );

  const requestRelease = useCallback(() => {
    const copy = ORGANIZER_COPY.workspace.decision;
    if (!isDecisionChoice(decisionChoice)) {
      setDecisionError(copy.chooseError);
      requestFocus("decision-choice");
      return;
    }
    if (latestRef.current.dirty) {
      setDecisionError(copy.saveFirst);
      requestFocus("decision-choice");
      return;
    }
    setDecisionError(null);
    setDecisionStep("confirm");
    requestFocus("decision-confirm");
  }, [decisionChoice, requestFocus]);

  const cancelRelease = useCallback(() => {
    setDecisionStep("choose");
    requestFocus("release-button");
  }, [requestFocus]);

  const chooseDecision = useCallback((value: string) => {
    setDecisionChoice(value);
    setDecisionError(null);
  }, []);

  const handleNoticeAction = useCallback(
    (kind: NoticeActionKind) => {
      switch (kind) {
        case "retry":
          setNotice(null);
          if (lastActionRef.current === "decision") {
            void confirmRelease(decisionChoice);
          } else {
            void save(lastActionRef.current);
          }
          return;
        case "reload_latest":
        case "check_status":
          // Discard local edits so the refreshed saved review replaces them.
          setNotice(null);
          setErrorState(null);
          setValues(latestRef.current.view.scorecard.initialValues);
          router.refresh();
          return;
        case "reload":
          window.location.reload();
          return;
        case "dismiss":
          setNotice(null);
          return;
        case "sign_in_new_tab":
          // Rendered as a link that opens in a new tab.
          return;
      }
    },
    [confirmRelease, decisionChoice, router, save],
  );

  const toggleIdentity = useCallback(() => {
    const { blind } = latestRef.current.view;
    const status = ORGANIZER_COPY.workspace.status;
    announce(blind.isBlind ? status.revealing : status.hiding);
    startIdentityTransition(() => {
      router.replace(blind.toggleHref, { scroll: false });
    });
  }, [announce, router]);

  const activateSummaryItem = useCallback((item: SummaryItemView, event: MouseEvent<HTMLAnchorElement>) => {
    const element = document.getElementById(item.href.replace(/^#/, ""));
    if (!element) {
      return;
    }
    event.preventDefault();
    element.scrollIntoView({ block: "center" });
    element.focus({ preventScroll: true });
  }, []);

  const setScore = useCallback((dimension: string, score: number) => {
    setValues((previous) => ({ ...previous, scores: { ...previous.scores, [dimension]: score } }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setValues((previous) => ({ ...previous, notes }));
  }, []);

  const setRecommendation = useCallback((recommendation: string) => {
    setValues((previous) => ({ ...previous, recommendation: toRecommendationValue(recommendation) }));
  }, []);

  // Move focus once the element for the request has rendered.
  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const targets: Record<FocusTarget, HTMLElement | null> = {
      summary: summaryRef.current,
      heading: headingRef.current,
      "decision-heading": decisionHeadingRef.current,
      "decision-choice": document.getElementById("decision-choice"),
      "decision-confirm": confirmRef.current,
      "release-button": releaseRef.current,
    };
    targets[focusRequest.target]?.focus();
  }, [focusRequest]);

  // Arrival through Save review and continue: focus the heading, announce the notice, and drop ?reviewed= so a reload
  // does not repeat it.
  const arrivalTitle = view.notices.find((item) => item.id === "review-continued")?.title ?? null;
  useEffect(() => {
    if (!arrivalTitle) {
      return;
    }
    headingRef.current?.focus();
    const url = new URL(window.location.href);
    if (url.searchParams.has(REVIEWED_QUERY_PARAM)) {
      url.searchParams.delete(REVIEWED_QUERY_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // The live region is already mounted; changing it on the next task lets screen readers announce the arrival.
    const timer = window.setTimeout(() => announce(arrivalTitle), 0);
    return () => window.clearTimeout(timer);
  }, [announce, arrivalTitle]);

  // Internal links and sign-out flush unsaved edits: a draft save, or a complete save for a completed review.
  useEffect(
    () =>
      register({
        isDirty: () => latestRef.current.dirty,
        flush: async () => {
          if (!latestRef.current.dirty) {
            return "nothing_to_save";
          }
          if (inFlightRef.current) {
            return "failed";
          }
          inFlightRef.current = true;
          try {
            const written = await writeReview(latestRef.current.view.scorecard.isCompleted ? "complete" : "draft");
            return written.outcome;
          } finally {
            inFlightRef.current = false;
          }
        },
      }),
    [register, writeReview],
  );

  // Warn before closing or reloading the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const shownValues = editable ? values : scorecard.initialValues;
  const notesCounter: FieldCounter = {
    current: shownValues.notes.length,
    max: scorecard.notes.maxLength,
    text: notesCounterText(shownValues.notes, scorecard.notes.maxLength),
  };

  return {
    headingRef,
    summaryRef,
    decisionHeadingRef,
    confirmRef,
    releaseRef,
    announcement,
    notice,
    handleNoticeAction,
    identityPending,
    toggleIdentity,
    scorecard: {
      values: shownValues,
      overallText: overallScoreText(view.type, shownValues.scores),
      notesCounter,
      errors: errorState?.errors ?? emptyScorecardErrors(),
      summaryItems: errorState?.summary ?? [],
      formErrors: errorState?.unplaced ?? [],
      pending,
      onSummaryItemActivate: activateSummaryItem,
      onScoreChange: setScore,
      onNotesChange: setNotes,
      onRecommendationChange: setRecommendation,
      onSaveDraft: () => void save("draft"),
      onSaveReview: () => void save("review"),
      onSaveAndContinue: () => void save("continue"),
    },
    decision: {
      step: decisionStep,
      choice: decisionChoice,
      error: decisionError,
      pending: decisionPending,
      onChoiceChange: chooseDecision,
      onRelease: requestRelease,
      onConfirm: () => void confirmRelease(decisionChoice),
      onCancel: cancelRelease,
    },
  };
}
