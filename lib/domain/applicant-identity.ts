import type { ApplicationType } from "@/lib/domain/enums";
import type { ApplicationFieldKey } from "@/lib/validation/application";

/**
 * Response keys that identify an applicant and are withheld in blind review
 * (name, school/employer, profile links). Email lives on the profile and is also withheld.
 */
export const IDENTITY_RESPONSE_KEYS = {
  hacker: ["preferredName", "school", "links"],
  judge: ["preferredName", "company", "links"],
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
