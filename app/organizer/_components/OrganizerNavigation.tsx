"use client";

import { usePathname } from "next/navigation";

import { OrganizerNav } from "@/components/organizer/OrganizerNav";
import { ORGANIZER_COPY } from "@/content/copy";
import { toOrganizerNavItems } from "@/lib/view-models/organizer-routes";

/** Organizer navigation with `aria-current` derived from the current path, so it stays correct across navigations. */
export function OrganizerNavigation() {
  const pathname = usePathname();
  return <OrganizerNav label={ORGANIZER_COPY.nav.label} items={toOrganizerNavItems(pathname)} />;
}
