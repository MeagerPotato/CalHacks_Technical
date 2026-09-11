import type { ApplicationType } from "@/lib/domain/enums";
import { GuardedLink } from "@/lib/client/navigation-guard";
import type { ApplicationSwitcherView } from "@/lib/view-models/types";

/**
 * Fills for the application being shown, paired with their text colors: Hacker is coral and Judge is sky. The other
 * application stays on the cream page color. Astra may restyle these but must keep the keys and the contrast rules.
 */
export const SWITCHER_CURRENT_CLASSES = {
  hacker: "border-border bg-action text-on-action font-extrabold shadow-[inset_0_-2px_0_rgb(20_35_59/0.16)]",
  judge: "border-border bg-accent text-ink font-extrabold shadow-[inset_0_-2px_0_rgb(20_35_59/0.16)]",
} as const satisfies Record<ApplicationType, string>;

export const SWITCHER_OTHER_CLASSES = "border-transparent bg-page text-ink hover:bg-surface active:bg-surface";

const SWITCHER_ITEM_CLASSES =
  "inline-flex min-h-11 min-w-24 items-center justify-center rounded-full border-2 px-4 py-2 font-semibold no-underline transition-colors";

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
      <ul className="inline-flex flex-wrap items-center gap-0.5 rounded-full border-2 border-border bg-page p-1 shadow-[0_3px_0_rgb(20_35_59/0.12)]">
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
