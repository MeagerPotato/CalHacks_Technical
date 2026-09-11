"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";

import { thrownActionNotice } from "@/app/_components/thrown-notice";
import { EMPTY_FEEDBACK, readFormString, useFormFeedback } from "@/app/_components/use-form-feedback";
import { createApplication } from "@/app/actions/applications";
import { updateProfile } from "@/app/actions/auth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field } from "@/components/ui/Field";
import { Form, FormActions } from "@/components/ui/Form";
import { LiveStatus, NoticeFromView } from "@/components/ui/Notice";
import { TextInput } from "@/components/ui/TextInput";
import { COPY } from "@/content/copy";
import { fail, type ActionError } from "@/lib/actions/result";
import { toAuthFeedback } from "@/lib/editor/feedback";
import { fieldControlId } from "@/lib/editor/steps";
import { ROUTES } from "@/lib/routes";
import { profileUpdateSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";

const DISPLAY_NAME_FIELDS = [{ key: "displayName", label: COPY.onboarding.displayName }] as const;

const SIGN_IN_AGAIN_HREF = `${ROUTES.login}?next=${encodeURIComponent(ROUTES.onboarding)}`;

interface OnboardingFormProps {
  accountRoleLabel: string;
  /** The saved display name. When null a display name is required before the application is created. */
  defaultDisplayName: string | null;
}

/**
 * Confirms the account type (fixed at signup), saves the display name when it changed, then creates the draft
 * application (idempotent) and opens the editor.
 */
export function OnboardingForm({ accountRoleLabel, defaultDisplayName }: OnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { feedback, showFeedback, clearNotice, summaryRef, focusSummaryItem } = useFormFeedback();
  const displayNameRequired = defaultDisplayName === null;

  function handleFailure(error: ActionError) {
    if (error.code === "unauthenticated") {
      // The session ended: sign in again and come straight back to onboarding.
      router.replace(SIGN_IN_AGAIN_HREF);
      return;
    }
    startTransition(() => showFeedback(toAuthFeedback(error, DISPLAY_NAME_FIELDS)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }
    clearNotice();

    const displayName = readFormString(new FormData(event.currentTarget), "displayName").trim();
    const shouldSaveName = displayName !== "" && displayName !== defaultDisplayName;

    if (displayNameRequired || shouldSaveName) {
      // Same schema the action uses, so the message matches what the server would return.
      const parsed = profileUpdateSchema.safeParse({ displayName });
      if (!parsed.success) {
        const { error } = fail("validation_failed", { fieldErrors: toFieldErrors(parsed.error) });
        showFeedback(toAuthFeedback(error, DISPLAY_NAME_FIELDS));
        return;
      }
    }

    startTransition(async () => {
      try {
        if (shouldSaveName) {
          const profile = await updateProfile({ displayName });
          if (!profile.ok) {
            handleFailure(profile.error);
            return;
          }
        }

        const created = await createApplication();
        if (!created.ok) {
          handleFailure(created.error);
          return;
        }
        router.replace(ROUTES.portalApplication);
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
      <p>
        {COPY.onboarding.accountType} <Badge tone="info">{accountRoleLabel}</Badge>
      </p>
      <Field
        id={fieldControlId("displayName")}
        label={COPY.onboarding.displayName}
        hint={COPY.onboarding.displayNameHint}
        errors={feedback.fieldErrors.displayName}
        required={displayNameRequired}
        optionalText={displayNameRequired ? undefined : COPY.common.optional}
      >
        {(control) => (
          <TextInput
            id={control.id}
            name="displayName"
            defaultValue={defaultDisplayName ?? ""}
            autoComplete="nickname"
            describedBy={control.describedBy}
            invalid={control.invalid}
            required={control.required}
          />
        )}
      </Field>
      <FormActions>
        <Button type="submit" variant="primary" pending={isPending}>
          {COPY.onboarding.submit}
        </Button>
      </FormActions>
      <LiveStatus message={isPending ? COPY.onboarding.pending : ""} />
    </Form>
  );
}
