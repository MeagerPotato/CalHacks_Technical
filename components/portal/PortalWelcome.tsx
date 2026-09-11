import { Sticker } from "@/components/art/Sticker";
import { ApplicationSwitcher } from "@/components/portal/ApplicationSwitcher";
import { Badge } from "@/components/ui/Badge";
import type { PortalWelcomeView } from "@/lib/view-models/types";

export interface PortalWelcomeProps {
  view: PortalWelcomeView;
}

/**
 * The portal page heading: the greeting as the page `h1`, then the application switcher when the applicant holds both
 * applications (otherwise the application type badge), and the reference.
 */
export function PortalWelcome({ view }: PortalWelcomeProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Sticker name="patch" />
        <h1 className="min-w-0 wrap-anywhere text-3xl font-bold sm:text-4xl">{view.greeting}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view.switcher ? <ApplicationSwitcher view={view.switcher} /> : <Badge tone="neutral">{view.typeLabel}</Badge>}
        <p className="text-sm font-semibold">{view.reference}</p>
      </div>
    </div>
  );
}
