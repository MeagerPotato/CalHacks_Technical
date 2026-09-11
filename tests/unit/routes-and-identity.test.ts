import { describe, expect, it } from "vitest";

import { formatApplicantReference, splitIdentityResponses } from "@/lib/domain/applicant-identity";
import {
  ROUTES,
  getHomeRouteForRole,
  getSafeRedirectPath,
  isProtectedPath,
  organizerApplicationRoute,
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
});

describe("applicant identity", () => {
  it("formats stable blind-review references", () => {
    expect(formatApplicantReference("hacker", 1042)).toBe("H-1042");
    expect(formatApplicantReference("judge", 1043)).toBe("J-1043");
  });

  it("separates identifying answers from narrative answers", () => {
    const { identity, narrative } = splitIdentityResponses("judge", {
      preferredName: "Test Judge",
      company: "Example Labs",
      links: ["https://example.com"],
      bio: "Engineer",
      roleTitle: "Staff Engineer",
    });
    expect(identity).toEqual({
      preferredName: "Test Judge",
      company: "Example Labs",
      links: ["https://example.com"],
    });
    expect(narrative).toEqual({ bio: "Engineer", roleTitle: "Staff Engineer" });
  });
});
