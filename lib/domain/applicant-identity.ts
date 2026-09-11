import type { ApplicationType } from "@/lib/domain/enums";
import type { ApplicationFieldKey } from "@/lib/validation/application";

/** About you answers that identify an applicant: name, birthdate, where they live, and profile links. */
const ABOUT_YOU_IDENTITY_KEYS = [
  "fullName",
  "birthdate",
  "countryOfResidence",
  "cityOfResidence",
  "linkedinUrl",
  "githubUrl",
  "devpostUrl",
] as const;

/**
 * Response keys that identify an applicant and are withheld in blind review (the About you identity answers plus
 * school or employer). Email lives on the profile and is also withheld.
 */
export const IDENTITY_RESPONSE_KEYS = {
  hacker: [...ABOUT_YOU_IDENTITY_KEYS, "school"],
  judge: [...ABOUT_YOU_IDENTITY_KEYS, "company"],
} as const satisfies {
  hacker: readonly ApplicationFieldKey<"hacker">[];
  judge: readonly ApplicationFieldKey<"judge">[];
};

/** Stable, non-identifying label such as "H-1042" (Hacker) or "J-1043" (Judge). */
export function formatApplicantReference(type: ApplicationType, referenceNumber: number): string {
  return `${type === "hacker" ? "H" : "J"}-${referenceNumber}`;
}

export function isIdentityResponseKey(type: ApplicationType, key: string): boolean {
  return (IDENTITY_RESPONSE_KEYS[type] as readonly string[]).includes(key);
}

/** Splits responses into identifying answers and the remaining narrative answers. */
export function splitIdentityResponses<R extends Record<string, unknown>>(
  type: ApplicationType,
  responses: R,
): { identity: Partial<R>; narrative: Partial<R> } {
  const identity: Partial<R> = {};
  const narrative: Partial<R> = {};

  for (const key of Object.keys(responses) as (keyof R & string)[]) {
    if (isIdentityResponseKey(type, key)) {
      identity[key] = responses[key];
    } else {
      narrative[key] = responses[key];
    }
  }

  return { identity, narrative };
}
