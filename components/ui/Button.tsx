import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

/** Variant styles. Astra may restyle them but must keep the keys and the contrast rules (navy text on coral). */
export const VARIANT_CLASSES = {
  primary: "pressable border-border bg-action text-on-action",
  secondary: "pressable border-border bg-surface text-ink",
  quiet: "border-transparent bg-transparent text-ink underline underline-offset-4",
} as const satisfies Record<ButtonVariant, string>;

const BASE_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border-2 px-4 py-2 font-semibold " +
  "disabled:cursor-not-allowed disabled:opacity-60 data-[pending=true]:cursor-progress";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "type"> & {
  /** Defaults to "button" so buttons never submit a form by accident. */
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  /**
   * Work in progress: sets `aria-disabled`, keeps focus and the label, and suppresses clicks and form submission.
   * Progress is announced by `LiveStatus`, not by a label change.
   */
  pending?: boolean;
  /** Native `disabled`. Prefer `pending` for in-flight work so keyboard focus is not lost. */
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** A native button with a 44px minimum target. */
export function Button({
  variant = "primary",
  pending = false,
  type = "button",
  disabled,
  onClick,
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  // Attach a handler only when needed, so Server Components can render buttons without passing functions.
  const handleClick =
    onClick || pending
      ? (event: MouseEvent<HTMLButtonElement>) => {
          if (pending) {
            // Also cancels the form submission a pending submit button would otherwise trigger.
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }
      : undefined;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={pending ? true : rest["aria-disabled"]}
      data-variant={variant}
      data-pending={pending ? "true" : "false"}
      className={[BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(" ")}
      onClick={handleClick}
    >
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" /> : null}
      {children}
    </button>
  );
}
