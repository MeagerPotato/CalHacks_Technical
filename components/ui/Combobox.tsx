"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import type { ChoiceOptionView } from "@/components/ui/RadioGroup";
import { INPUT_CLASSES } from "@/components/ui/TextInput";

export interface ComboboxProps {
  /** Input id, for example `field-<key>`. The list is `<id>-listbox` and each option is `<id>-option-<value>`. */
  id: string;
  options: readonly ChoiceOptionView[];
  /** Selected option value, or "" for none. */
  value: string;
  /** Receives an option value, or "" once the text is cleared. Without it the combobox is read-only. */
  onValueChange?: (value: string) => void;
  /** Accessible name of the popup list, usually the field label. */
  listLabel: string;
  /** Accessible name of the button that opens the list. */
  toggleLabel: string;
  /** Shown in the popup when no option matches the typed text. */
  noResultsText: string;
  describedBy?: string;
  invalid?: boolean;
  /** Sets `aria-required` only, like `TextInput`. */
  required?: boolean;
  autoComplete?: string;
}

// Accents and case are ignored, so "aland" finds "Aland Islands" written with a ring above the A.
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function labelOf(options: readonly ChoiceOptionView[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? "";
}

// Labels that start with the typed text come first, then labels that contain it.
function filterOptions(options: readonly ChoiceOptionView[], text: string): readonly ChoiceOptionView[] {
  const needle = normalize(text);
  if (needle === "") {
    return options;
  }
  const starts: ChoiceOptionView[] = [];
  const contains: ChoiceOptionView[] = [];
  for (const option of options) {
    const label = normalize(option.label);
    if (label.startsWith(needle)) {
      starts.push(option);
    } else if (label.includes(needle)) {
      contains.push(option);
    }
  }
  return [...starts, ...contains];
}

function keepInputFocus(event: MouseEvent) {
  event.preventDefault();
}

/**
 * A single-choice combobox with a filterable listbox popup (WAI-ARIA combobox pattern, list autocomplete). Typing
 * filters the options; ArrowDown and ArrowUp move through them, Enter or a click chooses one, and Escape closes the
 * list. Typing an option's full label chooses it. When focus leaves, unfinished text returns to the chosen option's
 * label, and clearing the text clears the choice.
 */
export function Combobox({
  id,
  options,
  value,
  onValueChange,
  listLabel,
  toggleLabel,
  noResultsText,
  describedBy,
  invalid = false,
  required = false,
  autoComplete,
}: ComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => labelOf(options, value));
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // A value changed by the parent (a reload or a reset) replaces the text. Choices made here update shownValue first.
  if (value !== shownValue) {
    setShownValue(value);
    setText(labelOf(options, value));
    setFiltering(false);
  }

  const readOnly = onValueChange === undefined;
  const listboxId = `${id}-listbox`;
  const optionId = (option: ChoiceOptionView) => `${id}-option-${option.value}`;
  const visible = filtering ? filterOptions(options, text) : options;
  const activeOption = open && activeIndex >= 0 ? visible[activeIndex] : undefined;
  const activeId = activeOption ? optionId(activeOption) : undefined;

  useEffect(() => {
    if (activeId) {
      document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeId]);

  function emit(next: string) {
    setShownValue(next);
    if (next !== value) {
      onValueChange?.(next);
    }
  }

  function choose(option: ChoiceOptionView) {
    setText(option.label);
    setFiltering(false);
    setOpen(false);
    setActiveIndex(-1);
    emit(option.value);
  }

  function openList() {
    if (readOnly) {
      return;
    }
    setOpen(true);
    setFiltering(false);
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === shownValue)));
  }

  function closeList() {
    setOpen(false);
    setActiveIndex(-1);
    if (filtering) {
      setFiltering(false);
      setText(labelOf(options, shownValue));
    }
  }

  function handleTextChange(next: string) {
    setText(next);
    setFiltering(true);
    setOpen(true);
    if (next.trim() === "") {
      setActiveIndex(-1);
      emit("");
      return;
    }
    setActiveIndex(0);
    const exact = options.find((option) => normalize(option.label) === normalize(next));
    if (exact) {
      emit(exact.value);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (readOnly) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (open) {
          setActiveIndex((index) => Math.min(visible.length - 1, index + 1));
        } else {
          openList();
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) {
          setActiveIndex((index) => Math.max(0, index - 1));
        } else {
          openList();
        }
        break;
      case "Enter":
        if (activeOption) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          closeList();
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        aria-required={required ? true : undefined}
        autoComplete={autoComplete ?? "off"}
        spellCheck={false}
        value={text}
        readOnly={readOnly ? true : undefined}
        onChange={readOnly ? undefined : (event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={closeList}
        className={`${INPUT_CLASSES} pr-12`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={toggleLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        disabled={readOnly}
        onMouseDown={keepInputFocus}
        onClick={() => {
          if (open) {
            closeList();
          } else {
            openList();
            inputRef.current?.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control border-l-2 border-border bg-highlight disabled:bg-page"
      >
        <ChevronDown aria-hidden="true" className="size-5" />
      </button>
      <div
        data-state={open ? "open" : "closed"}
        hidden={!open}
        className="workshop-card absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-control border-2 border-border bg-surface shadow-card"
      >
        <ul
          id={listboxId}
          role="listbox"
          aria-label={listLabel}
          hidden={visible.length === 0}
          className="max-h-72 overflow-y-auto py-1"
        >
          {visible.map((option) => (
            <li
              key={option.value}
              id={optionId(option)}
              role="option"
              aria-selected={option.value === shownValue}
              data-active={option === activeOption ? "true" : "false"}
              onMouseDown={keepInputFocus}
              onClick={() => choose(option)}
              className="flex cursor-pointer items-center justify-between gap-3 border-b border-border/20 px-4 py-2.5 last:border-b-0 aria-selected:bg-highlight aria-selected:font-bold data-[active=true]:bg-accent"
            >
              <span>{option.label}</span>
              {option.value === shownValue ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
            </li>
          ))}
        </ul>
        {visible.length === 0 ? <p className="px-4 py-3 text-sm">{noResultsText}</p> : null}
      </div>
    </div>
  );
}
