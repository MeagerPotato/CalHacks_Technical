/**
 * Converts FormData into a plain object for Zod parsing. Repeated keys become arrays;
 * File entries are ignored (uploads are out of scope).
 */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).filter((value): value is string => typeof value === "string");
    if (values.length === 0) {
      continue;
    }
    result[key] = values.length === 1 ? values[0] : values;
  }

  return result;
}

/** Accepts either FormData (from <form action>) or a plain object (from client state). */
export function toPlainInput(input: unknown): unknown {
  if (typeof FormData !== "undefined" && input instanceof FormData) {
    return formDataToObject(input);
  }
  return input;
}
