import { joinDescribedBy } from "@/components/ui/Field";
import { choiceControlId, type ChoiceOptionView } from "@/components/ui/RadioGroup";

export interface CheckboxGroupProps {
  /** Id of the first checkbox (for example `field-<key>`); the others are `<idPrefix>-<value>`. */
  idPrefix: string;
  name: string;
  options: readonly ChoiceOptionView[];
  /** Selected values. */
  value: readonly string[];
  /** Receives the next selection, deduplicated and in option order. Without it the checkboxes are read-only. */
  onValueChange?: (next: string[]) => void;
  /** Once this many options are selected, the unchecked options are disabled. */
  maxItems?: number;
  describedBy?: string;
  invalid?: boolean;
}

/** Native checkboxes for a multi-choice field. Render inside a `FieldGroup` for the legend and the counter. */
export function CheckboxGroup({
  idPrefix,
  name,
  options,
  value,
  onValueChange,
  maxItems,
  describedBy,
  invalid = false,
}: CheckboxGroupProps) {
  const selected = new Set(value);
  const selectedCount = options.filter((option) => selected.has(option.value)).length;
  const atLimit = maxItems !== undefined && selectedCount >= maxItems;

  return (
    <div className="flex flex-col gap-1">
      {options.map((option, index) => {
        const optionId = choiceControlId(idPrefix, option.value, index);
        const descriptionId = option.description ? `${optionId}-description` : undefined;
        const checked = selected.has(option.value);
        const handleChange = onValueChange
          ? () => {
              const next = options
                .filter((candidate) => (candidate.value === option.value ? !checked : selected.has(candidate.value)))
                .map((candidate) => candidate.value);
              onValueChange(Array.from(new Set(next)));
            }
          : undefined;

        return (
          <div key={option.value} className="flex items-start gap-3 py-1">
            <input
              type="checkbox"
              id={optionId}
              name={name}
              value={option.value}
              checked={checked}
              disabled={!checked && atLimit}
              onChange={handleChange}
              readOnly={handleChange ? undefined : true}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={joinDescribedBy(describedBy, descriptionId)}
              className="peer mt-0.5 size-5 shrink-0 accent-ink disabled:cursor-not-allowed"
            />
            <div className="flex flex-col peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              <label htmlFor={optionId}>{option.label}</label>
              {option.description ? (
                <span id={descriptionId} className="text-sm">
                  {option.description}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
