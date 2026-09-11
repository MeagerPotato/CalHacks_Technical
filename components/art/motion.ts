/**
 * Length of the liftoff transition shown after a successful submit, in milliseconds.
 * Must equal `--duration-liftoff` in app/globals.css; tests/unit/design-tokens.test.ts enforces it.
 */
export const LIFTOFF_DURATION_MS = 2400;

/**
 * Length of the mission landing moment, in milliseconds. The decision card reveal waits this long.
 * Must equal `--duration-landing` in app/globals.css; tests/unit/design-tokens.test.ts enforces it.
 */
export const LANDING_DURATION_MS = 1600;
