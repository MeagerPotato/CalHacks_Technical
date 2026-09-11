import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * Classifies a Server Action call that threw instead of returning an ActionResult. An unrecognized action means
 * this tab is running an older deployment and must reload; anything else is treated as a network failure.
 * Client components only.
 */
export function classifyThrownAction(error: unknown): "network" | "stale_deployment" {
  return unstable_isUnrecognizedActionError(error) ? "stale_deployment" : "network";
}
