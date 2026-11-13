import { describe, it, expect } from "bun:test";
import { resolveEffectiveEmail } from "../src/lib/effectiveEmail";

const ADMIN = "andrew@dna-media.net";

describe("resolveEffectiveEmail", () => {
  it("returns null when signed out, even with a stale selected account", () => {
    const r = resolveEffectiveEmail({
      actualEmail: null,
      selectedAccountEmail: "andrew@dna-media.net",
      impersonatingFlag: false,
      impersonatedBy: null,
      adminEmail: ADMIN,
    });
    expect(r.effectiveEmail).toBeNull();
    expect(r.isAccountSwitched).toBe(false);
  });

  it("returns null when signed out, even with stale impersonation flags", () => {
    const r = resolveEffectiveEmail({
      actualEmail: null,
      selectedAccountEmail: "someone@example.com",
      impersonatingFlag: true,
      impersonatedBy: ADMIN,
      adminEmail: ADMIN,
    });
    expect(r.effectiveEmail).toBeNull();
    expect(r.isImpersonating).toBe(false);
  });

  it("returns the session email for a normal signed-in user", () => {
    const r = resolveEffectiveEmail({
      actualEmail: "user@example.com",
      selectedAccountEmail: null,
      impersonatingFlag: false,
      impersonatedBy: null,
      adminEmail: ADMIN,
    });
    expect(r.effectiveEmail).toBe("user@example.com");
  });

  it("lets either platform admin impersonate a selected account", () => {
    const team = "team@yoursoftwareonboarding.com";
    const r = resolveEffectiveEmail({
      actualEmail: team,
      selectedAccountEmail: "client@example.com",
      impersonatingFlag: true,
      impersonatedBy: team,
      adminEmail: ADMIN,
      adminEmails: [ADMIN, team],
    });
    expect(r.effectiveEmail).toBe("client@example.com");
    expect(r.isImpersonating).toBe(true);
  });

  it("lets the admin impersonate a selected account", () => {
    const r = resolveEffectiveEmail({
      actualEmail: ADMIN,
      selectedAccountEmail: "client@example.com",
      impersonatingFlag: true,
      impersonatedBy: ADMIN,
      adminEmail: ADMIN,
    });
    expect(r.effectiveEmail).toBe("client@example.com");
    expect(r.isImpersonating).toBe(true);
  });

  it("ignores impersonation flags for non-admin users", () => {
    const r = resolveEffectiveEmail({
      actualEmail: "user@example.com",
      selectedAccountEmail: "client@example.com",
      impersonatingFlag: true,
      impersonatedBy: ADMIN,
      adminEmail: ADMIN,
    });
    expect(r.isImpersonating).toBe(false);
  });
});
