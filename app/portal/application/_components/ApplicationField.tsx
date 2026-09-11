"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { Combobox } from "@/components/ui/Combobox";
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
  fullName: "name",
  birthdate: "bday",
  countryOfResidence: "country-name",
  cityOfResidence: "address-level2",
  linkedinUrl: "url",
  githubUrl: "url",
  devpostUrl: "url",
  company: "organization",
  roleTitle: "organization-title",
};

const TEXT_INPUT_TYPES: Readonly<Partial<Record<ApplicationFieldConfig["kind"], "date" | "url">>> = {
  date: "date",
  profile_link: "url",
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
    required: field.required,
    optionalText: copy.optionalText ?? undefined,
  };

  switch (field.kind) {
    case "short_text":
    case "whole_number":
    case "long_text":
    case "date":
    case "profile_link": {
      const text = asText(value);
      const counted = field.kind === "long_text" && field.maxLength !== undefined;
      const count = counted ? countCharacters(text) : 0;
      return (
        <Field
          {...shared}
          label={copy.label}
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
              type={TEXT_INPUT_TYPES[field.kind]}
              min={field.kind === "date" ? field.minDate : undefined}
              max={field.kind === "date" ? field.maxDate : undefined}
              multiline={field.kind === "long_text"}
              rows={field.kind === "long_text" ? 6 : undefined}
              inputMode={field.kind === "whole_number" ? "numeric" : undefined}
              autoComplete={AUTOCOMPLETE_TOKENS[field.key]}
              spellCheck={field.kind === "profile_link" ? false : undefined}
              describedBy={control.describedBy}
              invalid={control.invalid}
              required={control.required}
            />
          )}
        </Field>
      );
    }
    case "searchable_choice": {
      return (
        <Field {...shared} label={copy.label}>
          {(control) => (
            <Combobox
              id={control.id}
              options={[...(field.options ?? [])]}
              value={asText(value)}
              onValueChange={(next) => onChange(field.key, next)}
              listLabel={copy.label}
              toggleLabel={COPY.editor.combobox.showOptions}
              noResultsText={COPY.editor.combobox.noResults}
              autoComplete={AUTOCOMPLETE_TOKENS[field.key]}
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
