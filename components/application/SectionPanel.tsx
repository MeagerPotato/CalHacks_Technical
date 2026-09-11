import type { FormEvent, ReactNode, Ref } from "react";

import { Form, FormActions } from "@/components/ui/Form";

export interface SectionPanelProps {
  /** The editor step this panel shows; rendered as `data-step`. */
  step: string;
  /** Id of the section `h2` (`section-heading-<step>`). The container focuses it when the step changes. */
  headingId: string;
  title: string;
  intro?: string | null;
  /** The step's fields. */
  children: ReactNode;
  /** The action row after the fields, for example Save & continue and Save draft. */
  actions: ReactNode;
  /** When set, the fields and actions render inside a form, so Enter submits through the submit button. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  formRef?: Ref<HTMLFormElement>;
}

/** One editor step: a focusable section heading, an optional intro, the fields, and the action row. */
export function SectionPanel({
  step,
  headingId,
  title,
  intro,
  children,
  actions,
  onSubmit,
  formRef,
}: SectionPanelProps) {
  return (
    <section aria-labelledby={headingId} data-step={step} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id={headingId} tabIndex={-1} className="text-2xl font-bold">
          {title}
        </h2>
        {intro ? <p>{intro}</p> : null}
      </div>
      {onSubmit ? (
        <Form aria-labelledby={headingId} onSubmit={onSubmit} ref={formRef}>
          {children}
          <FormActions>{actions}</FormActions>
        </Form>
      ) : (
        <div className="flex flex-col gap-6">
          {children}
          <FormActions>{actions}</FormActions>
        </div>
      )}
    </section>
  );
}
