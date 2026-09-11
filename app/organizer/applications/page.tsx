import type { Metadata } from "next";

import { ApplicationsView } from "@/components/organizer/ApplicationsView";
import { ORGANIZER_COPY } from "@/content/copy";
import { requireOrganizer } from "@/lib/auth/dal";
import { listApplications } from "@/lib/data/organizer";
import { parseApplicationListFilters } from "@/lib/validation/organizer";
import { toApplicationsPageView } from "@/lib/view-models/organizer-applications";

import { ApplicationFiltersForm } from "./_components/ApplicationFiltersForm";

export const metadata: Metadata = { title: ORGANIZER_COPY.meta.titles.applications };

/**
 * Applications table. Search, filters, sort, and page live in the query string and are parsed leniently, so a
 * malformed URL falls back to defaults instead of failing.
 */
export default async function OrganizerApplicationsPage({ searchParams }: PageProps<"/organizer/applications">) {
  await requireOrganizer();
  const filters = parseApplicationListFilters(await searchParams);
  const view = toApplicationsPageView(await listApplications(filters));

  return (
    <ApplicationsView
      view={view}
      filters={<ApplicationFiltersForm filters={view.filters} countText={view.results.countText} />}
    />
  );
}
