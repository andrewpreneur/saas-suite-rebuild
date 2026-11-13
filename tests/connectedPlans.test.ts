import { expect, test } from "bun:test";
import { discoverPlanLinks, eligiblePlanLink, multiPlanAllowed, planMenuCSS, planMenuJS, inspectInstalledAsset, menuOrderIds } from "../supabase/functions/_shared/connectedPlans";

const ids = ["fast-track-digital-agency", "fasttrackdigitalagency-2", "fast-track-digital-agency-3"];
const menus = ids.map((id, i) => ({ menu_id: `menu-${i + 1}`, url: `https://yoursoftwareonboarding.com/v2/${id}`, all_locations: false, location_ids: [`location-${i + 1}`] }));
const links = discoverPlanLinks(ids, menus).links;
test("Rob's EMR and Education & Support both keep top ordering across his plan configs", () => {
  const hub = "ae7c0c50-fc2e-4a5b-b96a-fa3ffb571679";
  const emr = "fa30583d-6d61-4cc9-9823-190b7d72acb7";
  const robLinks = discoverPlanLinks(["med-spa-marketing-ai"], [{ menu_id: hub, url: "https://yoursoftwareonboarding.com/v2/med-spa-marketing-ai", all_locations: true }]).links;
  expect(menuOrderIds(robLinks, [hub, hub, emr, hub])).toEqual([hub, emr]);
});
test("configured non-Hub links never become redirect candidates", () => {
  const extra = "fa30583d-6d61-4cc9-9823-190b7d72acb7";
  expect(menuOrderIds(links, [extra, 'invalid\"selector'])).toEqual(["menu-1", "menu-2", "menu-3", extra]);
  expect(eligiblePlanLink(links, "unassigned", [extra])).toBeNull();
});
test("installed-code audit distinguishes exact plan id, CSS/JS and unavailable settings", () => {
  expect(inspectInstalledAsset(undefined, ids[0], "js")).toBeNull();
  expect(inspectInstalledAsset(`<script src="https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=${ids[0]}&type=js"></script>`, ids[0], "js")).toBe(true);
  expect(inspectInstalledAsset(`https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=${ids[0]}-3&type=js`, ids[0], "js")).toBe(false);
  expect(inspectInstalledAsset(`https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=${ids[0]}&type=css`, ids[0], "js")).toBe(false);
});
test("Plan 1 stays available without HighLevel", () => { expect(multiPlanAllowed("plan1", false, false)).toBe(true); });
test("Plan 2 requires both Advanced and connected HighLevel", () => {
  expect(multiPlanAllowed("plan2", true, false)).toBe(false);
  expect(multiPlanAllowed("plan2", false, true)).toBe(false);
  expect(multiPlanAllowed("plan2", true, true)).toBe(true);
});
test("Plan 3 requires both Advanced and connected HighLevel", () => {
  expect(multiPlanAllowed("plan3", true, false)).toBe(false);
  expect(multiPlanAllowed("plan3", false, true)).toBe(false);
  expect(multiPlanAllowed("plan3", true, true)).toBe(true);
});
test("all three exact real plan URLs resolve without generating a slug or manual ID", () => {
  expect(links.map(l => l.menuId)).toEqual(["menu-1", "menu-2", "menu-3"]);
  expect(links[1]?.agencyId).toBe("fasttrackdigitalagency-2");
  expect(discoverPlanLinks(ids, [...menus, { ...menus[1], menu_id: "duplicate" }]).unresolved).toEqual([ids[1]]);
  expect(discoverPlanLinks(ids, menus.map(m => ({ ...m, url: m.url.replace("yoursoftwareonboarding.com", "evil.example") }))).links).toEqual([]);
});
test("a location only redirects to its assigned and visible plan", () => {
  expect(eligiblePlanLink(links, "location-2", ["menu-1", "menu-2", "menu-3"])?.menuId).toBe("menu-2");
  expect(eligiblePlanLink(links, "unassigned", ["menu-1"])).toBeNull();
  expect(eligiblePlanLink(links, "location-2", ["menu-1"])).toBeNull();
  expect(eligiblePlanLink(links.map(l => ({ ...l, allLocations: true })), "location-2", ["menu-1", "menu-2"])).toBeNull();
});
test("generated installation serves all three owned links and no unrelated link", () => {
  for (const asset of [planMenuCSS(links), planMenuJS(links, true)]) {
    for (const id of ["menu-1", "menu-2", "menu-3"]) expect(asset).toContain(id);
    expect(asset).not.toContain("unrelated-menu");
  }
});