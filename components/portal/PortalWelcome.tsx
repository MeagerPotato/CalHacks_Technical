import { Badge } from "@/components/ui/Badge";
import type { PortalWelcomeView } from "@/lib/view-models/types";

export interface PortalWelcomeProps {
  view: PortalWelcomeView;
}

/** The portal page heading: the greeting as the page `h1`, the application type badge, and the reference. */
export function PortalWelcome({ view }: PortalWelcomeProps) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold sm:text-4xl">{view.greeting}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Badge tone="neutral">{view.typeLabel}</Badge>
        <p className="text-sm font-semibold">{view.reference}</p>
      </div>
    </div>
  );
}
