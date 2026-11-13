import { describe, expect, it } from "bun:test";
import { affiliatePortalEmail, affiliateQueryData } from "../src/lib/affiliatePortal";

describe("affiliate portal ownership", () => {
  it("keeps Shaf's personal affiliate while he manages another agency", () => {
    expect(affiliatePortalEmail({ actualEmail: "team@launchyoursaasagency.com", effectiveEmail: "chris@thepivotplan.com", isImpersonating: false })).toBe("team@launchyoursaasagency.com");
  });
  it("preserves verified platform impersonation", () => {
    expect(affiliatePortalEmail({ actualEmail: "andrew@dna-media.net", effectiveEmail: "team@launchyoursaasagency.com", isImpersonating: true })).toBe("team@launchyoursaasagency.com");
  });
  it("normalizes email before queries and applications", () => {
    expect(affiliatePortalEmail({ actualEmail: " TEAM@LaunchYourSaasAgency.com ", effectiveEmail: null, isImpersonating: false })).toBe("team@launchyoursaasagency.com");
  });
  it("does not use a stale selected account after signout", () => {
    expect(affiliatePortalEmail({ actualEmail: null, effectiveEmail: "team@launchyoursaasagency.com", isImpersonating: false })).toBeNull();
  });
});

describe("affiliate reads", () => {
  it("surfaces denied reads instead of offering a new application", () => {
    expect(() => affiliateQueryData({ data: null, error: { message: "permission denied" } })).toThrow("permission denied");
  });
  it("surfaces duplicate identity errors", () => {
    expect(() => affiliateQueryData({ data: null, error: { message: "multiple rows returned" } })).toThrow("multiple rows returned");
  });
  it("allows a genuinely absent application", () => {
    expect(affiliateQueryData({ data: null, error: null })).toBeNull();
  });
});