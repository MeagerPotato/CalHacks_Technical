import type { ApplicationType } from "@/lib/domain/enums";
import { GuardedLink } from "@/lib/client/navigation-guard";
import type { ApplicationSwitcherView } from "@/lib/view-models/types";

/**
 * Fills for the application being shown, paired with their text colors: Hacker is coral and Judge is sky. The other
 * application stays on the cream page color. Astra may restyle these but must keep the keys and the contrast rules.
 */
export const SWITCHER_CURRENT_CLASSES = {
  hacker: "bg-action text-on-action",
  judge: "bg-accent text-ink",
} as const satisfies Record<ApplicationType, string>;

export const SWITCHER_OTHER_CLASSES = "bg-page text-ink";

const SWITCHER_ITEM_CLASSES =
  "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 font-semibold no-underline";

export interface ApplicationSwitcherProps {
  view: ApplicationSwitcherView;
}

/**
 * Links between an applicant's Hacker and Judge dashboards, drawn as one segmented control. The application on screen
 * has `aria-current="page"`. Every link carries `data-type` (`hacker` or `judge`) and `data-state` (`current` or
 * `other`) for styling and tests.
 */
export function ApplicationSwitcher({ view }: ApplicationSwitcherProps) {
  return (
    <nav aria-label={view.label} data-testid="application-switcher">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-full border-2 border-border bg-page p-1">
        {view.items.map((item) => (
          <li key={item.type}>
            <GuardedLink
              href={item.href}
              aria-current={item.isCurrent ? "page" : undefined}
              data-type={item.type}
              data-state={item.isCurrent ? "current" : "other"}
              className={`${SWITCHER_ITEM_CLASSES} ${
                item.isCurrent ? SWITCHER_CURRENT_CLASSES[item.type] : SWITCHER_OTHER_CLASSES
              }`}
            >
              {item.label}
            </GuardedLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
