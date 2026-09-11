import { COPY } from "@/content/copy";
import type { ActionError } from "@/lib/actions/result";
import type { ApplicantApplication } from "@/lib/data/types";
import { noticeForError, type FeedbackCode } from "@/lib/editor/feedback";
import type { EditorStep } from "@/lib/editor/steps";
import { isNewerApplication, uiValueEqual, type UiValue, type UiValues } from "@/lib/editor/values";
import type { SectionCompletion } from "@/lib/validation/completion";
import type { FieldErrors } from "@/lib/validation/errors";
import type { NoticeView, SaveStatusView } from "@/lib/view-models/types";

// =============================================================================
// Application editor state (client-safe, pure).
//
// The state keeps the newest application an action returned (`saved`) and only the answers the user changed since
// (`edits`). Values, dirty keys, and the application to show are derived during render (see selectSaved), so a newer
// revalidated prop never discards unsaved edits and an older prop never replaces a newer action result. Events that
// change nothing return the same state object, unchanged parts keep their references, and inputs are never mutated.
// =============================================================================

/** What started a save. The editor hook uses it to decide what happens once the save settles. */
export type SaveTrigger = "save" | "continue" | "navigate" | "submit" | "leave";

/** Whether the editor accepts saves: only while editing. Launched follows a successful submit. */
export type EditorPhase = "editing" | "submitting" | "launched" | "locked";

/** Where focus should move next: the error summary, a field control, or a step heading. */
export type FocusTarget = { kind: "summary" } | { kind: "field"; key: string } | { kind: "step"; step: EditorStep };

/** A focus request. Every request gets a new token, so repeating a target still moves focus. */
export interface FocusRequest {
  token: number;
  target: FocusTarget;
}

/** Editor state for one application. */
export interface EditorState {
  /** Newest application returned by an action. Props may be newer, so read it through selectSaved. */
  saved: ApplicantApplication;
  /** Only the keys the user changed since they were last saved. */
  edits: UiValues;
  /** Draft-schema errors found in the browser for dirty keys. */
  clientErrors: FieldErrors;
  /** Errors from saveApplication (`validation_failed`) or submitApplication (`application_incomplete`). */
  serverErrors: FieldErrors;
  /** Server validation messages that are not tied to a field. */
  formErrors: string[];
  notice: NoticeView | null;
  saveStatus: "idle" | "saving" | "error";
  phase: EditorPhase;
  /** Section ids completed by the most recent successful save, in form order. */
  justCompleted: string[];
  focus: FocusRequest | null;
  /** Monotonic: the token of the latest focus request, or 0 before the first. */
  focusToken: number;
}

/** Everything the editor container reports to the reducer. */
export type EditorEvent =
  | { type: "FIELD_CHANGED"; key: string; value: UiValue }
  | { type: "SAVE_STARTED"; trigger: SaveTrigger }
  | { type: "CLIENT_INVALID"; fieldErrors: FieldErrors; validated: UiValues; focusSummary: boolean }
  | {
      type: "SAVE_SUCCEEDED";
      application: ApplicantApplication;
      sent: UiValues;
      invalid: FieldErrors;
      validated: UiValues;
    }
  | { type: "SAVE_FAILED"; error: ActionError; focusSummary: boolean }
  | { type: "SAVE_THREW"; kind: "network" | "stale_deployment" }
  | { type: "SUBMIT_STARTED" }
  | { type: "SUBMIT_SUCCEEDED"; application: ApplicantApplication }
  | { type: "SUBMIT_FAILED"; error: ActionError }
  | { type: "SUBMIT_THREW"; kind: "network" | "stale_deployment" }
  | { type: "NOTICE_DISMISSED" }
  | { type: "FOCUS_REQUESTED"; target: FocusTarget };

/** Input for selectSaveStatus. */
export interface SaveStatusInput {
  phase: EditorPhase;
  saveStatus: EditorState["saveStatus"];
  /** Keys whose payload differs from the saved baseline (`buildDraftPatch(...).dirtyKeys`). */
  dirtyKeys: readonly string[];
  /** The displayed errors, usually `selectErrors(state)`. Only errors on dirty keys count. */
  errors: FieldErrors;
  /** `state.clientErrors`. When given, every key with a client error counts, dirty or not. */
  clientErrors?: FieldErrors;
}

type SaveSucceededEvent = Extract<EditorEvent, { type: "SAVE_SUCCEEDED" }>;

// noticeForError uses the feedback code as the notice id.
const CONFLICT_NOTICE_ID: FeedbackCode = "conflict";
const LOCKED_NOTICE_ID: FeedbackCode = "application_locked";

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

// Own properties only, so keys such as "constructor" never resolve to Object.prototype members.
function ownValue<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return hasOwn(record, key) ? record[key] : undefined;
}

function copyUiValue(value: UiValue): UiValue {
  return Array.isArray(value) ? [...value] : value;
}

/** Non-empty string messages, copied. Anything else becomes []. */
function copyMessages(messages: unknown): string[] {
  return Array.isArray(messages)
    ? messages.filter((message): message is string => typeof message === "string" && message !== "")
    : [];
}

/** Keys with at least one message, with copied arrays, so state never aliases an action result. */
function copyFieldErrors(fieldErrors: FieldErrors | undefined): FieldErrors {
  if (typeof fieldErrors !== "object" || fieldErrors === null) {
    return {};
  }
  // Object.fromEntries defines own properties, so a "__proto__" key cannot replace the prototype.
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([key, messages]) => [key, copyMessages(messages)] as const)
      .filter(([, messages]) => messages.length > 0),
  );
}

function hasMessages(fieldErrors: FieldErrors, key: string): boolean {
  return copyMessages(ownValue(fieldErrors, key)).length > 0;
}

function omitKeys<T>(record: Readonly<Record<string, T>>, keys: readonly string[]): Record<string, T> {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !omitted.has(key)));
}

/**
 * Copies the errors whose field still holds the UI value that was validated. An error for a value the user has
 * changed since validation is stale, so it is dropped. An error without a validated value cannot be matched to the
 * field's value, so it is dropped too (otherwise a missing edit and a missing validated value would compare equal).
 */
function errorsForUnchangedValues(fieldErrors: FieldErrors, validated: UiValues, edits: UiValues): FieldErrors {
  return Object.fromEntries(
    Object.entries(copyFieldErrors(fieldErrors)).filter(
      ([key]) => hasOwn(validated, key) && uiValueEqual(ownValue(edits, key), validated[key]),
    ),
  );
}

function stringsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function recordsEqual<T>(
  a: Readonly<Record<string, T>>,
  b: Readonly<Record<string, T>>,
  equal: (left: T, right: T) => boolean,
): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => hasOwn(b, key) && equal(a[key], b[key]));
}

function uiValuesEqual(a: UiValues, b: UiValues): boolean {
  return recordsEqual(a, b, uiValueEqual);
}

function fieldErrorsEqual(a: FieldErrors, b: FieldErrors): boolean {
  return recordsEqual(a, b, stringsEqual);
}

function noticeEqual(a: NoticeView | null, b: NoticeView | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.id === b.id &&
    a.tone === b.tone &&
    a.title === b.title &&
    a.body === b.body &&
    a.actions.length === b.actions.length &&
    a.actions.every((action, index) => {
      const other = b.actions[index];
      return action.kind === other.kind && action.label === other.label && action.href === other.href;
    })
  );
}

function keep<T>(current: T, proposed: T | undefined, equal: (a: T, b: T) => boolean): T {
  return proposed === undefined || equal(current, proposed) ? current : proposed;
}

/**
 * Applies `changes` to `state`. Every part whose content is unchanged keeps its current reference, and `state` itself
 * is returned when nothing changed, so React skips the re-render.
 */
function commit(state: EditorState, changes: Partial<EditorState>): EditorState {
  const next: EditorState = {
    saved: keep(state.saved, changes.saved, Object.is),
    edits: keep(state.edits, changes.edits, uiValuesEqual),
    clientErrors: keep(state.clientErrors, changes.clientErrors, fieldErrorsEqual),
    serverErrors: keep(state.serverErrors, changes.serverErrors, fieldErrorsEqual),
    formErrors: keep(state.formErrors, changes.formErrors, stringsEqual),
    notice: keep(state.notice, changes.notice, noticeEqual),
    saveStatus: keep(state.saveStatus, changes.saveStatus, Object.is),
    phase: keep(state.phase, changes.phase, Object.is),
    justCompleted: keep(state.justCompleted, changes.justCompleted, stringsEqual),
    focus: keep(state.focus, changes.focus, Object.is),
    focusToken: keep(state.focusToken, changes.focusToken, Object.is),
  };
  const changed = (Object.keys(next) as (keyof EditorState)[]).some((key) => next[key] !== state[key]);
  return changed ? next : state;
}

function focusOn(state: EditorState, target: FocusTarget): Pick<EditorState, "focus" | "focusToken"> {
  const token = state.focusToken + 1;
  return { focus: { token, target }, focusToken: token };
}

function summaryFocus(state: EditorState, requested: boolean): Partial<EditorState> {
  return requested ? focusOn(state, { kind: "summary" }) : {};
}

// noticeForError has no notice for application_incomplete; a failure that reaches a notice must still show one.
function noticeFor(code: FeedbackCode): NoticeView | null {
  return noticeForError(code) ?? noticeForError("unexpected_error");
}

function completedSectionIds(application: ApplicantApplication): string[] {
  const sections: readonly SectionCompletion[] = application.completion.sections;
  return sections.filter((section) => section.status === "complete").map((section) => section.id);
}

function newlyCompletedSections(previous: ApplicantApplication, next: ApplicantApplication): string[] {
  const completedBefore = new Set(completedSectionIds(previous));
  return completedSectionIds(next).filter((id) => !completedBefore.has(id));
}

function saveSucceeded(state: EditorState, event: SaveSucceededEvent): EditorState {
  const adopted = isNewerApplication(event.application, state.saved);
  // An edit typed while the request was in flight differs from the value sent, so it survives the rebase.
  const edits = Object.fromEntries(
    Object.entries(state.edits).filter(
      ([key, value]) => !hasOwn(event.sent, key) || !uiValueEqual(value, event.sent[key]),
    ),
  );

  return commit(state, {
    saved: adopted ? event.application : state.saved,
    edits,
    serverErrors: omitKeys(state.serverErrors, Object.keys(event.sent)),
    clientErrors: errorsForUnchangedValues(event.invalid, event.validated, edits),
    formErrors: [],
    // An older result changes nothing on screen, so no section was just completed.
    justCompleted: adopted ? newlyCompletedSections(state.saved, event.application) : [],
    saveStatus: "idle",
    notice: state.notice?.id === LOCKED_NOTICE_ID ? state.notice : null,
  });
}

function saveFailed(state: EditorState, error: ActionError, focusSummary: boolean): EditorState {
  switch (error.code) {
    case "validation_failed": {
      const fieldErrors = copyFieldErrors(error.fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        return commit(state, { notice: noticeFor("validation_failed"), saveStatus: "error" });
      }
      return commit(state, {
        serverErrors: { ...state.serverErrors, ...fieldErrors },
        formErrors: copyMessages(error.formErrors),
        saveStatus: "error",
        ...summaryFocus(state, focusSummary),
      });
    }
    case "application_locked":
      return commit(state, { phase: "locked", notice: noticeFor("application_locked"), saveStatus: "idle" });
    default:
      return commit(state, { notice: noticeFor(error.code), saveStatus: "error" });
  }
}

function submitFailed(state: EditorState, error: ActionError): EditorState {
  switch (error.code) {
    case "application_incomplete": {
      const fieldErrors = copyFieldErrors(error.fieldErrors);
      const formErrors = copyMessages(error.formErrors);
      if (Object.keys(fieldErrors).length === 0 && formErrors.length === 0) {
        // An empty error summary would hide the failure, so a notice reports it instead.
        return commit(state, {
          serverErrors: {},
          formErrors: [],
          phase: "editing",
          notice: noticeFor("unexpected_error"),
        });
      }
      return commit(state, {
        serverErrors: fieldErrors,
        formErrors,
        phase: "editing",
        ...focusOn(state, { kind: "summary" }),
      });
    }
    case "application_locked":
      return commit(state, { phase: "locked", notice: noticeFor("application_locked") });
    default:
      return commit(state, { phase: "editing", notice: noticeFor(error.code) });
  }
}

// Typing `event` as never makes a new EditorEvent variant fail typecheck; an unknown runtime event changes nothing.
function ignoreUnknownEvent(state: EditorState, event: never): EditorState {
  void event;
  return state;
}

/**
 * Initial editor state: nothing edited, no errors or notice, and the `locked` phase when the application can no
 * longer be edited (`isEditable` is false).
 */
export function initEditorState(application: ApplicantApplication): EditorState {
  return {
    saved: application,
    edits: {},
    clientErrors: {},
    serverErrors: {},
    formErrors: [],
    notice: null,
    saveStatus: "idle",
    phase: application.isEditable ? "editing" : "locked",
    justCompleted: [],
    focus: null,
    focusToken: 0,
  };
}

/**
 * Applies one editor event.
 * - FIELD_CHANGED sets the edit, clears that key's client and server errors, and clears a conflict notice.
 * - SAVE_SUCCEEDED adopts a newer application, drops only the edits that still equal what was sent, clears server
 *   errors for sent keys, keeps client errors only for values unchanged since validation, and lists newly completed
 *   sections.
 * - `application_locked` locks the editor on save or submit. `application_incomplete` replaces the server errors and
 *   focuses the error summary. Other failures show the notice from noticeForError.
 * - A thrown submit may still have reached the server, so its network notice asks the user to check the status.
 * - Every focus request increments `focusToken`.
 */
export function editorReducer(state: EditorState, event: EditorEvent): EditorState {
  switch (event.type) {
    case "FIELD_CHANGED":
      return commit(state, {
        edits: { ...state.edits, [event.key]: copyUiValue(event.value) },
        clientErrors: omitKeys(state.clientErrors, [event.key]),
        serverErrors: omitKeys(state.serverErrors, [event.key]),
        notice: state.notice?.id === CONFLICT_NOTICE_ID ? null : state.notice,
      });
    case "SAVE_STARTED":
      return commit(state, { saveStatus: "saving" });
    case "CLIENT_INVALID":
      return commit(state, {
        clientErrors: {
          ...state.clientErrors,
          ...errorsForUnchangedValues(event.fieldErrors, event.validated, state.edits),
        },
        saveStatus: "idle",
        ...summaryFocus(state, event.focusSummary),
      });
    case "SAVE_SUCCEEDED":
      return saveSucceeded(state, event);
    case "SAVE_FAILED":
      return saveFailed(state, event.error, event.focusSummary);
    case "SAVE_THREW":
      return commit(state, { notice: noticeFor(event.kind), saveStatus: "error" });
    case "SUBMIT_STARTED":
      return commit(state, { phase: "submitting", notice: null });
    case "SUBMIT_SUCCEEDED":
      return commit(state, {
        saved: event.application,
        phase: "launched",
        edits: {},
        clientErrors: {},
        serverErrors: {},
        formErrors: [],
      });
    case "SUBMIT_FAILED":
      return submitFailed(state, event.error);
    case "SUBMIT_THREW":
      return commit(state, {
        phase: "editing",
        notice: noticeFor(event.kind === "network" ? "unconfirmed_submit" : "stale_deployment"),
      });
    case "NOTICE_DISMISSED":
      return commit(state, { notice: null });
    case "FOCUS_REQUESTED":
      return commit(state, focusOn(state, event.target));
    default:
      return ignoreUnknownEvent(state, event);
  }
}

/**
 * The application to show: the props application when it is strictly newer than the newest action result (for
 * example after revalidation), otherwise `state.saved`.
 */
export function selectSaved(state: EditorState, propsApplication: ApplicantApplication): ApplicantApplication {
  return isNewerApplication(propsApplication, state.saved) ? propsApplication : state.saved;
}

/**
 * The errors to display: server errors, overridden per key by client errors. Returns one of the state's own records
 * when the other is empty, so treat the result as read-only.
 */
export function selectErrors(state: EditorState): FieldErrors {
  if (Object.keys(state.clientErrors).length === 0) {
    return state.serverErrors;
  }
  if (Object.keys(state.serverErrors).length === 0) {
    return state.clientErrors;
  }
  return { ...state.serverErrors, ...state.clientErrors };
}

/**
 * The save status, by priority:
 * 1. `blocked` when locked or launched.
 * 2. `saving`.
 * 3. `error`.
 * 4. `invalid` when any dirty key has an error or any key has a client error. The count is the number of distinct
 *    such keys.
 * 5. `dirty`.
 * 6. `saved`.
 * Text comes from `COPY.editor.saveStatus`.
 */
export function selectSaveStatus(input: SaveStatusInput): SaveStatusView {
  const text = COPY.editor.saveStatus;
  if (input.phase === "locked" || input.phase === "launched") {
    return { state: "blocked", text: text.blocked };
  }
  if (input.saveStatus === "saving") {
    return { state: "saving", text: text.saving };
  }
  if (input.saveStatus === "error") {
    return { state: "error", text: text.error };
  }

  const clientErrors = input.clientErrors ?? {};
  const needsAttention = new Set([
    ...input.dirtyKeys.filter((key) => hasMessages(input.errors, key)),
    ...Object.keys(clientErrors).filter((key) => hasMessages(clientErrors, key)),
  ]);
  if (needsAttention.size > 0) {
    return { state: "invalid", text: text.invalid(needsAttention.size) };
  }
  if (input.dirtyKeys.length > 0) {
    return { state: "dirty", text: text.dirty };
  }
  return { state: "saved", text: text.saved };
}
