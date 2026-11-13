import { expect, test } from "bun:test";
import { AUTO_PRESET_PREFIX, archiveSidebar, isAutoPreset, readBrandingPresets, removePreset, upsertPreset } from "../src/lib/brandingPresets";
import { updateBrandingPart, splitBrandingCSS } from "../src/lib/brandingSections";

test("switching each style saves its old sidebar outside live CSS", () => {
  for (const version of ["v1", "v2", "v3"]) {
    const old = updateBrandingPart("", "sidebar", version);
    const presets = archiveSidebar([], old, "replacement", "backup", "Previous setup");
    expect(splitBrandingCSS(presets[0]?.css || "").sidebar).toBe(version);
    expect(old).toContain(version);
  }
});
test("removing sidebar keeps a restorable backup", () => {
  expect(archiveSidebar([], "current-sidebar", "", "backup", "Previous setup")[0]?.css).toBe("current-sidebar");
});
test("unchanged sidebar and unrelated login changes never add duplicate backups", () => {
  const presets = [{ id: "saved", name: "Saved", css: updateBrandingPart("", "sidebar", "same-sidebar") }];
  const css = updateBrandingPart(presets[0].css, "login", "new-login");
  expect(archiveSidebar(presets, css, "same-sidebar", "new", "Previous")).toEqual(presets);
  expect(archiveSidebar(presets, css, "replacement", "new", "Previous")).toEqual(presets);
});
test("malformed saved entries cannot break the preset list", () => {
  expect(readBrandingPresets([null, {}, { id: "ok", name: "Saved", css: "sidebar" }])).toEqual([{ id: "ok", name: "Saved", css: "sidebar" }]);
});
test("only one automatic backup is kept, and named presets are never dropped", () => {
  const named = { id: "mine", name: "Client launch", css: updateBrandingPart("", "sidebar", "named-sidebar") };
  const first = archiveSidebar([named], updateBrandingPart("", "sidebar", "one"), "two", "a1", `${AUTO_PRESET_PREFIX} — 1`);
  const second = archiveSidebar(first, updateBrandingPart("", "sidebar", "two"), "three", "a2", `${AUTO_PRESET_PREFIX} — 2`);
  const third = archiveSidebar(second, updateBrandingPart("", "sidebar", "three"), "four", "a3", `${AUTO_PRESET_PREFIX} — 3`);
  expect(third.map((preset) => preset.id)).toEqual(["mine", "a3"]);
  expect(third.filter(isAutoPreset)).toHaveLength(1);
});
test("saving a preset under an existing name replaces it instead of adding a copy", () => {
  const presets = [
    { id: "1", name: "Dark", css: "old" },
    { id: "2", name: "Light", css: "light" },
  ];
  const next = upsertPreset(presets, { id: "3", name: " dark ", css: "new" });
  expect(next).toHaveLength(2);
  expect(next[0]).toEqual({ id: "3", name: " dark ", css: "new" });
  expect(upsertPreset(presets, { id: "4", name: "Blue", css: "blue" })).toHaveLength(3);
});
test("deleting a preset removes only that preset", () => {
  const presets = [
    { id: "1", name: "Dark", css: "dark" },
    { id: "2", name: "Light", css: "light" },
  ];
  expect(removePreset(presets, "1")).toEqual([{ id: "2", name: "Light", css: "light" }]);
  expect(removePreset(presets, "missing")).toEqual(presets);
});
