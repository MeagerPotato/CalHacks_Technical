import { Button } from "@/components/ui/Button";
import { joinDescribedBy } from "@/components/ui/Field";

/** One choice in a radio or checkbox group. */
export interface ChoiceOptionView {
  value: string;
  label: string;
  /** Extra text under the label, referenced by the control's `aria-describedby`. */
  description?: string;
}

/**
 * Id of a choice control. The first option uses the prefix itself, so `#field-<key>` links and focus land on it;
 * the others use `<prefix>-<value>`.
 */
export function choiceControlId(idPrefix: string, value: string, index: number): string {
  return index === 0 ? idPrefix : `${idPrefix}-${value}`;
}

export interface RadioGroupProps {
  /** Id of the first radio, for example `field-<key>`. */
  idPrefix: string;
  name: string;
  options: readonly ChoiceOptionView[];
  /** Controlled selection ("" for none). Without `onValueChange` the radios are read-only. */
  value?: string;
  /** Uncontrolled initial selection. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shows a clear button while a value is selected (optional single-choice fields). Clearing focuses the first radio. */
  clearable?: { label: string; onClear: () => void };
  describedBy?: string;
  /**
   * Marks the group invalid with `data-invalid` for styling. ARIA does not support `aria-invalid` on radios, so the
   * error itself is announced through the `FieldGroup` error id in `describedBy`.
   */
  invalid?: boolean;
}

/** Native radios with visible labels and browser arrow-key behavior. Render inside a `FieldGroup` for the legend. */
export function RadioGroup({
  idPrefix,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  clearable,
  describedBy,
  invalid = false,
}: RadioGroupProps) {
  const controlled = value !== undefined;

  return (
    <div data-invalid={invalid ? "true" : "false"} className="flex flex-col gap-1">
      {options.map((option, index) => {
        const optionId = choiceControlId(idPrefix, option.value, index);
        const descriptionId = option.description ? `${optionId}-description` : undefined;
        const handleChange = onValueChange ? () => onValueChange(option.value) : undefined;
        // A controlled radio with no change callback is read-only, so React never warns about a missing onChange.
        const checkedProps = controlled
          ? { checked: value === option.value, onChange: handleChange, readOnly: handleChange ? undefined : true }
          : { defaultChecked: defaultValue === option.value, onChange: handleChange };

        return (
          <div key={option.value} className="flex items-start gap-3 py-1">
            <input
              type="radio"
              id={optionId}
              name={name}
              value={option.value}
              aria-describedby={joinDescribedBy(describedBy, descriptionId)}
              className="mt-0.5 size-5 shrink-0 accent-ink"
              {...checkedProps}
            />
            <div className="flex flex-col">
              <label htmlFor={optionId} className="font-semibold">
                {option.label}
              </label>
              {option.description ? (
                <span id={descriptionId} className="text-sm">
                  {option.description}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {clearable && value ? (
        <div>
          <Button
            variant="quiet"
            onClick={() => {
              clearable.onClear();
              // This button unmounts once nothing is selected; move focus to the first radio so it is not lost.
              document.getElementById(idPrefix)?.focus();
            }}
          >
            {clearable.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
