import { describe, expect, it } from "vitest";

import { formatApplicantReference, splitIdentityResponses } from "@/lib/domain/applicant-identity";
import {
  APPLICATION_TYPE_PARAM,
  ROUTES,
  getHomeRouteForRole,
  getSafeRedirectPath,
  isProtectedPath,
  organizerApplicationRoute,
  portalApplicationRoute,
  portalMissionRoute,
  portalRoute,
  resolveApplicationType,
} from "@/lib/routes";

describe("getSafeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(getSafeRedirectPath("/portal", "/")).toBe("/portal");
    expect(
      getSafeRedirectPath("/organizer/applications/b0000000-0000-4000-8000-000000000001?view=blind", "/"),
    ).toBe("/organizer/applications/b0000000-0000-4000-8000-000000000001?view=blind");
  });

  it("rejects open redirects and malformed values", () => {
    for (const candidate of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "portal",
      "/portal\nSet-Cookie: x=y",
      "",
      undefined,
      42,
    ]) {
      expect(getSafeRedirectPath(candidate, "/fallback")).toBe("/fallback");
    }
  });
});

describe("route helpers", () => {
  it("routes roles to their home", () => {
    expect(getHomeRouteForRole("organizer")).toBe(ROUTES.organizer);
    expect(getHomeRouteForRole("hacker")).toBe(ROUTES.portal);
    expect(getHomeRouteForRole("judge")).toBe(ROUTES.portal);
  });

  it("detects protected paths by prefix segment", () => {
    expect(isProtectedPath("/portal")).toBe(true);
    expect(isProtectedPath("/portal/mission")).toBe(true);
    expect(isProtectedPath("/organizer/applications/abc")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/portalx")).toBe(false);
  });

  it("encodes application ids in organizer routes", () => {
    expect(organizerApplicationRoute("a/b")).toBe("/organizer/applications/a%2Fb");
  });

  it("names the application in every portal route", () => {
    expect(APPLICATION_TYPE_PARAM).toBe("type");
    expect(portalRoute("hacker")).toBe("/portal?type=hacker");
    expect(portalApplicationRoute("judge")).toBe("/portal/application?type=judge");
    expect(portalMissionRoute("judge")).toBe("/portal/mission?type=judge");
  });
});

describe("resolveApplicationType", () => {
  it("shows the first application when the URL names none", () => {
    expect(resolveApplicationType(["hacker", "judge"], undefined)).toEqual({ type: "hacker", canonical: true });
    expect(resolveApplicationType(["judge"], undefined)).toEqual({ type: "judge", canonical: true });
  });

  it("shows a named application the account holds", () => {
    expect(resolveApplicationType(["hacker", "judge"], "judge")).toEqual({ type: "judge", canonical: true });
    expect(resolveApplicationType(["hacker", "judge"], "hacker")).toEqual({ type: "hacker", canonical: true });
  });

  it.each([["judge"], ["organizer"], [""], ["Hacker"], ["constructor"], ["__proto__"], [["hacker", "judge"]], [42]])(
    "falls back to the first application, marked non-canonical, for %j",
    (raw) => {
      expect(resolveApplicationType(["hacker"], raw)).toEqual({ type: "hacker", canonical: false });
    },
  );

  it("returns null when the account applies for nothing", () => {
    expect(resolveApplicationType([], undefined)).toBeNull();
    expect(resolveApplicationType([], "hacker")).toBeNull();
  });
});

describe("applicant identity", () => {
  it("formats stable blind-review references", () => {
    expect(formatApplicantReference("hacker", 1042)).toBe("H-1042");
    expect(formatApplicantReference("judge", 1043)).toBe("J-1043");
  });

  it("separates identifying answers from narrative answers", () => {
    const { identity, narrative } = splitIdentityResponses("judge", {
      fullName: "Test Judge",
      birthdate: "1990-02-03",
      countryOfResidence: "CA",
      cityOfResidence: "Toronto",
      company: "Example Labs",
      githubUrl: "https://github.com/test-judge",
      bio: "Engineer",
      roleTitle: "Staff Engineer",
    });
    expect(identity).toEqual({
      fullName: "Test Judge",
      birthdate: "1990-02-03",
      countryOfResidence: "CA",
      cityOfResidence: "Toronto",
      company: "Example Labs",
      githubUrl: "https://github.com/test-judge",
    });
    expect(narrative).toEqual({ bio: "Engineer", roleTitle: "Staff Engineer" });
  });
});
