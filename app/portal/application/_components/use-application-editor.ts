"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import { classifyThrownAction } from "@/app/_components/action-errors";
import { saveApplication, submitApplication } from "@/app/actions/applications";
import { LIFTOFF_DURATION_MS } from "@/components/art/motion";
import { COPY } from "@/content/copy";
import { useNavigationGuard } from "@/lib/client/navigation-guard";
import { prefersReducedMotion } from "@/lib/client/use-reduced-motion";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationType } from "@/lib/domain/enums";
import {
  editorReducer,
  initEditorState,
  selectErrors,
  selectSaveStatus,
  selectSaved,
  type EditorEvent,
  type EditorPhase,
  type FocusTarget,
  type SaveTrigger,
} from "@/lib/editor/reducer";
import {
  REVIEW_STEP,
  applicationStepHref,
  fieldControlId,
  getNextStep,
  isModifiedClick,
  parseEditorStep,
  sectionForField,
  sectionHeadingId,
  type EditorStep,
} from "@/lib/editor/steps";
import { buildDraftPatch, isNewerApplication, toUiValues, type UiValue, type UiValues } from "@/lib/editor/values";
import { ROUTES, portalMissionRoute } from "@/lib/routes";
import type { NoticeActionKind, SummaryItemView } from "@/lib/view-models/types";

/** Result of saving pending edits. Matches the navigation guard's flush contract. */
export type FlushOutcome = "saved" | "nothing_to_save" | "invalid" | "failed" | "blocked";

interface FlushResult {
  outcome: FlushOutcome;
  /** Keys still invalid after the flush: client pre-validation or server validation messages. */
  invalidKeys: string[];
  /** True when a notice explains a failure. The notice announces itself, and reportFailure repeats an unchanged one. */
  noticed?: boolean;
}

/** Save passes per flush: edits typed while a save is in flight are saved as well, without looping forever. */
const MAX_FLUSH_PASSES = 3;

/** Appended when repeating an identical announcement, because screen readers ignore unchanged live text. */
const REPEAT_MARKER = String.fromCharCode(160);

function pendingDraft(application: ApplicantApplication, edits: UiValues) {
  const baseline = toUiValues(application.type, application.responses);
  return buildDraftPatch(application.type, baseline, { ...baseline, ...edits });
}

function isFieldOnStep(type: ApplicationType, key: string, step: EditorStep): boolean {
  return step === REVIEW_STEP || sectionForField(type, key) === step;
}

/** Live-region text for a save that did not succeed when no notice or focused error summary reports it. */
function outcomeAnnouncement(outcome: FlushOutcome, invalidKeys: readonly string[]): string {
  const text = COPY.editor.saveStatus;
  if (outcome === "blocked") {
    return text.blocked;
  }
  return invalidKeys.length > 0 ? text.invalid(invalidKeys.length) : text.error;
}

interface UseApplicationEditorOptions {
  application: ApplicantApplication;
  /** Server-resolved step used when the URL has no valid ?section= value. */
  initialStep: EditorStep;
}

/**
 * State and behavior for the application editor.
 *
 * - Saved truth comes from the newest of the page props (revalidated after every action) and the latest action
 *   result, so a stale render never overwrites newer data and unsaved edits survive revalidation.
 * - Saves are explicit (Save draft, Save & continue, section changes, leaving, submit) and single-flight.
 * - The current step lives in ?section= so reload, back, and forward keep the applicant's place.
 */
export function useApplicationEditor({ application, initialStep }: UseApplicationEditorOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useNavigationGuard();
  const [state, dispatch] = useReducer(editorReducer, application, initEditorState);
  const [announcement, setAnnouncement] = useState("");
  const [selection, setSelection] = useState<{ from: EditorStep; value: string } | null>(null);

  const saved = selectSaved(state, application);
  const type = saved.type;
  const step: EditorStep = parseEditorStep(type, searchParams.get("section")) ?? initialStep;
  const phase: EditorPhase = state.phase === "editing" && !saved.isEditable ? "locked" : state.phase;

  const baseline = useMemo(() => toUiValues(type, saved.responses), [type, saved.responses]);
  const values = useMemo<UiValues>(() => ({ ...baseline, ...state.edits }), [baseline, state.edits]);
  const draft = useMemo(() => buildDraftPatch(type, baseline, values), [type, baseline, values]);
  const errors = selectErrors(state);
  // A failed save stops mattering once every edit is reverted, so the status stops saying "Not saved".
  const saveStatus = selectSaveStatus({
    phase,
    saveStatus: state.saveStatus === "error" && draft.dirtyKeys.length === 0 ? "idle" : state.saveStatus,
    dirtyKeys: draft.dirtyKeys,
    errors,
    clientErrors: state.clientErrors,
  });

  // Async handlers read the latest committed render through this ref instead of stale closures.
  const latestRef = useRef({ saved, edits: state.edits, phase, step, editor: state });
  useLayoutEffect(() => {
    latestRef.current = { saved, edits: state.edits, phase, step, editor: state };
  });

  /** Newest application returned by an action, which can be ahead of the committed render. */
  const actionResultRef = useRef<ApplicantApplication | null>(null);
  const inFlightRef = useRef<Promise<FlushResult> | null>(null);
  const submittingRef = useRef(false);
  /**
   * What a notice's Try again repeats. Only a submit (when it starts) and a failed save write it, so a save that succeeds
   * or has nothing to save never redirects the retry of a failed submit whose notice is still on screen.
   */
  const lastOperationRef = useRef<"save" | "submit">("save");
  const handledFocusTokenRef = useRef(0);
  /** Bumped by every step change, so a navigation that waited for a save can tell the applicant has moved on. */
  const navSeqRef = useRef(0);
  const summaryRef = useRef<HTMLElement>(null);
  /** The editor notice, so focus can move to its first action when it replaces another notice. */
  const noticeRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    setAnnouncement((previous) => (message !== "" && previous === message ? `${message}${REPEAT_MARKER}` : message));
  }, []);

  /**
   * Dispatches a failed save. A failure that repeats the notice already on screen leaves its alert unchanged, and an
   * unchanged alert is not announced again, so the notice title goes to the live status instead. Returns whether a
   * notice explains the failure.
   */
  const reportFailure = useCallback(
    (event: EditorEvent): boolean => {
      const before = latestRef.current.editor;
      const after = editorReducer(before, event);
      dispatch(event);
      if (after.notice !== null && after.notice === before.notice) {
        announce(after.notice.title);
      }
      return after.notice !== null;
    },
    [announce],
  );

  const newestSaved = useCallback((): ApplicantApplication => {
    const committed = latestRef.current.saved;
    const fromAction = actionResultRef.current;
    return fromAction && isNewerApplication(fromAction, committed) ? fromAction : committed;
  }, []);

  const dirtyKeysNow = useCallback(() => {
    const current = newestSaved();
    return current.isEditable ? pendingDraft(current, latestRef.current.edits).dirtyKeys : [];
  }, [newestSaved]);

  const runFlush = useCallback(
    async (trigger: SaveTrigger): Promise<FlushResult> => {
      let outcome: FlushOutcome = "nothing_to_save";
      let invalidKeys: string[] = [];

      for (let pass = 0; pass < MAX_FLUSH_PASSES; pass += 1) {
        const base = newestSaved();
        if (latestRef.current.phase !== "editing" || !base.isEditable) {
          return { outcome: "blocked", invalidKeys };
        }

        const next = pendingDraft(base, latestRef.current.edits);
        invalidKeys = Object.keys(next.invalid);

        if (Object.keys(next.patch).length === 0) {
          if (invalidKeys.length > 0) {
            dispatch({ type: "CLIENT_INVALID", fieldErrors: next.invalid, validated: next.validated, focusSummary: false });
            return { outcome: "invalid", invalidKeys };
          }
          return { outcome, invalidKeys };
        }

        if (invalidKeys.length > 0) {
          // Flag the invalid answers now: if saving the valid ones fails, the invalid ones still need inline errors.
          dispatch({ type: "CLIENT_INVALID", fieldErrors: next.invalid, validated: next.validated, focusSummary: false });
        }
        dispatch({ type: "SAVE_STARTED", trigger });
        let result: Awaited<ReturnType<typeof saveApplication>>;
        try {
          result = await saveApplication(base.id, next.patch);
        } catch (error) {
          // A notice's Try again repeats the operation that failed: a submit only when this save was part of one.
          lastOperationRef.current = trigger === "submit" ? "submit" : "save";
          const noticed = reportFailure({ type: "SAVE_THREW", kind: classifyThrownAction(error) });
          return { outcome: "failed", invalidKeys, noticed };
        }

        if (!result.ok) {
          lastOperationRef.current = trigger === "submit" ? "submit" : "save";
          const noticed = reportFailure({ type: "SAVE_FAILED", error: result.error, focusSummary: false });
          if (result.error.code === "application_locked") {
            router.refresh();
            return { outcome: "blocked", invalidKeys };
          }
          const serverInvalidKeys = Object.keys(result.error.fieldErrors ?? {});
          return { outcome: "failed", invalidKeys: [...new Set([...invalidKeys, ...serverInvalidKeys])], noticed };
        }

        actionResultRef.current = isNewerApplication(result.data, base) ? result.data : base;
        dispatch({
          type: "SAVE_SUCCEEDED",
          application: result.data,
          sent: next.sent,
          invalid: next.invalid,
          validated: next.validated,
        });
        outcome = "saved";
      }

      return { outcome: invalidKeys.length > 0 ? "invalid" : outcome, invalidKeys };
    },
    [newestSaved, reportFailure, router],
  );

  /** Single-flight: a flush requested during another waits for it, then saves whatever is still pending. */
  const flush = useCallback(
    (trigger: SaveTrigger): Promise<FlushResult> => {
      const previous = inFlightRef.current;
      const run = previous ? previous.then(() => runFlush(trigger)) : runFlush(trigger);
      inFlightRef.current = run;
      const clear = () => {
        if (inFlightRef.current === run) {
          inFlightRef.current = null;
        }
      };
      run.then(clear, clear);
      return run;
    },
    [runFlush],
  );

  const requestFocus = useCallback((target: FocusTarget) => dispatch({ type: "FOCUS_REQUESTED", target }), []);

  /** Focuses the error summary when any invalid key belongs to the step the applicant is looking at. */
  const focusSummaryFor = useCallback(
    (invalidKeys: readonly string[], onStep: EditorStep) => {
      if (invalidKeys.some((key) => isFieldOnStep(newestSaved().type, key, onStep))) {
        requestFocus({ kind: "summary" });
        return true;
      }
      return false;
    },
    [newestSaved, requestFocus],
  );

  const goToStep = useCallback(
    (next: EditorStep, target?: FocusTarget) => {
      navSeqRef.current += 1;
      if (next !== latestRef.current.step) {
        window.history.pushState(null, "", applicationStepHref(latestRef.current.saved.type, next));
      }
      requestFocus(target ?? { kind: "step", step: next });
    },
    [requestFocus],
  );

  /** Section changes save in the background; entering review waits so the summary shows saved answers. */
  const navigate = useCallback(
    async (next: EditorStep, target?: FocusTarget) => {
      if (next === REVIEW_STEP) {
        const seq = ++navSeqRef.current;
        await flush("navigate");
        if (navSeqRef.current !== seq) {
          // The applicant chose another step while the save ran.
          return;
        }
      } else {
        void flush("navigate");
      }
      goToStep(next, target);
    },
    [flush, goToStep],
  );

  const saveDraft = useCallback(async () => {
    const onStep = latestRef.current.step;
    announce(COPY.editor.announce.saving);
    const { outcome, invalidKeys, noticed } = await flush("save");
    if (outcome === "saved") {
      announce(COPY.editor.announce.saved);
    } else if (outcome === "nothing_to_save") {
      announce(COPY.editor.announce.nothingToSave);
    } else if (focusSummaryFor(invalidKeys, onStep)) {
      // The focused error summary is read out, so "Saving…" can be cleared. When a notice explains a failure, keep the
      // live status: it may hold the repeated notice title from reportFailure, the only sign that a retry failed again.
      if (!noticed) {
        announce("");
      }
    } else if (outcome === "blocked" || !noticed) {
      // Neither a notice nor the error summary reports this outcome, so say it.
      announce(outcomeAnnouncement(outcome, invalidKeys));
    }
  }, [announce, flush, focusSummaryFor]);

  const saveAndContinue = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const onStep = latestRef.current.step;
      const seq = ++navSeqRef.current;
      const { outcome, invalidKeys, noticed } = await flush("continue");

      // The applicant moved to another step while the save ran, so neither move them again nor take focus.
      if (navSeqRef.current !== seq || latestRef.current.step !== onStep) {
        return;
      }
      // Stay on the section while it has errors; errors elsewhere do not block moving forward.
      if (focusSummaryFor(invalidKeys, onStep)) {
        return;
      }
      if (outcome === "failed" || outcome === "blocked") {
        if (outcome === "blocked" || !noticed) {
          announce(outcomeAnnouncement(outcome, invalidKeys));
        }
        return;
      }
      if (outcome === "saved") {
        announce(COPY.editor.announce.saved);
      }
      const next = getNextStep(newestSaved().type, onStep);
      if (next) {
        goToStep(next);
      }
    },
    [announce, flush, focusSummaryFor, goToStep, newestSaved],
  );

  const submit = useCallback(async () => {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    lastOperationRef.current = "submit";
    try {
      const flushed = await flush("submit");
      if (flushed.outcome === "invalid") {
        focusSummaryFor(flushed.invalidKeys, REVIEW_STEP);
        return;
      }
      if (flushed.outcome === "failed" || flushed.outcome === "blocked" || dirtyKeysNow().length > 0) {
        // The notice, the locked view, or the review step's unsaved-changes warning explains why.
        return;
      }

      const base = newestSaved();
      dispatch({ type: "SUBMIT_STARTED" });
      announce(COPY.editor.announce.submitting);

      let result: Awaited<ReturnType<typeof submitApplication>>;
      try {
        result = await submitApplication(base.id);
      } catch (error) {
        // The submission may or may not have landed; the notice asks the applicant to check before retrying.
        dispatch({ type: "SUBMIT_THREW", kind: classifyThrownAction(error) });
        announce("");
        return;
      }

      if (result.ok) {
        actionResultRef.current = result.data;
        dispatch({ type: "SUBMIT_SUCCEEDED", application: result.data });
        announce(COPY.editor.announce.submitted);
        return;
      }

      dispatch({ type: "SUBMIT_FAILED", error: result.error });
      announce("");
      if (result.error.code === "application_locked") {
        router.refresh();
      }
    } finally {
      submittingRef.current = false;
    }
  }, [announce, dirtyKeysNow, flush, focusSummaryFor, newestSaved, router]);

  const changeField = useCallback((key: string, value: UiValue) => {
    dispatch({ type: "FIELD_CHANGED", key, value });
  }, []);

  /** Section links, readiness links, and edit links: plain clicks stay in the editor; modified clicks open tabs. */
  const selectStep = useCallback(
    (rawStep: string, event: MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(event)) {
        return;
      }
      const next = parseEditorStep(newestSaved().type, rawStep);
      if (!next) {
        return;
      }
      event.preventDefault();
      void navigate(next);
    },
    [navigate, newestSaved],
  );

  const activateSummaryItem = useCallback(
    (item: SummaryItemView, event: MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(event)) {
        return;
      }
      event.preventDefault();
      const section = sectionForField(newestSaved().type, item.key);
      if (!section || section === latestRef.current.step) {
        requestFocus({ kind: "field", key: item.key });
        return;
      }
      void navigate(section, { kind: "field", key: item.key });
    },
    [navigate, newestSaved, requestFocus],
  );

  const handleNoticeAction = useCallback(
    (kind: NoticeActionKind) => {
      switch (kind) {
        case "retry":
          void (lastOperationRef.current === "submit" ? submit() : saveDraft());
          return;
        case "reload_latest":
        case "check_status":
          // Refreshing re-renders the page props; unsaved edits stay in editor state.
          dispatch({ type: "NOTICE_DISMISSED" });
          router.refresh();
          return;
        case "reload":
          // A full reload picks up a new deployment; beforeunload warns first when answers are unsaved.
          window.location.reload();
          return;
        case "dismiss":
          dispatch({ type: "NOTICE_DISMISSED" });
          return;
        case "sign_in_new_tab":
          // Rendered as a link that opens in a new tab; nothing to do here.
          return;
      }
    },
    [router, saveDraft, submit],
  );

  const selectValue = selection && selection.from === step ? selection.value : step;

  const changeSelection = useCallback((value: string) => {
    setSelection({ from: latestRef.current.step, value });
  }, []);

  const goToSelection = useCallback(() => {
    const next = parseEditorStep(newestSaved().type, selectValue);
    if (next && next !== latestRef.current.step) {
      void navigate(next);
    }
  }, [navigate, newestSaved, selectValue]);

  // Keep the step in the URL from the first render so reload and back/forward return to it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (parseEditorStep(type, url.searchParams.get("section")) === null) {
      window.history.replaceState(null, "", `${applicationStepHref(type, initialStep)}${url.hash}`);
    }
    const hashKey = /^#field-([A-Za-z0-9_]+)$/.exec(url.hash)?.[1];
    if (hashKey) {
      document.getElementById(fieldControlId(hashKey))?.focus();
    }
  }, [initialStep, type]);

  // Back and forward save pending answers (history traversal passes no link guard and fires no beforeunload) and move
  // focus to the section heading.
  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      navSeqRef.current += 1;
      void flush("navigate");
      if (event.state === null && window.location.pathname === ROUTES.portalApplication) {
        // Next.js ignores history entries without its router state, such as one made by a plain fragment link, so the
        // rendered section would lag behind the URL. Replacing the entry through the patched history API re-syncs it.
        window.history.replaceState(null, "", window.location.href);
      }
      const next = parseEditorStep(type, new URL(window.location.href).searchParams.get("section"));
      if (next) {
        dispatch({ type: "FOCUS_REQUESTED", target: { kind: "step", step: next } });
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [flush, type]);

  // Focus requests wait until the requested step is the one on screen.
  useEffect(() => {
    const request = state.focus;
    if (!request || request.token <= handledFocusTokenRef.current) {
      return;
    }
    const { target } = request;
    if (target.kind === "step" && target.step !== step) {
      return;
    }
    if (target.kind === "field") {
      const section = sectionForField(type, target.key);
      if (section && section !== step) {
        return;
      }
    }

    handledFocusTokenRef.current = request.token;
    if (target.kind === "summary") {
      summaryRef.current?.focus();
      return;
    }
    const element = document.getElementById(
      target.kind === "step" ? sectionHeadingId(target.step) : fieldControlId(target.key),
    );
    if (element) {
      element.scrollIntoView({ block: "start" });
      element.focus({ preventScroll: true });
    }
  }, [state.focus, step, type]);

  // A focused notice button disappears when its notice clears (Reload latest, Check status, or a Try again that
  // succeeds) or is replaced by a different notice (a retry that fails another way). Focus then moves to the new
  // notice's first action, or to the section heading, instead of falling back to the page body.
  const previousNoticeRef = useRef(state.notice);
  useEffect(() => {
    const previous = previousNoticeRef.current;
    previousNoticeRef.current = state.notice;
    const active = document.activeElement;
    const focusLost = !active || active === document.body;
    if (!previous || previous === state.notice || !focusLost || phase === "launched" || phase === "locked") {
      return;
    }
    const action = state.notice ? noticeRef.current?.querySelector<HTMLElement>("button, a") : null;
    (action ?? document.getElementById(sectionHeadingId(step)))?.focus();
  }, [phase, state.notice, step]);

  // Launching or locking unmounts the focused editor control, so focus moves to the main landmark, not the body.
  const previousPhaseRef = useRef(phase);
  useEffect(() => {
    const previous = previousPhaseRef.current;
    previousPhaseRef.current = phase;
    if (previous !== phase && (phase === "launched" || phase === "locked")) {
      document.getElementById("main")?.focus();
    }
  }, [phase]);

  // After liftoff, continue to the mission tracker (immediately under reduced motion).
  useEffect(() => {
    if (state.phase !== "launched") {
      return;
    }
    const timer = window.setTimeout(
      () => router.push(portalMissionRoute(type)),
      prefersReducedMotion() ? 0 : LIFTOFF_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [router, state.phase, type]);

  // Warn before closing or reloading the tab while answers are unsaved or a save is in flight.
  const hasUnsavedWork = phase === "editing" && (draft.dirtyKeys.length > 0 || state.saveStatus === "saving");
  useEffect(() => {
    if (!hasUnsavedWork) {
      return;
    }
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedWork]);

  // Leaving the editor without a guarded link, such as browser Back to the portal, still saves pending valid answers.
  // flush reads the latest state through refs, so a save that starts during unmount sends the final edits.
  const flushRef = useRef(flush);
  useLayoutEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    const latest = latestRef;
    const flushOnLeave = flushRef;
    return () => {
      if (latest.current.phase === "editing") {
        void flushOnLeave.current("leave");
      }
    };
  }, []);

  // Internal links and sign-out save pending answers before leaving the editor.
  useEffect(
    () =>
      register({
        isDirty: () => inFlightRef.current !== null || dirtyKeysNow().length > 0,
        flush: async () => (await flush("leave")).outcome,
      }),
    [dirtyKeysNow, flush, register],
  );

  return {
    state,
    saved,
    type,
    step,
    phase,
    values,
    errors,
    dirtyKeys: draft.dirtyKeys,
    saveStatus,
    announcement,
    summaryRef,
    noticeRef,
    selectValue,
    changeField,
    changeSelection,
    goToSelection,
    saveDraft,
    saveAndContinue,
    submit,
    selectStep,
    activateSummaryItem,
    handleNoticeAction,
  };
}
