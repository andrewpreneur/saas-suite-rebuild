import { expect, test } from "bun:test";
import { loadGhlSnapshot } from "../src/components/highlevel/loadGhlSnapshot";

test("refresh without menus syncs before reading newly created sub-accounts", async () => {
  const calls: string[] = [];
  let locations = [{ location_id: "existing" }];
  const request = async (action: string) => {
    calls.push(action);
    if (action === "status") return { connection: { connected: true } };
    if (action === "sync") locations = [...locations, { location_id: "new-account" }];
    return { locations };
  };
  const result = await loadGhlSnapshot(request as any, "gti-studio", true, false);
  expect(calls).toEqual(["status", "sync", "locations"]);
  expect(result.locations.map(l => l.location_id)).toEqual(["existing", "new-account"]);
});

test("menu refresh reads both lists after sync completes", async () => {
  const calls: string[] = [];
  const result = await loadGhlSnapshot((async (action: string) => {
    calls.push(action);
    return { connection: { connected: true }, locations: [], menus: [{ menu_id: "fresh-menu" }] };
  }) as any, "gti-studio", true, true);
  expect(calls).toEqual(["status", "sync", "locations", "menus"]);
  expect(result.menus[0]?.menu_id).toBe("fresh-menu");
});

test("failed sync is not swallowed or presented as fresh data", async () => {
  const calls: string[] = [];
  await expect(loadGhlSnapshot((async (action: string) => {
    calls.push(action);
    if (action === "sync") throw new Error("HighLevel denied access");
    return { connection: { connected: true } };
  }) as any, "gti-studio", true, false)).rejects.toThrow("HighLevel denied access");
  expect(calls).toEqual(["status", "sync"]);
});

test("opening installation menus syncs even without pressing Refresh", async () => {
  const calls: string[] = [];
  let menus = [{ menu_id: "old-paul-link" }];
  const result = await loadGhlSnapshot((async (action: string) => {
    calls.push(action);
    if (action === "sync") menus = [{ menu_id: "new-lightwork-link" }];
    return { connection: { connected: true }, locations: [], menus };
  }) as any, "lightwork-digital", false, true);
  expect(calls).toEqual(["status", "sync", "locations", "menus"]);
  expect(result.menus[0]?.menu_id).toBe("new-lightwork-link");
});