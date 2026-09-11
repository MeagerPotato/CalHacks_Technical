"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

import { thrownActionNotice } from "@/app/_components/thrown-notice";
import { EMPTY_FEEDBACK, useFormFeedback } from "@/app/_components/use-form-feedback";
import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field } from "@/components/ui/Field";
import { Form, FormActions } from "@/components/ui/Form";
import { LiveStatus, NoticeFromView } from "@/components/ui/Notice";
import { TextInput } from "@/components/ui/TextInput";
import { COPY, LOCKED } from "@/content/copy";
import { toAuthFeedback } from "@/lib/editor/feedback";
import { fieldControlId } from "@/lib/editor/steps";

const LOGIN_FIELDS = [
  { key: "email", label: COPY.auth.login.email },
  { key: "password", label: COPY.auth.login.password },
] as const;

interface LoginFormProps {
  /** Requested destination; signIn allows it only when it is a safe path for the viewer's role. */
  next?: string;
}

/** Email and password sign-in. Inputs keep their values after a failed attempt. */
export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { feedback, showFeedback, clearNotice, summaryRef, focusSummaryItem } = useFormFeedback();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }
    clearNotice();

    const formData = new FormData(event.currentTarget);
    if (next) {
      formData.set("next", next);
    }

    startTransition(async () => {
      try {
        const result = await signIn(formData);
        if (result.ok) {
          router.replace(result.data.redirectTo);
          return;
        }
        startTransition(() => showFeedback(toAuthFeedback(result.error, LOGIN_FIELDS)));
      } catch (error) {
        startTransition(() => showFeedback({ ...EMPTY_FEEDBACK, notice: thrownActionNotice(error) }));
      }
    });
  }

  return (
    <Form onSubmit={handleSubmit}>
      <ErrorSummary
        ref={summaryRef}
        title={COPY.editor.errorSummaryTitle}
        items={feedback.summary}
        onItemActivate={focusSummaryItem}
      />
      {feedback.notice ? <NoticeFromView view={feedback.notice} live="assertive" /> : null}
      <Field id={fieldControlId("email")} label={COPY.auth.login.email} errors={feedback.fieldErrors.email} required>
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
        label={COPY.auth.login.password}
        errors={feedback.fieldErrors.password}
        required
      >
        {(control) => (
          <TextInput
            id={control.id}
            name="password"
            type="password"
            autoComplete="current-password"
            describedBy={control.describedBy}
            invalid={control.invalid}
            required={control.required}
          />
        )}
      </Field>
      <FormActions>
        <Button type="submit" variant="primary" pending={isPending}>
          {LOCKED.auth.signIn}
        </Button>
      </FormActions>
      <LiveStatus message={isPending ? COPY.auth.login.pending : ""} />
    </Form>
  );
}
