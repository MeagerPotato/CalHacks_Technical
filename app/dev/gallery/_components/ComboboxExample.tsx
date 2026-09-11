"use client";

import { useState } from "react";

import { Combobox } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/Field";
import { COPY } from "@/content/copy";
import { COUNTRY_OPTIONS } from "@/lib/application-config";

// Development-only text describes the gallery example itself; product copy comes from content/copy.ts.
const LABEL = "What is your country of residence?";

/** An interactive country picker, so the popup, the active option, and the selected option can be styled. */
export function ComboboxExample() {
  const [value, setValue] = useState("US");

  return (
    <Field id="gallery-field-country" label={LABEL} hint={COPY.editor.hints.searchableChoice} required>
      {(control) => (
        <Combobox
          id={control.id}
          options={COUNTRY_OPTIONS}
          value={value}
          onValueChange={setValue}
          listLabel={LABEL}
          toggleLabel={COPY.editor.combobox.showOptions}
          noResultsText={COPY.editor.combobox.noResults}
          describedBy={control.describedBy}
          invalid={control.invalid}
          required={control.required}
          autoComplete="country"
        />
      )}
    </Field>
  );
}
