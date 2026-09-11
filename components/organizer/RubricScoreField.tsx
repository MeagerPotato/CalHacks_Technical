import { FieldGroup } from "@/components/ui/Field";
import { choiceControlId } from "@/components/ui/RadioGroup";
import type { RubricDimensionView } from "@/lib/view-models/organizer-types";

export interface RubricScoreFieldProps {
  dimension: RubricDimensionView;
  /** The selected score, or null when unscored. */
  value: number | null;
  /** Only the first non-empty message is shown. */
  errors?: readonly string[];
  /** Without it the radios are read-only. */
  onValueChange?: (score: number) => void;
}

/**
 * One rubric dimension as a horizontal row of native radios inside a `fieldset` (`RadioGroup` only stacks vertically).
 * The first radio's id is `dimension.controlId` and the rest are `<controlId>-<score>`; anchor text for the lowest,
 * middle, and highest scores is referenced by that radio's `aria-describedby`. The row carries `data-invalid`.
 */
export function RubricScoreField({ dimension, value, errors = [], onValueChange }: RubricScoreFieldProps) {
  const invalid = errors.some((message) => message.length > 0);

  return (
    <FieldGroup id={dimension.controlId} legend={dimension.label} errors={errors}>
      <div
        data-testid={`rubric-${dimension.key}`}
        data-invalid={invalid ? "true" : "false"}
        className="grid grid-cols-5 gap-1 rounded-control data-[invalid=true]:ring-2 data-[invalid=true]:ring-danger-edge"
      >
        {dimension.options.map((option, index) => {
          const id = choiceControlId(dimension.controlId, option.value, index);
          const anchorId = option.anchor ? `${id}-anchor` : undefined;
          const checked = value !== null && String(value) === option.value;
          return (
            <div key={option.value} className="flex min-w-0 flex-col items-center gap-1 rounded-control border border-transparent px-1 py-2 text-center has-[:checked]:border-border has-[:checked]:bg-highlight hover:bg-page">
              <input
                type="radio"
                id={id}
                name={dimension.name}
                value={option.value}
                checked={checked}
                onChange={onValueChange ? () => onValueChange(Number(option.value)) : undefined}
                readOnly={onValueChange ? undefined : true}
                aria-describedby={anchorId}
                className="size-5 shrink-0 accent-ink"
              />
              <label htmlFor={id} className="min-w-0 px-1 font-bold">
                {option.label}
              </label>
              {option.anchor ? (
                <span id={anchorId} className="text-xs">
                  {option.anchor}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </FieldGroup>
  );
}
