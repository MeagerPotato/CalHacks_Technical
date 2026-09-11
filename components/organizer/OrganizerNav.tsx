import { AppLink } from "@/components/ui/AppLink";
import type { OrganizerNavItemView } from "@/lib/view-models/organizer-types";

export interface OrganizerNavProps {
  /** Accessible name of the `nav` landmark. */
  label: string;
  items: readonly OrganizerNavItemView[];
}

/**
 * Organizer navigation: a named `nav` with one link per page. The current page gets `aria-current="page"`; a page
 * inside a section (a review workspace under Applications) gets `aria-current="true"`. Each item exposes
 * `data-current` ("page", "true", or "false") for styling.
 */
export function OrganizerNav({ label, items }: OrganizerNavProps) {
  return (
    <nav aria-label={label} data-testid="organizer-nav">
      <ul role="list" className="flex flex-wrap items-center gap-1 rounded-full border-2 border-border bg-page p-1">
        {items.map((item) => (
          <li
            key={item.id}
            data-current={item.current ?? "false"}
            className="rounded-full border-2 border-transparent px-3 data-[current=page]:border-border data-[current=page]:bg-highlight data-[current=true]:border-border data-[current=true]:bg-highlight"
          >
            <AppLink
              href={item.href}
              variant="quiet"
              aria-current={item.current ?? undefined}
              data-testid={`organizer-nav-${item.id}`}
            >
              {item.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
