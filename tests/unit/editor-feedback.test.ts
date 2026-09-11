import { describe, expect, it } from "vitest";

import { COPY } from "@/content/copy";
import { ACTION_ERROR_MESSAGES, type ActionError, type ActionErrorCode } from "@/lib/actions/result";
import type { ApplicationType } from "@/lib/domain/enums";
import {
  authNoticeFor,
  noticeForError,
  toAuthFeedback,
  toSummaryItems,
  type FeedbackCode,
} from "@/lib/editor/feedback";
import { applicationStepHref, sectionForField } from "@/lib/editor/steps";
import { getRequiredApplicationFieldKeys } from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { getFieldConfig, resolveFieldCopy } from "@/lib/view-models/fields";
import type { NoticeActionKind, NoticeTone } from "@/lib/view-models/types";

type NoticeCopyKey = Exclude<keyof typeof COPY.notices, "actions">;

const ACTION_ERROR_CODES = Object.keys(ACTION_ERROR_MESSAGES) as ActionErrorCode[];
const CLIENT_CODES: FeedbackCode[] = ["network", "stale_deployment", "unconfirmed_submit"];
const ALL_CODES: FeedbackCode[] = [...ACTION_ERROR_CODES, ...CLIENT_CODES];

const DEDICATED_NOTICES: [NoticeCopyKey, NoticeTone, NoticeActionKind[]][] = [
  ["conflict", "warning", ["retry", "reload_latest"]],
  ["unauthenticated", "warning", ["sign_in_new_tab", "retry"]],
  ["not_found", "error", ["reload"]],
  ["forbidden", "error", ["reload"]],
  ["rate_limited", "error", ["retry"]],
  ["unexpected_error", "error", ["retry"]],
  ["validation_failed", "error", ["retry"]],
  ["network", "warning", ["retry"]],
  ["stale_deployment", "warning", ["reload"]],
  ["application_locked", "info", []],
  ["unconfirmed_submit", "warning", ["check_status"]],
];

const ORGANIZER_AND_REVIEW_CODES: ActionErrorCode[] = [
  "invalid_status_transition",
  "review_owned_by_another_organizer",
  "review_locked",
  "review_already_completed",
  "review_not_completed",
];

function labelFor(type: ApplicationType, key: string): string {
  const field = getFieldConfig(type, key);
  if (!field) {
    throw new Error(`The ${type} form has no field named ${key}.`);
  }
  return resolveFieldCopy(type, field).label;
}

function failure(code: ActionErrorCode, details: Omit<Partial<ActionError>, "code"> = {}): ActionError {
  return { code, message: ACTION_ERROR_MESSAGES[code], ...details };
}

describe("noticeForError", () => {
  it("maps every feedback code to a notice except application_incomplete", () => {
    expect(ACTION_ERROR_CODES).toHaveLength(19);

    for (const code of ALL_CODES) {
      const notice = noticeForError(code);
      if (code === "application_incomplete") {
        expect(notice).toBeNull();
        continue;
      }
      expect(notice, code).not.toBeNull();
      expect(notice?.id).toBe(code);
      expect(notice?.title.length, code).toBeGreaterThan(0);
      expect(typeof notice?.body, code).toBe("string");
    }
  });

  it("uses dedicated copy, tone, and actions for applicant failures", () => {
    for (const [code, tone, actions] of DEDICATED_NOTICES) {
      const notice = noticeForError(code);
      expect(notice, code).toMatchObject({
        id: code,
        tone,
        title: COPY.notices[code].title,
        body: COPY.notices[code].body,
      });
      expect(notice?.actions.map((action) => action.kind), code).toEqual(actions);
    }
  });

  it("uses the unexpected_error copy and tone for organizer, review, and other codes", () => {
    const dedicated = new Set<string>(DEDICATED_NOTICES.map(([code]) => code));
    const fallbackCodes = ALL_CODES.filter((code) => !dedicated.has(code) && code !== "application_incomplete");

    expect(fallbackCodes).toEqual(expect.arrayContaining(ORGANIZER_AND_REVIEW_CODES));
    for (const code of fallbackCodes) {
      expect(noticeForError(code), code).toEqual({
        id: code,
        tone: "error",
        title: COPY.notices.unexpected_error.title,
        body: COPY.notices.unexpected_error.body,
        actions: [{ kind: "retry", label: COPY.notices.actions.retry }],
      });
    }
  });

  it("labels actions from COPY.notices.actions and only links the sign-in action", () => {
    expect(noticeForError("conflict")?.actions).toEqual([
      { kind: "retry", label: COPY.notices.actions.retry },
      { kind: "reload_latest", label: COPY.notices.actions.reloadLatest },
    ]);
    expect(noticeForError("unauthenticated")?.actions).toEqual([
      { kind: "sign_in_new_tab", label: COPY.notices.actions.signInNewTab, href: "/login" },
      { kind: "retry", label: COPY.notices.actions.retry },
    ]);
    expect(
      noticeForError("unauthenticated", { signInHref: "/login?next=%2Fportal%2Fapplication" })?.actions[0],
    ).toEqual({
      kind: "sign_in_new_tab",
      label: COPY.notices.actions.signInNewTab,
      href: "/login?next=%2Fportal%2Fapplication",
    });
    expect(noticeForError("forbidden")?.actions).toEqual([{ kind: "reload", label: COPY.notices.actions.reload }]);
    expect(noticeForError("stale_deployment")?.actions).toEqual([
      { kind: "reload", label: COPY.notices.actions.reload },
    ]);
    expect(noticeForError("unconfirmed_submit")?.actions).toEqual([
      { kind: "check_status", label: COPY.notices.actions.checkStatus },
    ]);
    expect(noticeForError("application_locked")?.actions).toEqual([]);

    for (const code of ALL_CODES) {
      for (const action of noticeForError(code, { signInHref: "/login?next=%2Fportal" })?.actions ?? []) {
        if (action.kind === "sign_in_new_tab") {
          expect(action.href).toBe("/login?next=%2Fportal");
        } else {
          expect(action, code).not.toHaveProperty("href");
        }
      }
    }
  });

  it("returns a fresh notice on every call", () => {
    const first = noticeForError("conflict");
    first?.actions.pop();
    const second = noticeForError("conflict");

    expect(second).not.toBe(first);
    expect(second?.actions).toHaveLength(2);
  });

  it("falls back to the unexpected_error notice for unknown runtime codes", () => {
    for (const code of ["constructor", "__proto__", "toString", "not_a_code"]) {
      expect(noticeForError(code as FeedbackCode), code).toMatchObject({
        id: "unexpected_error",
        tone: "error",
        title: COPY.notices.unexpected_error.title,
      });
    }
  });
});

describe("toSummaryItems", () => {
  const stepHref = (type: ApplicationType) => (key: string) =>
    applicationStepHref(sectionForField(type, key) ?? "review", key);

  it("lists errors in form order with the first message, resolved labels, and step hrefs", () => {
    const items = toSummaryItems(
      "hacker",
      {
        codeOfConductAccepted: ["Accept the code of conduct to submit."],
        notAField: ["Ignored."],
        graduationYear: ["Enter a whole number from 2000 to 2040.", "A second message."],
        school: [],
        fullName: ["This field is required."],
      },
      stepHref("hacker"),
    );

    expect(items).toEqual([
      {
        key: "fullName",
        label: labelFor("hacker", "fullName"),
        message: "This field is required.",
        href: "/portal/application?section=about#field-fullName",
      },
      {
        key: "graduationYear",
        label: labelFor("hacker", "graduationYear"),
        message: "Enter a whole number from 2000 to 2040.",
        href: "/portal/application?section=education#field-graduationYear",
      },
      {
        key: "codeOfConductAccepted",
        label: labelFor("hacker", "codeOfConductAccepted"),
        message: "Accept the code of conduct to submit.",
        href: "/portal/application?section=agreements#field-codeOfConductAccepted",
      },
    ]);
  });

  it("follows form order for a real incomplete judge submission", () => {
    const { fieldErrors } = calculateApplicationCompletion("judge", {});
    const items = toSummaryItems("judge", fieldErrors, (key) => `#field-${key}`);

    expect(items.map((item) => item.key)).toEqual(getRequiredApplicationFieldKeys("judge"));
    expect(items[0]).toEqual({
      key: "fullName",
      label: labelFor("judge", "fullName"),
      message: "This field is required.",
      href: "#field-fullName",
    });
  });

  it("ignores prototype keys in the field errors", () => {
    expect(toSummaryItems("hacker", JSON.parse('{"__proto__": ["x"], "constructor": ["y"]}'), () => "#")).toEqual([]);
  });
});

describe("toAuthFeedback", () => {
  const signupFields = [
    { key: "accountRole", label: COPY.auth.signup.roleLegend },
    { key: "email", label: COPY.auth.signup.email },
    { key: "password", label: COPY.auth.signup.password },
  ];
  const loginFields = [
    { key: "email", label: COPY.auth.login.email },
    { key: "password", label: COPY.auth.login.password },
  ];

  it("puts email_taken on the email field", () => {
    expect(toAuthFeedback(failure("email_taken"), signupFields)).toEqual({
      fieldErrors: { email: [ACTION_ERROR_MESSAGES.email_taken] },
      summary: [
        {
          key: "email",
          label: COPY.auth.signup.email,
          message: ACTION_ERROR_MESSAGES.email_taken,
          href: "#field-email",
        },
      ],
      notice: null,
    });
  });

  it("puts weak_password on the password field", () => {
    expect(toAuthFeedback(failure("weak_password", { message: "Server text" }), signupFields)).toEqual({
      fieldErrors: { password: [ACTION_ERROR_MESSAGES.weak_password] },
      summary: [
        {
          key: "password",
          label: COPY.auth.signup.password,
          message: ACTION_ERROR_MESSAGES.weak_password,
          href: "#field-password",
        },
      ],
      notice: null,
    });
  });

  it("maps validation_failed errors for known keys in field order", () => {
    const feedback = toAuthFeedback(
      failure("validation_failed", {
        fieldErrors: {
          password: ["Use at least 8 characters."],
          accountRole: ["Choose Hacker or Judge.", "A second message."],
        },
      }),
      signupFields,
    );

    expect(feedback.fieldErrors).toEqual({
      accountRole: ["Choose Hacker or Judge.", "A second message."],
      password: ["Use at least 8 characters."],
    });
    expect(feedback.summary).toEqual([
      {
        key: "accountRole",
        label: COPY.auth.signup.roleLegend,
        message: "Choose Hacker or Judge.",
        href: "#field-accountRole",
      },
      {
        key: "password",
        label: COPY.auth.signup.password,
        message: "Use at least 8 characters.",
        href: "#field-password",
      },
    ]);
    expect(feedback.notice).toBeNull();
  });

  it("sends unknown keys, form errors, and missing details to a notice", () => {
    const withUnknownKey = toAuthFeedback(
      failure("validation_failed", {
        fieldErrors: { next: ["Too long."], email: ["Enter a valid email address."] },
      }),
      loginFields,
    );
    expect(withUnknownKey.fieldErrors).toEqual({ email: ["Enter a valid email address."] });
    expect(withUnknownKey.summary.map((item) => item.key)).toEqual(["email"]);
    // Resending the same input cannot succeed, so the notice explains the problem and offers no retry.
    expect(withUnknownKey.notice).toEqual({
      id: "validation_failed",
      tone: "error",
      title: COPY.authNotices.validation_failed.title,
      body: COPY.authNotices.validation_failed.body,
      actions: [],
    });

    const formLevel = failure("validation_failed", { formErrors: ["Invalid input."] });
    expect(toAuthFeedback(formLevel, loginFields)).toMatchObject({
      fieldErrors: {},
      summary: [],
      notice: { id: "validation_failed" },
    });
    expect(toAuthFeedback(failure("validation_failed"), loginFields)).toMatchObject({
      fieldErrors: {},
      summary: [],
      notice: { id: "validation_failed" },
    });
  });

  it("uses a custom href builder", () => {
    const feedback = toAuthFeedback(failure("weak_password"), signupFields, (key) => `/signup#field-${key}`);
    expect(feedback.summary[0].href).toBe("/signup#field-password");
  });

  it.each(["invalid_credentials", "email_not_confirmed", "rate_limited", "forbidden", "unexpected_error"] as const)(
    "shows %s as a notice with auth copy",
    (code) => {
      const feedback = toAuthFeedback(failure(code), loginFields);
      expect(feedback.fieldErrors).toEqual({});
      expect(feedback.summary).toEqual([]);
      expect(feedback.notice).toMatchObject({
        id: code,
        title: COPY.authNotices[code].title,
        body: COPY.authNotices[code].body,
      });
    },
  );

  it("uses tones and actions that match the editor notices", () => {
    const notice = (code: ActionErrorCode) => toAuthFeedback(failure(code), loginFields).notice;
    expect(notice("invalid_credentials")).toMatchObject({ tone: "error", actions: [] });
    expect(notice("email_not_confirmed")).toMatchObject({ tone: "warning", actions: [] });
    expect(notice("forbidden")).toMatchObject({ tone: "error", actions: [] });
    expect(notice("rate_limited")).toMatchObject({
      tone: "error",
      actions: [{ kind: "retry", label: COPY.notices.actions.retry }],
    });
    expect(notice("unexpected_error")).toMatchObject({
      tone: "error",
      actions: [{ kind: "retry", label: COPY.notices.actions.retry }],
    });
  });

  it("falls back to the unexpected_error notice for codes auth forms do not expect", () => {
    expect(toAuthFeedback(failure("conflict"), loginFields)).toEqual({
      fieldErrors: {},
      summary: [],
      notice: authNoticeFor("unexpected_error", "conflict"),
    });
    expect(
      toAuthFeedback({ code: "constructor" as ActionErrorCode, message: "x" }, loginFields).notice,
    ).toMatchObject({ id: "unexpected_error", title: COPY.authNotices.unexpected_error.title });
  });

  it("copies messages instead of aliasing the action error", () => {
    const messages = ["Use at least 8 characters."];
    const error = failure("validation_failed", { fieldErrors: { password: messages } });
    const feedback = toAuthFeedback(error, loginFields);
    feedback.fieldErrors.password.push("Changed.");
    expect(messages).toEqual(["Use at least 8 characters."]);
  });
});

describe("authNoticeFor", () => {
  it("builds the network notice from auth copy", () => {
    expect(authNoticeFor("network")).toEqual({
      id: "network",
      tone: "warning",
      title: COPY.authNotices.network.title,
      body: COPY.authNotices.network.body,
      actions: [{ kind: "retry", label: COPY.notices.actions.retry }],
    });
  });

  it("returns a new object on every call", () => {
    expect(authNoticeFor("rate_limited")).not.toBe(authNoticeFor("rate_limited"));
  });
});
