import type { ChangeEvent, HTMLAttributes, Ref } from "react";

/**
 * Text control styles. The 16px size (`text-base`) prevents iOS zoom; keep it. An invalid control keeps its navy
 * border, which is its 3:1 edge against the cream page, and adds a coral ring inside it on the white fill (coral on
 * cream is only 2.89:1).
 */
export const INPUT_CLASSES =
  "block w-full rounded-control border-2 border-border bg-surface px-4 py-3 text-base text-ink " +
  "aria-invalid:ring-2 aria-invalid:ring-danger-edge aria-invalid:ring-inset";

export interface TextInputProps {
  id: string;
  name?: string;
  /** Controlled value. Without `onValueChange` the control is read-only. */
  value?: string;
  /** Uncontrolled initial value (auth forms read FormData). */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "email" | "password";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  describedBy?: string;
  invalid?: boolean;
  /** Sets `aria-required` only. Native `required` and `maxLength` are omitted so server-equivalent messages show. */
  required?: boolean;
  spellCheck?: boolean;
  ref?: Ref<HTMLInputElement | HTMLTextAreaElement>;
}

/** A single-line input or, with `multiline`, a textarea. */
export function TextInput({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  multiline = false,
  rows = 5,
  type = "text",
  inputMode,
  autoComplete,
  describedBy,
  invalid = false,
  required = false,
  spellCheck,
  ref,
}: TextInputProps) {
  const handleChange = onValueChange
    ? (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValueChange(event.target.value)
    : undefined;
  // A controlled control with no change callback is read-only, so React never warns about a missing onChange.
  const valueProps =
    value !== undefined
      ? { value, onChange: handleChange, readOnly: handleChange ? undefined : true }
      : { defaultValue, onChange: handleChange };

  const shared = {
    id,
    name,
    autoComplete,
    spellCheck,
    "aria-invalid": invalid ? true : undefined,
    "aria-required": required ? true : undefined,
    "aria-describedby": describedBy,
    className: INPUT_CLASSES,
    ...valueProps,
  };

  if (multiline) {
    // The ref prop accepts either element type; each branch narrows it to the element it renders.
    return <textarea {...shared} ref={ref as Ref<HTMLTextAreaElement>} rows={rows} />;
  }
  return <input {...shared} ref={ref as Ref<HTMLInputElement>} type={type} inputMode={inputMode} />;
}
