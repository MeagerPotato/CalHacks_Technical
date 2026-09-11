import type { ChangeEvent, ReactNode } from "react";

export interface CheckboxProps {
  id: string;
  name?: string;
  label: ReactNode;
  /** Controlled state. Without `onCheckedChange` the checkbox is read-only. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  describedBy?: string;
  invalid?: boolean;
  required?: boolean;
}

/** A single native checkbox with a visible `label[for]`. */
export function Checkbox({
  id,
  name,
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  describedBy,
  invalid = false,
  required = false,
}: CheckboxProps) {
  const handleChange = onCheckedChange
    ? (event: ChangeEvent<HTMLInputElement>) => onCheckedChange(event.target.checked)
    : undefined;
  const checkedProps =
    checked !== undefined
      ? { checked, onChange: handleChange, readOnly: handleChange ? undefined : true }
      : { defaultChecked, onChange: handleChange };

  return (
    <div className="flex items-start gap-3 py-1">
      <input
        type="checkbox"
        id={id}
        name={name}
        aria-invalid={invalid ? true : undefined}
        aria-required={required ? true : undefined}
        aria-describedby={describedBy}
        className="mt-0.5 size-5 shrink-0 accent-ink"
        {...checkedProps}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
