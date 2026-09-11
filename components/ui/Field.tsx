import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { COPY } from "@/content/copy";

// =============================================================================
// Field and FieldGroup wire labels, hints, errors, and counters to controls with the frozen id scheme:
// control <id>, hint <id>-hint, help <id>-help, error <id>-error, counter <id>-counter.
// =============================================================================

/** Character or selection counter. Containers build `text` from copy. */
export interface FieldCounter {
  current: number;
  max: number;
  text: string;
}

/** Props handed to the control rendered inside a `Field`. */
export interface FieldControlProps {
  id: string;
  /** Space-separated ids of the rendered hint, help, error, and counter; undefined when none render. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

/** Joins the defined ids into an `aria-describedby` value, or undefined when there are none. */
export function joinDescribedBy(...ids: (string | null | undefined)[]): string | undefined {
  const joined = ids.filter((id): id is string => Boolean(id)).join(" ");
  return joined.length > 0 ? joined : undefined;
}

interface DescriptionParts {
  id: string;
  hint?: string | null;
  help?: string | null;
  errors?: readonly string[];
  counter?: FieldCounter | null;
}

function describe({ id, hint, help, errors, counter }: DescriptionParts) {
  // An empty message renders nothing, so it must neither mark the control invalid nor reference a missing error id.
  const firstError = errors?.find((message) => message.length > 0);
  const hintId = hint ? `${id}-hint` : undefined;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = firstError ? `${id}-error` : undefined;
  const counterId = counter ? `${id}-counter` : undefined;
  return {
    hintId,
    helpId,
    errorId,
    counterId,
    firstError,
    describedBy: joinDescribedBy(hintId, helpId, errorId, counterId),
  };
}

function FieldText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm">
      {children}
    </p>
  );
}

// Errors are ink text with a coral edge and an icon; coral is never used for text.
function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="flex items-start gap-2 border-l-4 border-danger-edge pl-3 font-semibold text-ink">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>
        <VisuallyHidden>{`${COPY.common.errorPrefix} `}</VisuallyHidden>
        {message}
      </span>
    </p>
  );
}

function FieldCounterText({ id, counter }: { id: string; counter: FieldCounter }) {
  return (
    <p
      id={id}
      data-over-limit={counter.current > counter.max ? "true" : "false"}
      className="text-sm data-[over-limit=true]:font-semibold data-[over-limit=true]:underline"
    >
      {counter.text}
    </p>
  );
}

function OptionalText({ text }: { text?: string | null }) {
  return text ? <span className="font-normal">{` ${text}`}</span> : null;
}

/**
 * The visible required marker after a label or legend. It is hidden from assistive technology: a required control
 * announces itself through `aria-required`, and a required group adds visually hidden text instead.
 */
function RequiredMarker() {
  return (
    <span data-required-marker="" aria-hidden="true" className="ml-0.5 font-bold text-required">
      *
    </span>
  );
}

export interface FieldProps {
  /** Control id, for example `field-<key>`. */
  id: string;
  label: ReactNode;
  hint?: string | null;
  help?: string | null;
  /** Only the first non-empty message is shown. */
  errors?: readonly string[];
  required?: boolean;
  /** Shown after the label for optional fields, for example "(optional)". */
  optionalText?: string | null;
  counter?: FieldCounter | null;
  children: (control: FieldControlProps) => ReactNode;
}

/** A single text-like control with a visible `label[for]`, hint, help, inline error, and counter. */
export function Field({
  id,
  label,
  hint,
  help,
  errors,
  required = false,
  optionalText,
  counter,
  children,
}: FieldProps) {
  const ids = describe({ id, hint, help, errors, counter });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold">
        {label}
        {required ? <RequiredMarker /> : null}
        <OptionalText text={optionalText} />
      </label>
      {ids.hintId ? <FieldText id={ids.hintId}>{hint}</FieldText> : null}
      {ids.helpId ? <FieldText id={ids.helpId}>{help}</FieldText> : null}
      {ids.errorId && ids.firstError ? <FieldError id={ids.errorId} message={ids.firstError} /> : null}
      {children({ id, describedBy: ids.describedBy, invalid: ids.errorId !== undefined, required })}
      {ids.counterId && counter ? <FieldCounterText id={ids.counterId} counter={counter} /> : null}
    </div>
  );
}

export interface FieldGroupProps {
  /** Base id, for example `field-<key>`; the first control inside the group uses the same id. */
  id: string;
  legend: ReactNode;
  hint?: string | null;
  help?: string | null;
  /** Only the first non-empty message is shown. */
  errors?: readonly string[];
  /** Shows the required marker, plus visually hidden `COPY.common.required` text for the legend. */
  required?: boolean;
  optionalText?: string | null;
  counter?: FieldCounter | null;
  children: ReactNode;
}

/** A `fieldset` with a `legend` for radio groups, checkbox groups, and agreements. */
export function FieldGroup({
  id,
  legend,
  hint,
  help,
  errors,
  required = false,
  optionalText,
  counter,
  children,
}: FieldGroupProps) {
  const ids = describe({ id, hint, help, errors, counter });

  return (
    <fieldset aria-describedby={ids.describedBy} className="min-w-0">
      <legend className="mb-2 font-semibold">
        {legend}
        {required ? (
          <>
            <RequiredMarker />
            <VisuallyHidden>{` ${COPY.common.required}`}</VisuallyHidden>
          </>
        ) : null}
        <OptionalText text={optionalText} />
      </legend>
      <div className="flex flex-col gap-2">
        {ids.hintId ? <FieldText id={ids.hintId}>{hint}</FieldText> : null}
        {ids.helpId ? <FieldText id={ids.helpId}>{help}</FieldText> : null}
        {ids.errorId && ids.firstError ? <FieldError id={ids.errorId} message={ids.firstError} /> : null}
        {children}
        {ids.counterId && counter ? <FieldCounterText id={ids.counterId} counter={counter} /> : null}
      </div>
    </fieldset>
  );
}
