import type { FormEventHandler, ReactNode, Ref } from "react";

export interface FormProps {
  id?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  "aria-labelledby"?: string;
  ref?: Ref<HTMLFormElement>;
}

/**
 * A form with native validation bubbles turned off (`noValidate`): the error summary and inline field errors replace
 * them. Enter still submits through the form's submit button.
 */
export function Form({ id, onSubmit, children, "aria-labelledby": labelledBy, ref }: FormProps) {
  return (
    <form id={id} ref={ref} noValidate aria-labelledby={labelledBy} onSubmit={onSubmit} className="flex flex-col gap-6">
      {children}
    </form>
  );
}

export interface FormActionsProps {
  children: ReactNode;
}

/** The row of form buttons. */
export function FormActions({ children }: FormActionsProps) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
