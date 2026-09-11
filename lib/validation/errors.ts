import { z } from "zod";

/** Field path (dot separated, array indexes omitted) -> messages. */
export type FieldErrors = Record<string, string[]>;

/**
 * Converts a ZodError into field errors keyed by object path.
 * depth 1 keys by top-level field ("skills"); depth 2 keeps one nested level ("scores.growth").
 */
export function toFieldErrors(error: z.ZodError, depth = 1): FieldErrors {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path
      .filter((segment): segment is string => typeof segment === "string")
      .slice(0, depth)
      .join(".");

    if (!key) {
      continue;
    }

    const messages = (fieldErrors[key] ??= []);
    if (!messages.includes(issue.message)) {
      messages.push(issue.message);
    }
  }

  return fieldErrors;
}

/** Messages for issues that are not attached to a specific field. */
export function toFormErrors(error: z.ZodError): string[] {
  return Array.from(
    new Set(
      error.issues
        .filter((issue) => !issue.path.some((segment) => typeof segment === "string"))
        .map((issue) => issue.message),
    ),
  );
}
