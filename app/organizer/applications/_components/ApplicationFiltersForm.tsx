"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { ApplicationFilters } from "@/components/organizer/ApplicationFilters";
import { LiveStatus } from "@/components/ui/Notice";
import { COPY } from "@/content/copy";
import { parseApplicationListFilters } from "@/lib/validation/organizer";
import { applicationsHref } from "@/lib/view-models/organizer-routes";
import type { ApplicationFiltersView } from "@/lib/view-models/organizer-types";

export interface ApplicationFiltersFormProps {
  filters: ApplicationFiltersView;
  /** The result count for the current URL, announced after the organizer changes the filters. */
  countText: string;
}

/**
 * Enhances the GET filter form. Submitting parses the form fields with the same lenient parser the page uses and
 * pushes the normalized URL (defaults and blank fields omitted) as a client navigation, so the results update in place
 * and history keeps each filter state. The live status says "Loading" while the results load and then the result
 * count; it stays silent until the first submission, and later URL changes (sort headers, pagination, clear filters,
 * back and forward) update the count it reads out.
 */
export function ApplicationFiltersForm({ filters, countText }: ApplicationFiltersFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // The controls are uncontrolled so the form works without JavaScript. When the URL changes without this form (sort
  // headers, clear filters, back and forward), write the new values into the controls; focus stays where it is.
  const expectedValues = JSON.stringify([
    [filters.search.name, filters.search.value],
    ...filters.selects.map((select) => [select.name, select.value]),
  ]);
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    for (const [name, value] of JSON.parse(expectedValues) as [string, string][]) {
      const control = form.elements.namedItem(name);
      if ((control instanceof HTMLInputElement || control instanceof HTMLSelectElement) && control.value !== value) {
        control.value = value;
      }
    }
  }, [expectedValues]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") {
        params.append(name, value);
      }
    }
    const href = applicationsHref(parseApplicationListFilters(params));
    setHasSubmitted(true);
    startTransition(() => {
      router.push(href);
    });
  }

  let message = "";
  if (hasSubmitted) {
    message = isPending ? COPY.common.loading : countText;
  }

  return (
    <>
      <ApplicationFilters filters={filters} onSubmit={handleSubmit} pending={isPending} formRef={formRef} />
      <LiveStatus message={message} />
    </>
  );
}
