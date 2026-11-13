import { expect, test } from "bun:test";
import { applyUnverifiedClaimGuard, JSON_UNVERIFIED_NOTE } from "../supabase/functions/chat-copilot/claimGuard";
import { dynamicAssetUrls, menuDiagnostic, handoverReply } from "../supabase/functions/chat-copilot/reliabilityPolicy";
import { isAiResumeRequest } from "../supabase/functions/chat-copilot/handoverQuiet";

test("complaints mentioning AI do not accidentally resume human-support conversations", () => {
  expect(isAiResumeRequest("I kept trying to use the AI copilot again and it is broken")).toBe(false);
  expect(isAiResumeRequest("I want human support, not to talk to the AI again")).toBe(false);
  expect(isAiResumeRequest("turn the AI copilot back on")).toBe(true);
});

test("unsupported fixes, tickets and invented endpoints are replaced, not disclaimed", () => {
  for (const claim of ["I've rebuilt and corrected your video links.", "I opened a billing ticket.", "I fixed it.", "I have installed the script.", "The ticket was created.", "Use /functions/v1/diagnose-menu-link-removal", "POST /api/fix-my-install"]) {
    const result = applyUnverifiedClaimGuard(claim, { wrote: false, facts: {}, note: JSON_UNVERIFIED_NOTE });
    expect(result.fired).toBe(true);
    expect(result.content).not.toContain(claim);
  }
});
test("an unrelated successful write cannot authorize a ticket or visible fix claim", () => {
  const result = applyUnverifiedClaimGuard("I've fixed the videos and opened a ticket.", { wrote: true, facts: {}, note: JSON_UNVERIFIED_NOTE, confirmedMessages: ["Brand color saved on our side."] });
  expect(result.content).toContain("Brand color saved on our side.");
  expect(result.content).not.toContain("opened a ticket");
  expect(result.content).not.toContain("fixed the videos");
});
test("menu diagnostics use supported agency_id and select JS for location-scoped rules", () => {
  expect(dynamicAssetUrls("paul-4").js).toBe("https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=paul-4&type=js");
  const rules = [{ is_active: true, sub_account_id: "testloc", hidden_links: ["#sb_contacts"] }, { is_active: false, hidden_links: ["#sb_disabled"] }];
  const result = menuDiagnostic(rules, "testloc", { ok: true, status: 200, body: 'html[data-ss-location=\\"testloc\\"] #sb_contacts { display: none !important; }' }, { ok: true, status: 200, body: "" });
  expect(result.activeRules).toBe(1);
  expect(result.checks[0]).toMatchObject({ asset: "js", matched: 1, hiding: true });
  expect(result.browserVerified).toBe(false);
});
test("failed asset checks do not report empty configuration or a visible installation result", () => {
  const result = menuDiagnostic([{ is_active: true, hidden_links: ["#sb_contacts"] }], "", { ok: true, status: 200, body: "" }, { ok: false, status: 400, body: "Missing agency_id" });
  expect(result.activeRules).toBe(1);
  expect(result.checks[0].reachable).toBe(false);
  expect(result.checks[0].hiding).toBe(false);
  expect(result.browserVerified).toBe(false);
});
test("human support requires delivered notification and persisted pause for success", () => {
  expect(handoverReply("sent", true)).toMatchObject({ success: true, notificationDelivered: true, handover: true });
  for (const delivery of ["failed", "unknown", "excluded", "skipped", "scheduled"]) {
    expect(handoverReply(delivery, true)).toMatchObject({ success: false, notificationDelivered: false, handover: true });
  }
  expect(handoverReply("sent", false)).toMatchObject({ success: false, handover: false });
});