import type { ReactNode } from "react";

import { ApplicationFilters } from "@/components/organizer/ApplicationFilters";
import { ApplicationsResults } from "@/components/organizer/ApplicationsResults";
import type { ApplicationsPageView } from "@/lib/view-models/organizer-types";

export interface ApplicationsViewProps {
  view: ApplicationsPageView;
  /** Replaces the static filter form, for example with a container that enhances submission. */
  filters?: ReactNode;
}

/** The applications page content: the `h1` and intro, the filter form, and the results. */
export function ApplicationsView({ view, filters }: ApplicationsViewProps) {
  return (
    <div data-testid="organizer-applications" className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-card border-2 border-border bg-dark p-5 text-on-dark shadow-card" data-surface="dark">
        <h1 className="text-4xl font-extrabold sm:text-5xl">{view.heading}</h1>
        <p>{view.intro}</p>
      </div>
      {filters ?? <ApplicationFilters filters={view.filters} />}
      <ApplicationsResults results={view.results} />
    </div>
  );
}
