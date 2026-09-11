import { describe, expect, it } from "vitest";

import { COPY } from "@/content/copy";
import { ACTION_ERROR_MESSAGES, type ActionError, type ActionErrorCode } from "@/lib/actions/result";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationStatus } from "@/lib/domain/enums";
import { deriveMissionState } from "@/lib/domain/mission";
import { noticeForError } from "@/lib/editor/feedback";
import {
  editorReducer,
  initEditorState,
  selectErrors,
  selectSaved,
  selectSaveStatus,
  type EditorEvent,
  type EditorState,
  type SaveStatusInput,
} from "@/lib/editor/reducer";
import { buildDraftPatch, toUiValues, type DraftPatch, type UiValue } from "@/lib/editor/values";
import { calculateApplicationCompletion, type SectionCompletion } from "@/lib/validation/completion";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";

type HackerResponses = ApplicantApplication<"hacker">["responses"];
type JudgeResponses = ApplicantApplication<"judge">["responses"];

const T0 = "2026-09-01T10:00:00.000Z";
const T1 = "2026-09-01T10:05:00.000Z";
const T2 = "2026-09-01T10:10:00.000Z";
const GRADUATION_YEAR_MESSAGE = "Enter a whole number from 2000 to 2040.";
const TEXT = COPY.editor.saveStatus;

// Partial drafts are built inline so these tests control exactly which sections are complete.
/** About in progress: birthdate and city are missing. */
const ABOUT_STARTED: HackerResponses = { fullName: "Partial Hacker", countryOfResidence: "US" };
/** About complete; every later section untouched. */
const ABOUT_DONE: HackerResponses = {
  ...ABOUT_STARTED,
  birthdate: "2006-01-20",
  cityOfResidence: "Berkeley",
};
/** About and Education complete; every later section untouched. */
const EDUCATION_DONE: HackerResponses = {
  ...ABOUT_DONE,
  school: "Example University",
  major: "Computer Science",
  graduationYear: 2027,
};

interface ApplicationOptions {
  status?: ApplicationStatus;
  updatedAt?: string;
}

function workflowFields({ status = "draft", updatedAt = T0 }: ApplicationOptions) {
  const launchedAt = status === "draft" ? null : T0;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    referenceNumber: 1042,
    status,
    launchedAt,
    reviewStartedAt: null,
    decisionReleasedAt: null,
    createdAt: T0,
    updatedAt,
    mission: deriveMissionState({
      status,
      launched_at: launchedAt,
      review_started_at: null,
      decision_released_at: null,
    }),
    isEditable: status === "draft",
  };
}

function hackerApplication(
  responses: HackerResponses,
  options: ApplicationOptions = {},
): ApplicantApplication<"hacker"> {
  const completion = calculateApplicationCompletion("hacker", responses);
  return {
    ...workflowFields(options),
    applicantReference: "H-1042",
    type: "hacker",
    completionPercent: completion.percent,
    responses,
    completion,
  };
}

function judgeApplication(
  responses: JudgeResponses,
  options: ApplicationOptions = {},
): ApplicantApplication<"judge"> {
  const completion = calculateApplicationCompletion("judge", responses);
  return {
    ...workflowFields(options),
    applicantReference: "J-1042",
    type: "judge",
    completionPercent: completion.percent,
    responses,
    completion,
  };
}

function sectionStatuses(application: ApplicantApplication): Record<string, SectionCompletion["status"]> {
  const sections: readonly SectionCompletion[] = application.completion.sections;
  return Object.fromEntries(sections.map((section) => [section.id, section.status]));
}

function reduce(state: EditorState, ...events: EditorEvent[]): EditorState {
  return events.reduce(editorReducer, state);
}

function changed(key: string, value: UiValue): EditorEvent {
  return { type: "FIELD_CHANGED", key, value };
}

function failure(code: ActionErrorCode, details: Omit<Partial<ActionError>, "code"> = {}): ActionError {
  return { code, message: ACTION_ERROR_MESSAGES[code], ...details };
}

/** The partial save the editor hook would send for the state's current values. */
function draftFor(state: EditorState): DraftPatch {
  const baseline = toUiValues(state.saved.type, state.saved.responses);
  return buildDraftPatch(state.saved.type, baseline, { ...baseline, ...state.edits });
}

function saveSucceeded(application: ApplicantApplication, draft?: DraftPatch): EditorEvent {
  return {
    type: "SAVE_SUCCEEDED",
    application,
    sent: draft?.sent ?? {},
    invalid: draft?.invalid ?? {},
    validated: draft?.validated ?? {},
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

describe("initEditorState", () => {
  it("starts an editable draft in the editing phase with nothing pending", () => {
    const application = hackerApplication(ABOUT_STARTED);
    const state = initEditorState(application);

    expect(state).toEqual({
      saved: application,
      edits: {},
      clientErrors: {},
      serverErrors: {},
      formErrors: [],
      notice: null,
      saveStatus: "idle",
      phase: "editing",
      justCompleted: [],
      focus: null,
      focusToken: 0,
    });
    expect(state.saved).toBe(application);
  });

  it("starts in the locked phase when the application is not editable", () => {
    expect(initEditorState(hackerApplication(validHackerResponses, { status: "submitted" })).phase).toBe("locked");
    expect(initEditorState(judgeApplication(validJudgeResponses, { status: "waitlisted" })).phase).toBe("locked");
    // isEditable is the source of truth, not the status.
    expect(initEditorState({ ...hackerApplication(ABOUT_DONE), isEditable: false }).phase).toBe("locked");
  });
});

describe("FIELD_CHANGED", () => {
  const base = initEditorState(hackerApplication({}));

  it("records the edit and clears only that field's client and server errors", () => {
    const state: EditorState = {
      ...base,
      clientErrors: { graduationYear: [GRADUATION_YEAR_MESSAGE], previousHackathonCount: ["Too many."] },
      serverErrors: { graduationYear: ["Server message."], school: ["This field is required."] },
    };
    const next = editorReducer(state, changed("graduationYear", "2027"));

    expect(next.edits).toEqual({ graduationYear: "2027" });
    expect(next.clientErrors).toEqual({ previousHackathonCount: ["Too many."] });
    expect(next.serverErrors).toEqual({ school: ["This field is required."] });
  });

  it("keeps the references of error records it does not change", () => {
    const state: EditorState = { ...base, serverErrors: { school: ["This field is required."] } };
    const next = editorReducer(state, changed("major", "Computer Science"));

    expect(next.serverErrors).toBe(state.serverErrors);
    expect(next.clientErrors).toBe(state.clientErrors);
  });

  it("clears a conflict notice but keeps other notices", () => {
    const change = changed("school", "Example University");
    expect(editorReducer({ ...base, notice: noticeForError("conflict") }, change).notice).toBeNull();

    for (const code of ["network", "application_locked", "unauthenticated"] as const) {
      const notice = noticeForError(code);
      expect(editorReducer({ ...base, notice }, change).notice, code).toBe(notice);
    }
  });

  it("copies array values so later changes to the dispatched array do not leak into state", () => {
    const skills = ["web"];
    const next = editorReducer(base, changed("skills", skills));
    skills.push("ai_ml");

    expect(next.edits.skills).toEqual(["web"]);
  });

  it("returns the same state when the value is already the edit and nothing needs clearing", () => {
    const state = editorReducer(base, changed("skills", ["web"]));
    expect(editorReducer(state, changed("skills", ["web"]))).toBe(state);
  });
});

describe("SAVE_STARTED", () => {
  it("marks the save in flight and ignores a repeat", () => {
    const state = editorReducer(initEditorState(hackerApplication({})), { type: "SAVE_STARTED", trigger: "save" });

    expect(state.saveStatus).toBe("saving");
    expect(editorReducer(state, { type: "SAVE_STARTED", trigger: "continue" })).toBe(state);
  });
});

describe("CLIENT_INVALID", () => {
  const base = initEditorState(hackerApplication({}));

  it("merges client errors, returns to idle, and focuses the summary when asked", () => {
    const edited: EditorState = {
      ...reduce(base, changed("graduationYear", "1900"), { type: "SAVE_STARTED", trigger: "continue" }),
      clientErrors: { previousHackathonCount: ["Enter a whole number."] },
    };
    const draft = draftFor(edited);
    expect(draft.patch).toEqual({});
    expect(draft.invalid).toEqual({ graduationYear: [GRADUATION_YEAR_MESSAGE] });

    const event: EditorEvent = {
      type: "CLIENT_INVALID",
      fieldErrors: draft.invalid,
      validated: draft.validated,
      focusSummary: true,
    };
    const next = editorReducer(edited, event);

    expect(next.clientErrors).toEqual({
      previousHackathonCount: ["Enter a whole number."],
      graduationYear: [GRADUATION_YEAR_MESSAGE],
    });
    expect(next.clientErrors.graduationYear).not.toBe(draft.invalid.graduationYear);
    expect(next.saveStatus).toBe("idle");
    expect(next.focus).toEqual({ token: 1, target: { kind: "summary" } });
    expect(next.focusToken).toBe(1);

    const quiet = editorReducer(edited, { ...event, focusSummary: false });
    expect(quiet.focus).toBeNull();
    expect(quiet.focusToken).toBe(0);
  });

  it("skips errors for values the user changed after validation", () => {
    const edited = editorReducer(base, changed("graduationYear", "1900"));
    const draft = draftFor(edited);
    const retyped = editorReducer(edited, changed("graduationYear", "2027"));

    const next = editorReducer(retyped, {
      type: "CLIENT_INVALID",
      fieldErrors: draft.invalid,
      validated: draft.validated,
      focusSummary: false,
    });

    expect(next.clientErrors).toEqual({});
    expect(next).toBe(retyped);
  });

  it("skips errors that arrive without the value they validated", () => {
    // Neither edits nor validated holds graduationYear, so the error cannot be matched to the field's value.
    const next = editorReducer(base, {
      type: "CLIENT_INVALID",
      fieldErrors: { graduationYear: [GRADUATION_YEAR_MESSAGE] },
      validated: {},
      focusSummary: false,
    });

    expect(next.clientErrors).toEqual({});
    expect(next).toBe(base);
  });

  it("feeds the invalid save status", () => {
    const edited = editorReducer(base, changed("graduationYear", "1900"));
    const draft = draftFor(edited);
    const state = editorReducer(edited, {
      type: "CLIENT_INVALID",
      fieldErrors: draft.invalid,
      validated: draft.validated,
      focusSummary: true,
    });

    expect(
      selectSaveStatus({
        phase: state.phase,
        saveStatus: state.saveStatus,
        dirtyKeys: draft.dirtyKeys,
        errors: selectErrors(state),
        clientErrors: state.clientErrors,
      }),
    ).toEqual({ state: "invalid", text: TEXT.invalid(1) });
  });
});

describe("SAVE_SUCCEEDED", () => {
  it("drops edits that still equal what was sent and keeps edits typed during the save", () => {
    const initial = initEditorState(hackerApplication({}, { updatedAt: T0 }));
    const edited = reduce(
      initial,
      changed("fullName", "Partial Hacker"),
      changed("cityOfResidence", "Berkeley"),
      changed("skills", ["web"]),
    );
    const draft = draftFor(edited);
    expect(Object.keys(draft.sent).sort()).toEqual(["cityOfResidence", "fullName", "skills"]);

    const inFlight = reduce(
      edited,
      { type: "SAVE_STARTED", trigger: "save" },
      changed("cityOfResidence", "Berkeley, CA"),
      changed("bio", "Student builder."),
    );
    const application = hackerApplication(
      { fullName: "Partial Hacker", cityOfResidence: "Berkeley", skills: ["web"] },
      { updatedAt: T1 },
    );
    const next = editorReducer(inFlight, saveSucceeded(application, draft));

    expect(next.saved).toBe(application);
    expect(next.edits).toEqual({ cityOfResidence: "Berkeley, CA", bio: "Student builder." });
    expect(next.saveStatus).toBe("idle");
  });

  it("clears server errors only for the keys the save sent", () => {
    const edited: EditorState = {
      ...editorReducer(initEditorState(hackerApplication({})), changed("school", "Example University")),
      serverErrors: { school: ["Server school message."], proudProject: ["This field is required."] },
    };
    const draft = draftFor(edited);
    expect(draft.sent).toEqual({ school: "Example University" });

    const next = editorReducer(
      edited,
      saveSucceeded(hackerApplication({ school: "Example University" }, { updatedAt: T1 }), draft),
    );

    expect(next.serverErrors).toEqual({ proudProject: ["This field is required."] });
  });

  it("rebuilds client errors from invalid keys whose values are unchanged since validation", () => {
    const edited: EditorState = {
      ...reduce(
        initEditorState(hackerApplication({})),
        changed("graduationYear", "1900"),
        changed("previousHackathonCount", "-1"),
        changed("school", "Example University"),
      ),
      // An old client error for a key this save does not cover.
      clientErrors: { major: ["Stale message."] },
    };
    const draft = draftFor(edited);
    expect(Object.keys(draft.invalid).sort()).toEqual(["graduationYear", "previousHackathonCount"]);

    const inFlight = reduce(edited, { type: "SAVE_STARTED", trigger: "save" }, changed("previousHackathonCount", "3"));
    const next = editorReducer(
      inFlight,
      saveSucceeded(hackerApplication({ school: "Example University" }, { updatedAt: T1 }), draft),
    );

    expect(next.clientErrors).toEqual({ graduationYear: [GRADUATION_YEAR_MESSAGE] });
    expect(next.edits).toEqual({ graduationYear: "1900", previousHackathonCount: "3" });
  });

  it("drops invalid keys that have no validated value", () => {
    const edited = editorReducer(initEditorState(hackerApplication({})), changed("school", "Example University"));
    const draft = draftFor(edited);
    const next = editorReducer(
      edited,
      saveSucceeded(hackerApplication({ school: "Example University" }, { updatedAt: T1 }), {
        ...draft,
        // An error for a key the user never edited and the save never validated.
        invalid: { graduationYear: [GRADUATION_YEAR_MESSAGE] },
        validated: {},
      }),
    );

    expect(next.edits).toEqual({});
    expect(next.clientErrors).toEqual({});
  });

  it("lists the sections the save completed, in form order", () => {
    const previous = hackerApplication(ABOUT_STARTED, { updatedAt: T0 });
    const application = hackerApplication(EDUCATION_DONE, { updatedAt: T1 });
    expect(sectionStatuses(previous)).toMatchObject({ about: "in_progress", education: "not_started" });
    expect(sectionStatuses(application)).toMatchObject({
      about: "complete",
      education: "complete",
      experience: "not_started",
    });

    expect(editorReducer(initEditorState(previous), saveSucceeded(application)).justCompleted).toEqual([
      "about",
      "education",
    ]);
  });

  it("does not list sections that were already complete", () => {
    const previous = hackerApplication(ABOUT_DONE, { updatedAt: T0 });
    const once = editorReducer(
      initEditorState(previous),
      saveSucceeded(hackerApplication(EDUCATION_DONE, { updatedAt: T1 })),
    );
    expect(once.justCompleted).toEqual(["education"]);

    const twice = editorReducer(
      once,
      saveSucceeded(hackerApplication({ ...EDUCATION_DONE, experienceLevel: "beginner" }, { updatedAt: T2 })),
    );
    expect(twice.justCompleted).toEqual([]);
  });

  it("computes completed sections for judge applications", () => {
    const previous = judgeApplication({ ...validJudgeResponses, motivation: undefined }, { updatedAt: T0 });
    const application = judgeApplication(validJudgeResponses, { updatedAt: T1 });
    expect(sectionStatuses(previous).short_answers).toBe("in_progress");

    expect(editorReducer(initEditorState(previous), saveSucceeded(application)).justCompleted).toEqual([
      "short_answers",
    ]);
  });

  it("keeps a newer saved application when the save returns an older one", () => {
    const newer = hackerApplication(ABOUT_STARTED, { updatedAt: T2 });
    const next = editorReducer(
      initEditorState(newer),
      saveSucceeded(hackerApplication(EDUCATION_DONE, { updatedAt: T1 })),
    );

    expect(next.saved).toBe(newer);
    expect(next.justCompleted).toEqual([]);
  });

  it("clears form errors and notices except the locked notice", () => {
    const application = hackerApplication(ABOUT_DONE, { updatedAt: T1 });
    const state: EditorState = {
      ...initEditorState(hackerApplication({}, { updatedAt: T0 })),
      formErrors: ["Invalid input."],
      notice: noticeForError("network"),
      saveStatus: "saving",
    };
    const next = editorReducer(state, saveSucceeded(application));

    expect(next.formErrors).toEqual([]);
    expect(next.notice).toBeNull();
    expect(next.saveStatus).toBe("idle");

    const locked = noticeForError("application_locked");
    expect(editorReducer({ ...state, notice: locked }, saveSucceeded(application)).notice).toBe(locked);
  });

  it("returns the same state when the save changed nothing", () => {
    const state = initEditorState(hackerApplication(ABOUT_DONE));
    expect(editorReducer(state, saveSucceeded(state.saved))).toBe(state);
  });
});

describe("SAVE_FAILED", () => {
  const saving = reduce(initEditorState(hackerApplication({})), { type: "SAVE_STARTED", trigger: "continue" });

  it("merges validation errors into server errors and focuses the summary when asked", () => {
    const state: EditorState = { ...saving, serverErrors: { school: ["Old message."], major: ["Kept message."] } };
    const error = failure("validation_failed", {
      fieldErrors: { school: ["New school message."], bio: ["Bio message."] },
      formErrors: ["Form message."],
    });
    const next = editorReducer(state, { type: "SAVE_FAILED", error, focusSummary: true });

    expect(next.serverErrors).toEqual({
      school: ["New school message."],
      major: ["Kept message."],
      bio: ["Bio message."],
    });
    expect(next.serverErrors.school).not.toBe(error.fieldErrors?.school);
    expect(next.formErrors).toEqual(["Form message."]);
    expect(next.saveStatus).toBe("error");
    expect(next.notice).toBeNull();
    expect(next.focus).toEqual({ token: 1, target: { kind: "summary" } });

    const quiet = editorReducer(state, { type: "SAVE_FAILED", error, focusSummary: false });
    expect(quiet.serverErrors).toEqual(next.serverErrors);
    expect(quiet.focus).toBeNull();
    expect(quiet.focusToken).toBe(0);
  });

  it("shows the validation notice when the failure has no field details", () => {
    const state: EditorState = { ...saving, serverErrors: { school: ["This field is required."] } };
    for (const error of [
      failure("validation_failed"),
      failure("validation_failed", { fieldErrors: {} }),
      failure("validation_failed", { fieldErrors: { school: [] } }),
    ]) {
      const next = editorReducer(state, { type: "SAVE_FAILED", error, focusSummary: true });
      expect(next.notice).toEqual(noticeForError("validation_failed"));
      expect(next.saveStatus).toBe("error");
      expect(next.serverErrors).toBe(state.serverErrors);
      expect(next.focus).toBeNull();
    }
  });

  it("locks the editor when the application can no longer be edited", () => {
    const next = editorReducer(saving, {
      type: "SAVE_FAILED",
      error: failure("application_locked"),
      focusSummary: true,
    });

    expect(next.phase).toBe("locked");
    expect(next.notice).toEqual(noticeForError("application_locked"));
    expect(next.saveStatus).toBe("idle");
    expect(next.focus).toBeNull();
  });

  it.each(["conflict", "unauthenticated", "not_found", "forbidden", "rate_limited", "unexpected_error"] as const)(
    "shows the %s notice",
    (code) => {
      const next = editorReducer(saving, { type: "SAVE_FAILED", error: failure(code), focusSummary: true });

      expect(next.notice).toEqual(noticeForError(code));
      expect(next.saveStatus).toBe("error");
      expect(next.phase).toBe("editing");
      expect(next.focus).toBeNull();
    },
  );
});

describe("SAVE_THREW", () => {
  it.each(["network", "stale_deployment"] as const)("shows the %s notice", (kind) => {
    const saving = reduce(initEditorState(hackerApplication({})), { type: "SAVE_STARTED", trigger: "save" });
    const next = editorReducer(saving, { type: "SAVE_THREW", kind });

    expect(next.notice).toEqual(noticeForError(kind));
    expect(next.saveStatus).toBe("error");
    expect(next.phase).toBe("editing");
  });
});

describe("submitting", () => {
  const draft = hackerApplication(validHackerResponses, { updatedAt: T0 });

  it("SUBMIT_STARTED moves to submitting and clears the notice", () => {
    const next = editorReducer(
      { ...initEditorState(draft), notice: noticeForError("network") },
      { type: "SUBMIT_STARTED" },
    );

    expect(next.phase).toBe("submitting");
    expect(next.notice).toBeNull();
  });

  it("SUBMIT_SUCCEEDED adopts the application, launches, and clears edits and errors", () => {
    const submitted = hackerApplication(validHackerResponses, { status: "submitted", updatedAt: T1 });
    const state: EditorState = {
      ...reduce(initEditorState(draft), changed("bio", "Changed."), { type: "SUBMIT_STARTED" }),
      clientErrors: { graduationYear: [GRADUATION_YEAR_MESSAGE] },
      serverErrors: { proudProject: ["This field is required."] },
      formErrors: ["Form message."],
    };
    const next = editorReducer(state, { type: "SUBMIT_SUCCEEDED", application: submitted });

    expect(next.saved).toBe(submitted);
    expect(next.phase).toBe("launched");
    expect(next.edits).toEqual({});
    expect(next.clientErrors).toEqual({});
    expect(next.serverErrors).toEqual({});
    expect(next.formErrors).toEqual([]);
  });

  it("application_incomplete replaces server errors and focuses the summary", () => {
    const incomplete = hackerApplication(ABOUT_DONE, { updatedAt: T0 });
    const { fieldErrors } = incomplete.completion;
    expect(Object.keys(fieldErrors).length).toBeGreaterThan(0);

    const state: EditorState = {
      ...reduce(initEditorState(incomplete), { type: "SUBMIT_STARTED" }),
      serverErrors: { fullName: ["Old message."] },
      formErrors: ["Old form message."],
    };
    const error = failure("application_incomplete", { fieldErrors, formErrors: ["Form message."] });
    const next = editorReducer(state, { type: "SUBMIT_FAILED", error });

    expect(next.serverErrors).toEqual(fieldErrors);
    expect(next.serverErrors).not.toHaveProperty("fullName");
    expect(next.serverErrors).not.toBe(fieldErrors);
    expect(next.formErrors).toEqual(["Form message."]);
    expect(next.phase).toBe("editing");
    expect(next.notice).toBeNull();
    expect(next.focus).toEqual({ token: 1, target: { kind: "summary" } });

    const withoutFormErrors = editorReducer(state, {
      type: "SUBMIT_FAILED",
      error: failure("application_incomplete", { fieldErrors }),
    });
    expect(withoutFormErrors.formErrors).toEqual([]);
  });

  it("application_incomplete without details shows a notice instead of an empty summary", () => {
    const state = reduce(initEditorState(draft), { type: "SUBMIT_STARTED" });
    const next = editorReducer(state, { type: "SUBMIT_FAILED", error: failure("application_incomplete") });

    expect(next.phase).toBe("editing");
    expect(next.notice).toEqual(noticeForError("unexpected_error"));
    expect(next.focus).toBeNull();
  });

  it("application_locked locks the editor with the locked notice", () => {
    const state = reduce(initEditorState(draft), { type: "SUBMIT_STARTED" });
    const next = editorReducer(state, { type: "SUBMIT_FAILED", error: failure("application_locked") });

    expect(next.phase).toBe("locked");
    expect(next.notice).toEqual(noticeForError("application_locked"));
  });

  it.each(["conflict", "unauthenticated", "rate_limited", "unexpected_error"] as const)(
    "%s returns to editing with its notice",
    (code) => {
      const state = reduce(initEditorState(draft), { type: "SUBMIT_STARTED" });
      const next = editorReducer(state, { type: "SUBMIT_FAILED", error: failure(code) });

      expect(next.phase).toBe("editing");
      expect(next.notice).toEqual(noticeForError(code));
      expect(next.focus).toBeNull();
    },
  );

  it("SUBMIT_THREW returns to editing with the unconfirmed or stale deployment notice", () => {
    const state = reduce(initEditorState(draft), { type: "SUBMIT_STARTED" });

    const network = editorReducer(state, { type: "SUBMIT_THREW", kind: "network" });
    expect(network.phase).toBe("editing");
    expect(network.notice).toEqual(noticeForError("unconfirmed_submit"));

    const stale = editorReducer(state, { type: "SUBMIT_THREW", kind: "stale_deployment" });
    expect(stale.phase).toBe("editing");
    expect(stale.notice).toEqual(noticeForError("stale_deployment"));
  });
});

describe("NOTICE_DISMISSED", () => {
  it("clears the notice and ignores a repeat", () => {
    const state = editorReducer(
      { ...initEditorState(hackerApplication({})), notice: noticeForError("conflict") },
      { type: "NOTICE_DISMISSED" },
    );

    expect(state.notice).toBeNull();
    expect(editorReducer(state, { type: "NOTICE_DISMISSED" })).toBe(state);
  });
});

describe("focus requests", () => {
  it("issue a new, increasing token for every request across events", () => {
    const events: EditorEvent[] = [
      { type: "FOCUS_REQUESTED", target: { kind: "step", step: "education" } },
      { type: "CLIENT_INVALID", fieldErrors: {}, validated: {}, focusSummary: true },
      { type: "FOCUS_REQUESTED", target: { kind: "field", key: "school" } },
      {
        type: "SAVE_FAILED",
        error: failure("validation_failed", { fieldErrors: { school: ["Server message."] } }),
        focusSummary: true,
      },
      { type: "SUBMIT_FAILED", error: failure("application_incomplete", { fieldErrors: { school: ["Required."] } }) },
      { type: "FOCUS_REQUESTED", target: { kind: "step", step: "education" } },
    ];

    let state = initEditorState(hackerApplication({}));
    const tokens: number[] = [];
    for (const event of events) {
      state = editorReducer(state, event);
      tokens.push(state.focusToken);
      expect(state.focus?.token).toBe(state.focusToken);
    }

    expect(tokens).toEqual([1, 2, 3, 4, 5, 6]);
    expect(state.focus).toEqual({ token: 6, target: { kind: "step", step: "education" } });
  });

  it("are left untouched by events that do not request focus", () => {
    const state = editorReducer(initEditorState(hackerApplication({})), {
      type: "FOCUS_REQUESTED",
      target: { kind: "field", key: "school" },
    });
    const next = reduce(state, changed("school", "Example University"), { type: "SAVE_STARTED", trigger: "save" });

    expect(next.focus).toBe(state.focus);
    expect(next.focusToken).toBe(1);
  });
});

describe("editorReducer purity", () => {
  it("returns the same state for events that change nothing", () => {
    const state = reduce(initEditorState(hackerApplication({})), changed("school", "Example University"), {
      type: "SAVE_STARTED",
      trigger: "save",
    });

    expect(editorReducer(state, changed("school", "Example University"))).toBe(state);
    expect(editorReducer(state, { type: "SAVE_STARTED", trigger: "navigate" })).toBe(state);
    expect(editorReducer(state, { type: "NOTICE_DISMISSED" })).toBe(state);
    expect(editorReducer(state, { type: "UNKNOWN" } as unknown as EditorEvent)).toBe(state);

    const threw = editorReducer(state, { type: "SAVE_THREW", kind: "network" });
    expect(editorReducer(threw, { type: "SAVE_THREW", kind: "network" })).toBe(threw);

    const lockedFailure: EditorEvent = {
      type: "SAVE_FAILED",
      error: failure("application_locked"),
      focusSummary: false,
    };
    const locked = editorReducer(state, lockedFailure);
    expect(editorReducer(locked, lockedFailure)).toBe(locked);
  });

  it("never mutates frozen state or event payloads", () => {
    const saved = hackerApplication(ABOUT_STARTED, { updatedAt: T0 });
    const application = hackerApplication(EDUCATION_DONE, { updatedAt: T1 });
    const submitted = hackerApplication(validHackerResponses, { status: "submitted", updatedAt: T2 });
    const state = deepFreeze<EditorState>({
      ...initEditorState(saved),
      edits: { school: "Example University", skills: ["web"], graduationYear: "1900" },
      clientErrors: { graduationYear: [GRADUATION_YEAR_MESSAGE] },
      serverErrors: { school: ["Server message."], bio: ["This field is required."] },
      formErrors: ["Form message."],
      notice: noticeForError("conflict"),
      focus: { token: 2, target: { kind: "summary" } },
      focusToken: 2,
    });
    const events = deepFreeze<EditorEvent[]>([
      changed("school", "Another University"),
      changed("skills", ["web", "ai_ml"]),
      { type: "SAVE_STARTED", trigger: "save" },
      {
        type: "CLIENT_INVALID",
        fieldErrors: { graduationYear: [GRADUATION_YEAR_MESSAGE] },
        validated: { graduationYear: "1900" },
        focusSummary: true,
      },
      saveSucceeded(application, {
        patch: { school: "Example University", skills: ["web"] },
        sent: { school: "Example University", skills: ["web"] },
        invalid: { graduationYear: [GRADUATION_YEAR_MESSAGE] },
        validated: { graduationYear: "1900" },
        dirtyKeys: ["school", "graduationYear", "skills"],
      }),
      {
        type: "SAVE_FAILED",
        error: failure("validation_failed", { fieldErrors: { bio: ["Bio message."] }, formErrors: ["Form message."] }),
        focusSummary: true,
      },
      { type: "SAVE_FAILED", error: failure("application_locked"), focusSummary: false },
      { type: "SAVE_THREW", kind: "network" },
      { type: "SUBMIT_STARTED" },
      { type: "SUBMIT_SUCCEEDED", application: submitted },
      {
        type: "SUBMIT_FAILED",
        error: failure("application_incomplete", { fieldErrors: { proudProject: ["This field is required."] } }),
      },
      { type: "SUBMIT_FAILED", error: failure("conflict") },
      { type: "SUBMIT_THREW", kind: "stale_deployment" },
      { type: "NOTICE_DISMISSED" },
      { type: "FOCUS_REQUESTED", target: { kind: "field", key: "school" } },
    ]);
    const snapshot = JSON.stringify({ state, events });

    // Frozen objects throw on write in strict-mode modules, so any mutation fails the test.
    for (const event of events) {
      expect(() => editorReducer(state, event), event.type).not.toThrow();
    }
    expect(() => events.reduce((current, event) => deepFreeze(editorReducer(current, event)), state)).not.toThrow();
    expect(JSON.stringify({ state, events })).toBe(snapshot);
  });
});

describe("selectSaved", () => {
  it("prefers a newer props application and ignores an older one", () => {
    const state = initEditorState(hackerApplication(ABOUT_DONE, { updatedAt: T1 }));
    const newer = hackerApplication(EDUCATION_DONE, { updatedAt: T2 });
    const older = hackerApplication({}, { updatedAt: T0 });

    expect(selectSaved(state, newer)).toBe(newer);
    expect(selectSaved(state, older)).toBe(state.saved);
    expect(selectSaved(state, { ...state.saved })).toBe(state.saved);
  });

  it("uses the status rank when both applications have the same updatedAt", () => {
    const state = initEditorState(hackerApplication(validHackerResponses, { updatedAt: T1 }));
    const submitted = hackerApplication(validHackerResponses, { status: "submitted", updatedAt: T1 });

    expect(selectSaved(state, submitted)).toBe(submitted);
  });

  it("keeps a save result over the stale props application it replaced", () => {
    const initial = hackerApplication({}, { updatedAt: T0 });
    const state = editorReducer(
      initEditorState(initial),
      saveSucceeded(hackerApplication(ABOUT_DONE, { updatedAt: T1 })),
    );

    expect(selectSaved(state, initial)).toBe(state.saved);
  });
});

describe("selectErrors", () => {
  it("overlays client errors on server errors", () => {
    const state: EditorState = {
      ...initEditorState(hackerApplication({})),
      serverErrors: { school: ["Server school message."], graduationYear: ["Server year message."] },
      clientErrors: { graduationYear: [GRADUATION_YEAR_MESSAGE], major: ["Client major message."] },
    };

    expect(selectErrors(state)).toEqual({
      school: ["Server school message."],
      graduationYear: [GRADUATION_YEAR_MESSAGE],
      major: ["Client major message."],
    });
  });

  it("returns the non-empty record, or an empty record when there are no errors", () => {
    const base = initEditorState(hackerApplication({}));
    const serverOnly: EditorState = { ...base, serverErrors: { school: ["Required."] } };
    const clientOnly: EditorState = { ...base, clientErrors: { school: ["Too long."] } };

    expect(selectErrors(base)).toEqual({});
    expect(selectErrors(serverOnly)).toBe(serverOnly.serverErrors);
    expect(selectErrors(clientOnly)).toBe(clientOnly.clientErrors);
  });
});

describe("selectSaveStatus", () => {
  const clean: SaveStatusInput = { phase: "editing", saveStatus: "idle", dirtyKeys: [], errors: {} };
  const busy: SaveStatusInput = {
    phase: "editing",
    saveStatus: "idle",
    dirtyKeys: ["school"],
    errors: { school: ["Required."] },
    clientErrors: { school: ["Required."] },
  };

  it("is blocked when locked or launched, whatever else is pending", () => {
    for (const phase of ["locked", "launched"] as const) {
      for (const saveStatus of ["idle", "saving", "error"] as const) {
        expect(selectSaveStatus({ ...busy, phase, saveStatus }), `${phase} ${saveStatus}`).toEqual({
          state: "blocked",
          text: TEXT.blocked,
        });
      }
    }
  });

  it("shows saving before errors, invalid answers, and unsaved changes", () => {
    expect(selectSaveStatus({ ...busy, saveStatus: "saving" })).toEqual({ state: "saving", text: TEXT.saving });
    expect(selectSaveStatus({ ...busy, phase: "submitting", saveStatus: "saving" })).toEqual({
      state: "saving",
      text: TEXT.saving,
    });
  });

  it("shows a failed save before invalid answers and unsaved changes", () => {
    expect(selectSaveStatus({ ...busy, saveStatus: "error" })).toEqual({ state: "error", text: TEXT.error });
  });

  it("counts distinct keys that are dirty with an error or have a client error", () => {
    const input: SaveStatusInput = {
      ...clean,
      dirtyKeys: ["school", "major", "bio", "school"],
      errors: {
        school: ["Required."],
        major: [],
        cityOfResidence: ["An error on a saved answer."],
        graduationYear: [GRADUATION_YEAR_MESSAGE],
      },
      clientErrors: { school: ["Required."], graduationYear: [GRADUATION_YEAR_MESSAGE], githubUrl: [] },
    };

    // school (dirty with an error and a client error) and graduationYear (client error) count once each.
    expect(selectSaveStatus(input)).toEqual({ state: "invalid", text: TEXT.invalid(2) });
    expect(selectSaveStatus({ ...clean, dirtyKeys: ["school"], errors: { school: ["Required."] } })).toEqual({
      state: "invalid",
      text: TEXT.invalid(1),
    });
  });

  it("ignores errors on answers that are already saved", () => {
    expect(selectSaveStatus({ ...clean, errors: { proudProject: ["This field is required."] } })).toEqual({
      state: "saved",
      text: TEXT.saved,
    });
    expect(
      selectSaveStatus({ ...clean, dirtyKeys: ["school"], errors: { proudProject: ["This field is required."] } }),
    ).toEqual({ state: "dirty", text: TEXT.dirty });
  });

  it("shows unsaved changes, then saved", () => {
    expect(selectSaveStatus({ ...clean, dirtyKeys: ["school"] })).toEqual({ state: "dirty", text: TEXT.dirty });
    expect(selectSaveStatus(clean)).toEqual({ state: "saved", text: TEXT.saved });
    expect(selectSaveStatus({ ...clean, phase: "submitting" })).toEqual({ state: "saved", text: TEXT.saved });
  });
});
