import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { menuRemovalBodies, menuRemovalInstallCodes, MENU_REMOVAL_GUIDE_POLICY, ensureMenuRemovalWidget, resolveMenuRemovalLink, nextMenuRemovalStep, shouldOfferMenuRemovalVideo, ensureMenuRemovalVideo } from "../supabase/functions/_shared/menuRemovalGuide";
import { buildBuyerResolverCode } from "../src/lib/menuRemovalWorkflowCode";

test("the shared guide never contains the paid snapshot share id", () => {
  expect(MENU_REMOVAL_GUIDE_POLICY.includes("9aTIob1kR5WoGoRtNzin")).toBe(false);
  expect(readFileSync("supabase/functions/_shared/menuRemovalGuide.ts", "utf8").includes("9aTIob1kR5WoGoRtNzin")).toBe(false);
});
test("payloads preserve selected account, preset and menu ID without invalid JSON", () => {
  const bodies = menuRemovalBodies("paul-4", 'Preset "A"', "menu-123");
  expect(JSON.parse(bodies.preset)).toEqual({ location_id: "{{custom_code.1.output.location_id}}", email: "{{contact.email}}", preset_name: 'Preset "A"', agency_id: "paul-4" });
  expect(JSON.parse(bodies.assign)).toEqual({ action: "add", agency_id: "paul-4", menu_link_id: "menu-123", location_id: "{{custom_code.1.output.location_id}}" });
});
test("both install codes belong to the owner's agency", () => {
  const codes = menuRemovalInstallCodes("paul-4");
  expect(codes.css).toBe("@import url('https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=paul-4&type=css');");
  expect(codes.js).toBe('<script src="https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=paul-4&type=js" data-user-type="{{user.type}}" data-user-role="{{user.role}}" data-user-email="{{user.email}}" data-user-name="{{user.name}}" data-user-id="{{user.id}}" data-company-id="{{user.companyId}}"></script>');
});
test("menu-removal followups always retain resources without duplicate cards", () => {
  expect(ensureMenuRemovalWidget("Next step", true)).toBe("Next step\n\n[[widget:menu_removal_setup]]");
  expect(ensureMenuRemovalWidget("[[widget:menu_removal_setup]]", true)).toBe("[[widget:menu_removal_setup]]");
  expect(ensureMenuRemovalWidget("[[widget:upgrade]]", true)).toBe("[[widget:upgrade]]");
  expect(ensureMenuRemovalWidget("Hello", false)).toBe("Hello");
});
async function resolve(users: unknown[], company = "company-1") {
  const run = new Function("inputData", "customRequest", `return (async () => { let output; ${buildBuyerResolverCode("company-1", "fresh-token")} return output; })();`);
  return run({ email: " BUYER@EXAMPLE.COM " }, { get: async (url: string) => url.includes("users/search") ? { data: { users } } : { data: { location: { companyId: company } } } });
}
test("resolver returns real buyer user and location outputs", async () => {
  expect(await resolve([{ id: "u1", email: "buyer@example.com", locationIds: ["loc1"] }])).toEqual({ location_id: "loc1", user_id: "u1", email: "buyer@example.com" });
});
test("resolver never picks a different email", async () => {
  await expect(resolve([{ id: "u1", email: "other@example.com", locationIds: ["loc1"] }])).rejects.toThrow("exactly one HighLevel user");
});
test("resolver refuses ambiguous sub-accounts", async () => {
  await expect(resolve([{ id: "u1", email: "buyer@example.com", locationIds: ["loc1", "loc2"] }])).rejects.toThrow("exactly one sub-account");
});
test("resolver refuses another company's location", async () => {
  await expect(resolve([{ id: "u1", email: "buyer@example.com", locationIds: ["loc1"] }], "wrong-company")).rejects.toThrow("does not belong to your agency");
});
test("menu ID resolves legacy hub URLs and Basic/Advanced plan aliases automatically", () => {
  expect(resolveMenuRemovalLink([{ menu_id: "installed", url: "https://yoursoftwareonboarding.com/paul-4-2" }], null, "paul-4")).toBe("installed");
  expect(resolveMenuRemovalLink([{ menu_id: "installed", url: "https://yoursoftwareonboarding.com/v2/paul-4" }], null, "paul-4")).toBe("installed");
});
test("explicit saved menu assignment wins; stale IDs fall back to installed hub", () => {
  const menus = [{ menu_id: "explicit", url: "https://example.com" }, { menu_id: "hub", url: "https://yoursoftwareonboarding.com/paul-4" }];
  expect(resolveMenuRemovalLink(menus, "explicit", "paul-4")).toBe("explicit");
  expect(resolveMenuRemovalLink(menus, "stale", "paul-4")).toBe("hub");
});
test("ambiguous links and other agencies are never auto-selected", () => {
  expect(resolveMenuRemovalLink([{ menu_id: "a", url: "https://yoursoftwareonboarding.com/paul-4" }, { menu_id: "b", url: "https://yoursoftwareonboarding.com/v2/paul-4" }], null, "paul-4")).toBe("");
  expect(resolveMenuRemovalLink([{ menu_id: "a", url: "https://yoursoftwareonboarding.com/paul-40" }, { menu_id: "b", url: "https://evil.com/paul-4" }], null, "paul-4")).toBe("");
});
test("workflow advances one step and stops at boundaries", () => {
  expect(nextMenuRemovalStep(0, 1)).toBe(1);
  expect(nextMenuRemovalStep(3, -1)).toBe(2);
  expect(nextMenuRemovalStep(0, -1)).toBe(0);
  expect(nextMenuRemovalStep(6, 1)).toBe(6);
});
test("menu-removal replies strip model screenshot dumps and duplicate setup cards", () => {
  const result = ensureMenuRemovalWidget("[[screenshot:configurefirstcodeaction1]]\n[[screenshot:testfirstcodeaction]]\n[[widget:menu_removal_setup]]\n[[widget:menu_removal_setup]]", true);
  expect(result.includes("[[screenshot:")).toBe(false);
  expect(result.match(/\[\[widget:menu_removal_setup\]\]/g)?.length).toBe(1);
});

 test("focused training appears on first relevant reply, not each followup", () => {
  expect(shouldOfferMenuRemovalVideo([], true)).toBe(true);
  expect(shouldOfferMenuRemovalVideo([], false)).toBe(false);
  expect(shouldOfferMenuRemovalVideo([{ role: "assistant", content: "[[widget:menu_removal_video]]" }, { role: "user", content: "Done, next step" }], true)).toBe(false);
});
test("training requests bring the video back after an earlier offer", () => {
  for (const content of ["Bring back the video", "Can I watch again?", "Show the tutorial", "Replay the training"]) {
    expect(shouldOfferMenuRemovalVideo([{ role: "assistant", content: "[[widget:menu_removal_video]]" }, { role: "user", content }], true)).toBe(true);
  }
  expect(ensureMenuRemovalVideo("Next step", true)).toContain("[[widget:menu_removal_video]]");
  expect(ensureMenuRemovalVideo("[[widget:menu_removal_video]]", true).match(/menu_removal_video/g)?.length).toBe(1);
});
