import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { KitActionList } from "../src/components/dashboard/KitOnboardingGuide";
import { WL_SALES_VIDEO } from "../src/components/one-feature/shared";
import { kitDeliveryState } from "../src/lib/kitDelivery";
import {
  emptyKitProgress,
  kitAddonViews,
  kitOnboardingSteps,
  kitProgressStorageKey,
  kitStepProgress,
  parseKitProgress,
  readKitProgress,
  resolveSelectedStep,
  withStepCompleted,
  withStepSelected,
  writeKitProgress,
  type KitProgressStorage,
} from "../src/lib/kitOnboarding";
import { MENU_REMOVAL_VIDEO } from "../src/lib/startHere";

function memoryStorage(): KitProgressStorage & { dump(): Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump: () => dump,
    getItem: (key) => dump.get(key) ?? null,
    setItem: (key, value) => {
      dump.set(key, value);
    },
  };
}

test("the 90-minute step is only listed after the replay is purchased", () => {
  const kitOnly = kitOnboardingSteps(["kit"]);
  expect(kitOnly.map((step) => step.id)).toEqual([
    "install-saas",
    "install-snapshot",
    "customize-video",
    "saas-training",
    "menu-training",
    "sales-page",
    "launch-ads",
    "launch-video",
  ]);
  expect(kitOnly.some((step) => step.title === "Watch the 90-minute training")).toBe(false);

  const withReplay = kitOnboardingSteps(["kit", "bump-replay"]);
  expect(withReplay.map((step) => step.id)[0]).toBe("replay");
  expect(withReplay).toHaveLength(9);
  expect(kitStepProgress(withReplay, []).label).toBe("0/9");
});

test("training steps reuse the kit links and say when one is missing", () => {
  const steps = Object.fromEntries(
    kitOnboardingSteps(["kit", "bump-replay"]).map((step) => [step.id, step]),
  );
  expect(steps["customize-video"].actions[0]).toEqual({
    href: WL_SALES_VIDEO,
    label: "Download the video",
  });
  expect(steps["customize-video"].mediaSrc).toBe(WL_SALES_VIDEO);
  expect(steps["menu-training"].mediaSrc).toBe(MENU_REMOVAL_VIDEO.src);
  expect(steps["launch-ads"].actions.map((action) => action.href)).toEqual([
    "#kit-ad-templates",
    "/kit/ad-templates/highlevel/vibe-code-for-free.png",
  ]);
  expect(steps["install-saas"].notes.join(" ")).toContain("isn't in the app yet");
  expect(steps["install-saas"].actions[0].href).toBe("/app/client-hub?panel=installation-guide");
  expect(steps["install-snapshot"].actions[0]).toEqual({
    href: null,
    label: "Import the snapshot",
    kind: "snapshot",
  });
  expect(steps["install-snapshot"].actions[1].href).toBe("/app/streamline");
});

test("progress is saved per user id and resumes on the unfinished step", () => {
  const steps = kitOnboardingSteps(["kit", "bump-replay"]);
  let progress = emptyKitProgress();
  progress = withStepCompleted(progress, "replay");
  progress = withStepCompleted(progress, "install-saas");
  progress = withStepCompleted(progress, "install-snapshot");
  progress = withStepSelected(progress, "customize-video");
  expect(kitStepProgress(steps, progress.completed).label).toBe("3/9");
  expect(resolveSelectedStep(steps, progress)).toBe("customize-video");

  const withoutReplay = kitOnboardingSteps(["kit"]);
  expect(resolveSelectedStep(withoutReplay, { completed: [], selected: "replay" })).toBe(
    "install-saas",
  );
  expect(kitStepProgress(withoutReplay, ["replay", "install-saas"]).label).toBe("1/8");

  const storage = memoryStorage();
  writeKitProgress("user-1", progress, storage);
  expect(storage.dump().has(kitProgressStorageKey("user-1"))).toBe(true);
  expect(readKitProgress("user-1", storage)).toEqual(progress);
  expect(readKitProgress("user-2", storage)).toEqual(emptyKitProgress());
  expect(parseKitProgress("not-json")).toEqual(emptyKitProgress());
  writeKitProgress(null, progress, storage);
  expect(readKitProgress(null, storage)).toEqual(emptyKitProgress());
});

test("purchased add-ons explain status and what's next, and the others stay locked", () => {
  const views = kitAddonViews(kitDeliveryState(["kit", "bump-replay", "bump-install"]));
  const byId = Object.fromEntries(views.map((item) => [item.id, item]));
  expect(byId["bump-replay"].unlocked).toBe(true);
  expect(byId["bump-replay"].statusLabel).toBe("Not started");
  expect(byId["bump-replay"].next.length).toBeGreaterThan(0);
  expect(byId["bump-install"].statusLabel).toBe("Included");
  expect(byId["bump-install"].actions.map((action) => action.label)).toContain(
    "Open the intake form",
  );
  expect(byId["bump-install"].missing).toContain("tracker");
  expect(byId["bump-video"].unlocked).toBe(false);
  expect(byId.launch.unlocked).toBe(false);
  expect(byId["webinar-system"].unlocked).toBe(false);

  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(KitActionList, {
        actions: [{ href: null, label: "Open the tracker" }],
      }),
    ),
  );
  expect(html).toContain("Open the tracker isn&#x27;t linked in the app yet.");
  expect(html).not.toContain("href=");
});
