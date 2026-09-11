import type { Ref } from "react";

import { AppLink } from "@/components/ui/AppLink";
import type { IdentityFieldView, IdentityView } from "@/lib/view-models/organizer-types";

export interface IdentityPanelProps {
  identity: IdentityView;
  /** The panel section, focusable with `tabIndex={-1}`. */
  panelRef?: Ref<HTMLElement>;
}

function IdentityValue({ field, missingText }: { field: IdentityFieldView; missingText: string }) {
  if (field.key === "links") {
    return field.links.length > 0 ? (
      <ul role="list" className="flex flex-col gap-1">
        {field.links.map((link, index) => (
          <li key={`${index}-${link.href}`} className="wrap-anywhere">
            <AppLink href={link.href} newTab>
              {link.label}
            </AppLink>
          </li>
        ))}
      </ul>
    ) : (
      <span className="italic">{missingText}</span>
    );
  }
  return field.text ? <span className="wrap-anywhere">{field.text}</span> : <span className="italic">{missingText}</span>;
}

/**
 * Identifying details, rendered only after an organizer reveals them: `section#identity-panel` named by its `h2`, with
 * a description list of `div[data-identity-field]` entries (name, email, birthdate, country and city of residence,
 * affiliation, links). Links open in a new tab.
 */
export function IdentityPanel({ identity, panelRef }: IdentityPanelProps) {
  return (
    <section
      id="identity-panel"
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="identity-panel-title"
      data-testid="identity-panel"
      className="workshop-card rounded-card border-2 border-l-8 border-border bg-highlight p-5 text-ink shadow-card sm:p-6"
    >
      <h2 id="identity-panel-title" className="text-xl font-bold">
        {identity.title}
      </h2>
      <dl className="mt-4 flex flex-col gap-3">
        {identity.fields.map((field) => (
          <div key={field.key} data-identity-field={field.key} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <dt className="font-semibold sm:w-48 sm:shrink-0">{field.label}</dt>
            <dd className="min-w-0">
              <IdentityValue field={field} missingText={identity.missingText} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
