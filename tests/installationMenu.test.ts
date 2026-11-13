import { expect, test } from "bun:test";
import { isCurrentInstallationMenu, resolveInstallationMenu } from "../src/lib/installationMenu";

const old = { menu_id: "old", url: "https://yoursoftwareonboarding.com/v2/paul-4" };
const current = { menu_id: "new", url: "https://yoursoftwareonboarding.com/v2/lightwork-digital" };

test("Paul's renamed installation selects the new agency link instead of paul-4", () => {
  expect(resolveInstallationMenu([old, current], "old", "lightwork-digital")).toBe("new");
});
test("duplicates are not guessed", () => {
  expect(resolveInstallationMenu([old, current, { ...current, menu_id: "duplicate" }], "old", "lightwork-digital")).toBe("old");
});
test("matching requires the real Hub host and exact agency path", () => {
  expect(isCurrentInstallationMenu({ ...current, url: "https://evil.com/v2/lightwork-digital" }, "lightwork-digital")).toBe(false);
  expect(isCurrentInstallationMenu({ ...current, url: "https://yoursoftwareonboarding.com/v2/lightwork-digital-2" }, "lightwork-digital")).toBe(false);
});
test("explicit non-Hub link remains selected", () => {
  expect(resolveInstallationMenu([{ menu_id: "custom", url: "https://custom.example.com" }, current], "custom", "lightwork-digital")).toBe("custom");
});