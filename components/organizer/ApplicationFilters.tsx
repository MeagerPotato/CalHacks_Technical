import type { FormEvent, Ref } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { INPUT_CLASSES } from "@/components/ui/TextInput";
import type { ApplicationFiltersView } from "@/lib/view-models/organizer-types";

export interface ApplicationFiltersProps {
  filters: ApplicationFiltersView;
  /** Enhances the native GET submission (for example a client navigation). Without it the browser submits the form. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Marks the submit button pending while the filtered results load. */
  pending?: boolean;
  formRef?: Ref<HTMLFormElement>;
}

/**
 * The applications filter form: a `section` holding a `form[role=search][method=get]` whose control names are the
 * query-string keys (`search`, `type`, `status`, `reviewState`, `sort`, plus hidden `pageSize` when set). Controls are
 * uncontrolled (`defaultValue`), so the form works without JavaScript; a container keeps them in sync with the URL.
 */
export function ApplicationFilters({ filters, onSubmit, pending = false, formRef }: ApplicationFiltersProps) {
  const { search } = filters;

  return (
    <section
      aria-labelledby="application-filters-title"
      data-testid="application-filters"
      className="workshop-card rounded-card border-2 border-border bg-accent p-5 text-ink shadow-card sm:p-6"
    >
      <h2 id="application-filters-title" className="text-xl font-bold">
        {filters.title}
      </h2>
      <form
        ref={formRef}
        role="search"
        method="get"
        action={filters.action}
        aria-labelledby="application-filters-title"
        onSubmit={onSubmit}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="md:col-span-2 xl:col-span-1">
            <Field id={search.id} label={search.label} hint={search.hint}>
              {(control) => (
                <input
                  type="search"
                  id={control.id}
                  name={search.name}
                  defaultValue={search.value}
                  autoComplete="off"
                  aria-describedby={control.describedBy}
                  className={INPUT_CLASSES}
                />
              )}
            </Field>
          </div>
          {filters.selects.map((select) => (
            <Field key={select.id} id={select.id} label={select.label}>
              {(control) => (
                <select
                  id={control.id}
                  name={select.name}
                  defaultValue={select.value}
                  aria-describedby={control.describedBy}
                  className={INPUT_CLASSES}
                >
                  {select.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </div>
        {filters.hidden.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" pending={pending} data-testid="apply-filters">
            {filters.submitLabel}
          </Button>
          {filters.clear ? (
            <AppLink href={filters.clear.href} variant="quiet" data-testid="clear-filters">
              {filters.clear.label}
            </AppLink>
          ) : null}
        </div>
      </form>
    </section>
  );
}
