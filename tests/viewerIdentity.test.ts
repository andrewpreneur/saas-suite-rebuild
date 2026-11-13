import { describe, expect, it } from "bun:test";
import { resolveViewerIdentity } from "../src/lib/viewerIdentity";

const DAVID = "david@buzzbullmarketing.com";
const CURTIS = "curtisv@buzzbullmarketing.com";
const PRINCESS = "princess@buzzbullmarketing.com";

describe("resolveViewerIdentity", () => {
  it("shows an accepted account admin as themselves, not the agency owner", () => {
    const identity = resolveViewerIdentity({
      actualEmail: DAVID,
      effectiveEmail: CURTIS,
      isImpersonating: false,
      accountFullName: "Curtis Valdez",
      adminName: "David Brown",
      authRole: "account_admin",
    });

    expect(identity.showsAccountAdmin).toBe(true);
    expect(identity.displayName).toBe("David Brown");
    expect(identity.displayEmail).toBe(DAVID);
    expect(identity.displayName).not.toBe("Curtis Valdez");
    expect(identity.displayEmail).not.toBe(CURTIS);
  });

  it("does not fall back to the owner full_name when admin_name is missing", () => {
    const identity = resolveViewerIdentity({
      actualEmail: DAVID,
      effectiveEmail: CURTIS,
      isImpersonating: false,
      accountFullName: "Curtis Valdez",
      adminName: "   ",
      authRole: "account_admin",
    });

    expect(identity.displayName).toBe("david");
    expect(identity.displayEmail).toBe(DAVID);
    expect(identity.displayName).not.toContain("Curtis");
  });

  it("still hides the owner name when the auth role claim is missing", () => {
    const identity = resolveViewerIdentity({
      actualEmail: "David@BuzzBullMarketing.com",
      effectiveEmail: CURTIS,
      isImpersonating: false,
      accountFullName: "Curtis Valdez",
      adminName: "David Brown",
      authRole: null,
    });

    expect(identity.displayName).toBe("David Brown");
    expect(identity.displayEmail).toBe(DAVID);
  });

  it("uses each admin's own name when several people share one owner account", () => {
    const princess = resolveViewerIdentity({
      actualEmail: PRINCESS,
      effectiveEmail: CURTIS,
      isImpersonating: false,
      accountFullName: "Curtis Valdez",
      adminName: "Princess Nazareno",
      authRole: "account_admin",
    });

    expect(princess.displayName).toBe("Princess Nazareno");
    expect(princess.displayEmail).toBe(PRINCESS);
    expect(princess.displayName).not.toBe("Curtis Valdez");
  });

  it("shows the owner their own account name when they are not switched", () => {
    const identity = resolveViewerIdentity({
      actualEmail: CURTIS,
      effectiveEmail: CURTIS,
      isImpersonating: false,
      accountFullName: "Curtis Valdez",
      adminName: null,
      authRole: null,
    });

    expect(identity.showsAccountAdmin).toBe(false);
    expect(identity.displayName).toBe("Curtis Valdez");
    expect(identity.displayEmail).toBe(CURTIS);
  });

  it("keeps platform login-as on the customer account being viewed", () => {
    const identity = resolveViewerIdentity({
      actualEmail: "andrew@dna-media.net",
      effectiveEmail: CURTIS,
      isImpersonating: true,
      accountFullName: "Curtis Valdez",
      adminName: "Andrew",
      authRole: null,
    });

    expect(identity.showsAccountAdmin).toBe(false);
    expect(identity.displayName).toBe("Curtis Valdez");
    expect(identity.displayEmail).toBe(CURTIS);
  });
});
