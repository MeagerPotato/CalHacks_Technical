import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/Button";
import { INPUT_CLASSES } from "@/components/ui/TextInput";
import type { SectionNavItemView } from "@/lib/view-models/types";

export interface SectionSelectProps {
  /** Id of the native select; the visible label points at it. */
  id: string;
  label: string;
  items: readonly SectionNavItemView[];
  /** The step shown in the select. */
  value: string;
  /**
   * Updates the local choice only. Without it the select is uncontrolled (`defaultValue`). A change never saves or
   * moves focus, because arrow keys on a closed native select fire change events on some platforms.
   */
  onValueChange?: (step: string) => void;
  goLabel: string;
  /** Saves and switches to the chosen step. */
  onGo?: () => void;
}

/** Section navigation for small screens: a labelled native select plus a Go button that switches steps. */
export function SectionSelect({ id, label, items, value, onValueChange, goLabel, onGo }: SectionSelectProps) {
  // Attach handlers only when callbacks exist, so Server Components can render this view without passing functions.
  const valueProps = onValueChange
    ? { value, onChange: (event: ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value) }
    : { defaultValue: value };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <select id={id} data-testid="section-select" className={`${INPUT_CLASSES} min-w-0 flex-1`} {...valueProps}>
          {items.map((item) => (
            <option key={item.step} value={item.step}>
              {`${item.label} (${item.stateLabel})`}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" data-testid="section-go" onClick={onGo ? () => onGo() : undefined}>
          {goLabel}
        </Button>
      </div>
    </div>
  );
}
