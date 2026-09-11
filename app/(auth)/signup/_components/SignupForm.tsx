"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { thrownActionNotice } from "@/app/_components/thrown-notice";
import { EMPTY_FEEDBACK, readFormString, useFormFeedback } from "@/app/_components/use-form-feedback";
import { signUp } from "@/app/actions/auth";
import { CheckEmailNotice } from "@/components/auth/CheckEmailNotice";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field, FieldGroup } from "@/components/ui/Field";
import { Form, FormActions } from "@/components/ui/Form";
import { LiveStatus, NoticeFromView } from "@/components/ui/Notice";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextInput } from "@/components/ui/TextInput";
import { COPY, LOCKED } from "@/content/copy";
import { PUBLIC_ACCOUNT_ROLE_OPTIONS } from "@/lib/application-config";
import { toAuthFeedback } from "@/lib/editor/feedback";
import { fieldControlId } from "@/lib/editor/steps";
import { ROUTES } from "@/lib/routes";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";

const SIGNUP_FIELDS = [
  { key: "accountRole", label: COPY.auth.signup.roleLegend },
  { key: "email", label: COPY.auth.signup.email },
  { key: "password", label: COPY.auth.signup.password },
] as const;

// Public signup offers exactly Hacker and Judge; the action and a database trigger both reject anything else.
const ROLE_OPTIONS = PUBLIC_ACCOUNT_ROLE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: COPY.auth.signup.roleDescriptions[option.value],
}));

/** Hacker or Judge signup. Shows the check-email notice when the project requires email confirmation. */
export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { feedback, showFeedback, clearNotice, summaryRef, focusSummaryItem } = useFormFeedback();
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const checkEmailHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirmationEmail) {
      checkEmailHeadingRef.current?.focus();
    }
  }, [confirmationEmail]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }
    clearNotice();

    const formData = new FormData(event.currentTarget);
    const email = readFormString(formData, "email").trim();

    startTransition(async () => {
      try {
        const result = await signUp(formData);
        if (!result.ok) {
          startTransition(() => showFeedback(toAuthFeedback(result.error, SIGNUP_FIELDS)));
          return;
        }
        if (result.data.requiresEmailConfirmation) {
          startTransition(() => setConfirmationEmail(email));
          return;
        }
        router.replace(result.data.redirectTo);
      } catch (error) {
        startTransition(() => showFeedback({ ...EMPTY_FEEDBACK, notice: thrownActionNotice(error) }));
      }
    });
  }

  if (confirmationEmail) {
    return <CheckEmailNotice email={confirmationEmail} signInHref={ROUTES.login} headingRef={checkEmailHeadingRef} />;
  }

  const roleErrors = feedback.fieldErrors.accountRole;

  return (
    <Form onSubmit={handleSubmit}>
      <ErrorSummary
        ref={summaryRef}
        title={COPY.editor.errorSummaryTitle}
        items={feedback.summary}
        onItemActivate={focusSummaryItem}
      />
      {feedback.notice ? <NoticeFromView view={feedback.notice} live="assertive" /> : null}
      <FieldGroup
        id={fieldControlId("accountRole")}
        legend={COPY.auth.signup.roleLegend}
        hint={COPY.auth.signup.roleHint}
        errors={roleErrors}
      >
        <RadioGroup
          idPrefix={fieldControlId("accountRole")}
          name="accountRole"
          options={ROLE_OPTIONS}
          invalid={Boolean(roleErrors?.length)}
        />
      </FieldGroup>
      <Field id={fieldControlId("email")} label={COPY.auth.signup.email} errors={feedback.fieldErrors.email} required>
        {(control) => (
          <TextInput
            id={control.id}
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            describedBy={control.describedBy}
            invalid={control.invalid}
            required={control.required}
          />
        )}
      </Field>
      <Field
        id={fieldControlId("password")}
        label={COPY.auth.signup.password}
        hint={COPY.auth.signup.passwordHint(PASSWORD_MIN_LENGTH)}
        errors={feedback.fieldErrors.password}
        required
      >
        {(control) => (
          <TextInput
            id={control.id}
            name="password"
            type="password"
            autoComplete="new-password"
            describedBy={control.describedBy}
            invalid={control.invalid}
            required={control.required}
          />
        )}
      </Field>
      <FormActions>
        <Button type="submit" variant="primary" pending={isPending}>
          {LOCKED.auth.createAccount}
        </Button>
      </FormActions>
      <LiveStatus message={isPending ? COPY.auth.signup.pending : ""} />
    </Form>
  );
}
