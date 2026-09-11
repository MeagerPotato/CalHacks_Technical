import { z } from "zod";

import { APPLICATION_TYPES } from "@/lib/domain/enums";

// Matches supabase/config.toml [auth] minimum_password_length. bcrypt ignores bytes past 72.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const DISPLAY_NAME_MAX_LENGTH = 80;

export const emailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(254, { error: "Enter a valid email address." })
  .pipe(z.email({ error: "Enter a valid email address." }));

const displayNameSchema = z
  .string({ error: "Enter a display name." })
  .trim()
  .min(1, { error: "Enter a display name." })
  .max(DISPLAY_NAME_MAX_LENGTH, { error: `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.` });

const APPLICATION_TYPES_MESSAGE = "Choose Hacker, Judge, or both.";

// Checked as a whole list, so every problem is reported on `applicationTypes` itself rather than on one list item.
const applicationTypesSchema = z.preprocess(
  // One checked checkbox arrives from FormData as a string rather than an array.
  (value) => (typeof value === "string" ? [value] : value),
  z
    .array(z.unknown(), { error: APPLICATION_TYPES_MESSAGE })
    .refine(
      (values) =>
        values.length >= 1 &&
        values.length <= APPLICATION_TYPES.length &&
        new Set(values).size === values.length &&
        values.every((value) => APPLICATION_TYPES.some((type) => type === value)),
      { error: APPLICATION_TYPES_MESSAGE },
    )
    .transform((values) => APPLICATION_TYPES.filter((type) => values.includes(type))),
);

export const signUpSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Enter a password." })
    .min(PASSWORD_MIN_LENGTH, { error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` })
    .max(PASSWORD_MAX_LENGTH, { error: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.` }),
  /**
   * Hacker, Judge, or both, from one or two checkboxes, returned in form order. Organizer can never be requested by a
   * public signup.
   */
  applicationTypes: applicationTypesSchema,
  /** Optional at signup; can be set later with updateProfile. Blank is treated as absent. */
  displayName: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    displayNameSchema.optional(),
  ),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Enter your password." })
    .min(1, { error: "Enter your password." })
    .max(PASSWORD_MAX_LENGTH, { error: "Enter your password." }),
  /** Optional relative path to continue to after signing in. Unsafe values are ignored. */
  next: z.string().max(2048).optional(),
});

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
