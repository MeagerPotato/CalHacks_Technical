import { describe, expect, it } from "vitest";

import type { ApplicationStatus } from "@/lib/domain/enums";
import { deriveMissionState } from "@/lib/domain/mission";

const LAUNCHED = "2026-09-01T10:00:00.000Z";
const REVIEW_STARTED = "2026-09-02T10:00:00.000Z";
const RELEASED = "2026-09-03T10:00:00.000Z";

function fieldsFor(status: ApplicationStatus) {
  return {
    status,
    launched_at: status === "draft" ? null : LAUNCHED,
    review_started_at: ["in_review", "accepted", "waitlisted"].includes(status) ? REVIEW_STARTED : null,
    decision_released_at: ["accepted", "waitlisted"].includes(status) ? RELEASED : null,
  };
}

describe("deriveMissionState", () => {
  it.each([
    ["draft", "assembly", ["upcoming", "upcoming", "upcoming"], false, null],
    ["submitted", "cruise", ["complete", "current", "upcoming"], false, null],
    ["in_review", "cruise", ["complete", "current", "upcoming"], true, null],
    ["accepted", "landing", ["complete", "complete", "complete"], false, "accepted"],
    ["waitlisted", "landing", ["complete", "complete", "complete"], false, "waitlisted"],
  ] as const)("maps %s to the %s stage", (status, stage, legStates, isUnderReview, decision) => {
    const mission = deriveMissionState(fieldsFor(status));

    expect(mission.stage).toBe(stage);
    expect(mission.legs.map((leg) => leg.state)).toEqual(legStates);
    expect(mission.isUnderReview).toBe(isUnderReview);
    expect(mission.decision).toBe(decision);
    expect(mission.isSubmitted).toBe(status !== "draft");
  });

  it("exposes only real workflow timestamps", () => {
    const mission = deriveMissionState(fieldsFor("accepted"));
    expect(mission.legs.map((leg) => leg.occurredAt)).toEqual([LAUNCHED, REVIEW_STARTED, RELEASED]);
    expect(mission).toMatchObject({
      launchedAt: LAUNCHED,
      reviewStartedAt: REVIEW_STARTED,
      decisionReleasedAt: RELEASED,
    });
  });

  it("does not invent a review start for submitted applications", () => {
    const mission = deriveMissionState(fieldsFor("submitted"));
    expect(mission.legs[1].occurredAt).toBeNull();
  });
});
