import { describe, expect, test } from "bun:test";
import { locationIdOf, planMenuAssignment } from "../src/lib/menuAssignment";

const menu = {
  title: "Client Hub",
  url: "https://hub.example.com",
  icon: { name: "book", fontFamily: "fas" },
  showOnCompany: false,
  showOnLocation: true,
  openMode: "iframe",
  userRole: "all",
  allowCamera: false,
  allowMicrophone: false,
};

describe("planMenuAssignment", () => {
  test("reads location ids out of objects", () => {
    expect(locationIdOf({ id: "loc_1234" })).toBe("loc_1234");
    expect(locationIdOf({ locationId: "loc_5678" })).toBe("loc_5678");
  });

  test("adding to a link shown everywhere is a no-op until restrict", () => {
    const plan = planMenuAssignment(
      { ...menu, showToAllLocations: true, locations: [] },
      "loc_aaaa",
      "add",
      { knownLocationIds: ["loc_aaaa", "loc_bbbb"] },
    );
    expect(plan.changed).toBe(false);
    expect(plan.reason).toBe("already_everywhere");
    expect(plan.body).toBeUndefined();
  });

  test("restrict builds a full menu body limited to known locations", () => {
    const plan = planMenuAssignment(
      { ...menu, showToAllLocations: true, locations: [] },
      "loc_aaaa",
      "add",
      { knownLocationIds: ["loc_bbbb"], restrict: true },
    );
    expect(plan.changed).toBe(true);
    expect(plan.locationIds).toEqual(["loc_bbbb", "loc_aaaa"]);
    expect(plan.body).toMatchObject({
      title: "Client Hub",
      url: "https://hub.example.com",
      showOnLocation: true,
      showToAllLocations: false,
      locations: ["loc_bbbb", "loc_aaaa"],
      icon: { name: "book", fontFamily: "fas" },
    });
  });

  test("removing from an everywhere link with no roster does not send an empty list", () => {
    const plan = planMenuAssignment(
      { ...menu, showToAllLocations: true, locations: [] },
      "loc_aaaa",
      "remove",
    );
    expect(plan.changed).toBe(false);
    expect(plan.reason).toBe("missing_roster");
    expect(plan.body).toBeUndefined();
  });

  test("removing one known location keeps the rest", () => {
    const plan = planMenuAssignment(
      { ...menu, showToAllLocations: false, locations: [{ id: "loc_aaaa" }, { id: "loc_bbbb" }] },
      "loc_aaaa",
      "remove",
    );
    expect(plan.changed).toBe(true);
    expect(plan.locationIds).toEqual(["loc_bbbb"]);
    expect(plan.body?.locations).toEqual(["loc_bbbb"]);
  });
});
