"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { Field, FieldGroup } from "@/components/ui/Field";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextInput } from "@/components/ui/TextInput";
import { COPY } from "@/content/copy";
import type { ApplicationFieldConfig } from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { fieldControlId, fieldCounterId } from "@/lib/editor/steps";
import { countCharacters, type UiValue } from "@/lib/editor/values";
import { resolveFieldCopy } from "@/lib/view-models/fields";

interface ApplicationFieldProps {
  type: ApplicationType;
  field: ApplicationFieldConfig;
  value: UiValue | undefined;
  errors: readonly string[] | undefined;
  onChange(key: string, value: UiValue): void;
}

function asText(value: UiValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function asList(value: UiValue | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

/** Input purposes for fields about the applicant (WCAG 1.3.5), so browsers can offer saved details. */
const AUTOCOMPLETE_TOKENS: Readonly<Partial<Record<string, string>>> = {
  preferredName: "nickname",
  company: "organization",
  roleTitle: "organization-title",
};

/** Maps one application field to its form primitive, wiring ids, generated hints, counters, and errors. */
export function ApplicationField({ type, field, value, errors, onChange }: ApplicationFieldProps) {
  const copy = resolveFieldCopy(type, field);
  const id = fieldControlId(field.key);
  const errorList = errors && errors.length > 0 ? [...errors] : undefined;
  const invalid = errorList !== undefined;
  const shared = {
    id,
    hint: copy.hint ?? undefined,
    help: copy.help ?? undefined,
    errors: errorList,
    optionalText: copy.optionalText ?? undefined,
  };

  switch (field.kind) {
    case "short_text":
    case "whole_number":
    case "long_text":
    case "link_list": {
      const text = asText(value);
      const counted = field.kind === "long_text" && field.maxLength !== undefined;
      const count = counted ? countCharacters(text) : 0;
      return (
        <Field
          {...shared}
          label={copy.label}
          required={field.required}
          counter={
            counted && field.maxLength !== undefined
              ? { current: count, max: field.maxLength, text: COPY.editor.characterCount(count, field.maxLength) }
              : undefined
          }
        >
          {(control) => (
            <TextInput
              id={control.id}
              name={field.key}
              value={text}
              onValueChange={(next) => onChange(field.key, next)}
              multiline={field.kind === "long_text" || field.kind === "link_list"}
              rows={field.kind === "long_text" ? 6 : field.kind === "link_list" ? 3 : undefined}
              inputMode={field.kind === "whole_number" ? "numeric" : undefined}
              autoComplete={field.kind === "link_list" ? "off" : AUTOCOMPLETE_TOKENS[field.key]}
              spellCheck={field.kind === "link_list" ? false : undefined}
              describedBy={control.describedBy}
              invalid={control.invalid}
              required={control.required}
            />
          )}
        </Field>
      );
    }
    case "single_choice": {
      const selected = asText(value);
      return (
        <FieldGroup {...shared} legend={copy.label}>
          <RadioGroup
            idPrefix={id}
            name={field.key}
            options={[...(field.options ?? [])]}
            value={selected}
            onValueChange={(next) => onChange(field.key, next)}
            clearable={
              field.required ? undefined : { label: COPY.editor.clearSelection, onClear: () => onChange(field.key, "") }
            }
            invalid={invalid}
          />
        </FieldGroup>
      );
    }
    case "multi_choice": {
      const selected = asList(value);
      const counter =
        field.maxItems === undefined
          ? undefined
          : {
              current: selected.length,
              max: field.maxItems,
              text: COPY.editor.selectedCount(selected.length, field.maxItems),
            };
      return (
        <FieldGroup {...shared} legend={copy.label} counter={counter}>
          <CheckboxGroup
            idPrefix={id}
            name={field.key}
            options={[...(field.options ?? [])]}
            value={selected}
            onValueChange={(next) => onChange(field.key, next)}
            maxItems={field.maxItems}
            describedBy={counter ? fieldCounterId(field.key) : undefined}
            invalid={invalid}
          />
        </FieldGroup>
      );
    }
    case "agreement": {
      return (
        <FieldGroup {...shared} legend={copy.label}>
          <Checkbox
            id={id}
            name={field.key}
            label={field.key === "codeOfConductAccepted" ? COPY.fields.codeOfConductAgreement : copy.label}
            checked={value === true}
            onCheckedChange={(checked) => onChange(field.key, checked)}
            invalid={invalid}
            required={field.required}
          />
        </FieldGroup>
      );
    }
    default: {
      const unsupported: never = field.kind;
      return unsupported;
    }
  }
}
