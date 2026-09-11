import type { ReactNode } from "react";

export interface LaunchTransitionProps {
  /** The liftoff heading, `LOCKED.launch.heading`. */
  heading: string;
  message: string;
  /** Decorative liftoff art, usually `LiftoffMoment`. */
  art?: ReactNode;
}

/**
 * The liftoff screen shown after a successful submit, before the container routes to the mission tracker.
 * `role="status"` announces the submission, and the art is hidden from assistive technology.
 */
export function LaunchTransition({ heading, message, art }: LaunchTransitionProps) {
  return (
    <div data-testid="launch-transition" role="status" className="flex flex-col items-center gap-4 py-12 text-center">
      <h1 className="text-4xl font-bold">{heading}</h1>
      <p className="text-lg">{message}</p>
      {art ? (
        <div aria-hidden="true" className="flex w-full justify-center">
          {art}
        </div>
      ) : null}
    </div>
  );
}
