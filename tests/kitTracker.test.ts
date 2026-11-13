import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { KitOnboardingGuide } from "../src/components/dashboard/KitOnboardingGuide";
import { KitDeliveryList } from "../src/components/dashboard/OneFeatureKitDelivery";
import { readFileSync } from "node:fs";
import {
  emptyKitTrackerSignals,
  kitAccountChecks,
  kitConfirmedStepIds,
  kitInstallConfirmed,
  kitLineIdsFromPurchaseRows,
  kitProgressIds,
  kitStepVerificationNote,
  kitStepVisualStatus,
  normalizeKitLandingPageUrl,
  KIT_ONBOARDING_FORM_READABLE,
  type KitTrackerSignals,
} from "../src/lib/kitTracker";
import { kitReturnTarget, kitStepLocation, withKitReturn } from "../src/lib/kitReturn";

const installed: KitTrackerSignals = {
  ...emptyKitTrackerSignals(),
  installConfirmedAt: "2026-10-01T00:00:00.000Z",
};

test("comped and email-only purchase rows still count", () => {
  expect(
    kitLineIdsFromPurchaseRows([
      { line_id: "kit", email: "buyer@example.com", comped: true, user_id: null },
      { line_id: "launch", email: "buyer@example.com", comped: false, user_id: null },
      { line_id: "kit", email: "buyer@example.com", comped: true, user_id: null },
      { line_id: "webinar-system", email: "buyer@example.com", comped: true, user_id: "user-1" },
    ]),
  ).toEqual(["kit", "launch", "webinar-system"]);
  expect(kitLineIdsFromPurchaseRows(null)).toEqual([]);
});

test("install is confirmed from a real signal and the default CSS flag does not count", () => {
  expect(kitInstallConfirmed(emptyKitTrackerSignals())).toBe(false);
  expect(kitInstallConfirmed({ ...emptyKitTrackerSignals(), dynamicInstallation: true })).toBe(
    false,
  );
  expect(kitInstallConfirmed({ ...emptyKitTrackerSignals(), snapshotAccess: true })).toBe(false);
  expect(kitConfirmedStepIds({ ...emptyKitTrackerSignals(), dynamicInstallation: true })).toEqual(
    [],
  );
  expect(kitConfirmedStepIds(installed)).toEqual(["install-saas"]);
  expect(kitConfirmedStepIds({ ...emptyKitTrackerSignals(), hubInstalled: true })).toEqual([
    "install-saas",
  ]);
  expect(kitConfirmedStepIds({ ...emptyKitTrackerSignals(), menuLinkId: "menu_1" })).toEqual([
    "install-saas",
  ]);
  expect(kitConfirmedStepIds({ ...emptyKitTrackerSignals(), menuLinkId2: "menu_2" })).toEqual([
    "install-saas",
  ]);
  expect(
    kitConfirmedStepIds({
      ...installed,
      adRequestCount: 2,
      videosWatchedCount: 4,
      snapshotAccess: true,
    }),
  ).toEqual(["install-saas", "launch-ads"]);
  expect(kitConfirmedStepIds({ ...emptyKitTrackerSignals(), videosWatchedCount: 9 })).toEqual([]);
  expect(
    kitConfirmedStepIds({
      ...emptyKitTrackerSignals(),
      landingPageUrl: "https://example.com/offer",
    }),
  ).toEqual(["sales-page"]);
  expect(kitConfirmedStepIds({ ...emptyKitTrackerSignals(), landingPageUrl: "   " })).toEqual([]);
  expect(
    kitConfirmedStepIds({
      ...installed,
      landingPageUrl: "https://example.com/offer",
      adRequestCount: 1,
    }),
  ).toEqual(["install-saas", "sales-page", "launch-ads"]);
});

test("a landing page link is an http(s) address, with https added when the scheme is missing", () => {
  expect(normalizeKitLandingPageUrl("example.com/offer")).toBe("https://example.com/offer");
  expect(normalizeKitLandingPageUrl("  //example.com/offer  ")).toBe("https://example.com/offer");
  expect(normalizeKitLandingPageUrl("https://example.com/offer")).toBe("https://example.com/offer");
  expect(normalizeKitLandingPageUrl("http://localhost:3000/offer")).toBe(
    "http://localhost:3000/offer",
  );
  expect(normalizeKitLandingPageUrl("")).toBeNull();
  expect(normalizeKitLandingPageUrl("javascript:alert(1)")).toBeNull();
  expect(normalizeKitLandingPageUrl("ftp://example.com/offer")).toBeNull();
  expect(normalizeKitLandingPageUrl("not a url")).toBeNull();
  expect(normalizeKitLandingPageUrl("https://")).toBeNull();
});

test("progress counts a confirmed step and a marked step once", () => {
  expect(kitProgressIds(["install-saas", "sales-page"], ["install-saas", "launch-ads"])).toEqual([
    "install-saas",
    "sales-page",
    "launch-ads",
  ]);
  expect(kitStepVisualStatus("install-saas", ["install-saas"], ["install-saas"])).toBe("confirmed");
  expect(kitStepVisualStatus("sales-page", ["sales-page"], [])).toBe("marked");
  expect(kitStepVisualStatus("replay", [], [])).toBe("open");
  expect(kitStepVerificationNote("replay", "open", emptyKitTrackerSignals())).toContain(
    "no saved record",
  );
  expect(kitStepVerificationNote("sales-page", "open", emptyKitTrackerSignals())).toBe(
    "Save the landing page you use to sell this offer.",
  );
  expect(
    kitStepVerificationNote("sales-page", "confirmed", {
      ...emptyKitTrackerSignals(),
      landingPageUrl: "https://example.com/offer",
    }),
  ).toBe("Confirmed: your landing page is saved.");
  expect(kitStepVerificationNote("sales-page", "marked", emptyKitTrackerSignals())).toContain(
    "Marked done",
  );
  expect(
    kitStepVerificationNote("install-snapshot", "open", {
      ...emptyKitTrackerSignals(),
      snapshotAccess: true,
    }),
  ).toContain("no saved record");
  expect(KIT_ONBOARDING_FORM_READABLE).toBe(false);
});

test("purchases confirm Launch Pack and webinar, and the form stays unverified", () => {
  const checks = Object.fromEntries(
    kitAccountChecks(["kit", "launch", "bump-install"], emptyKitTrackerSignals()).map((check) => [
      check.id,
      check.status,
    ]),
  );
  expect(checks.launch).toBe("confirmed");
  expect(checks["webinar-system"]).toBe("open");
  expect(checks["bump-install"]).toBe("purchased");
  expect(checks["bump-video"]).toBe("open");
  expect(checks["onboarding-form"]).toBe("unverified");
  expect(checks["snapshot-import"]).toBe("unverified");
});

test("the kit step list is on the page while purchases are still loading", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(KitDeliveryList, { lineIds: null })),
  );
  expect(html).toContain('data-testid="kit-step-list"');
  expect(html).toContain("Install SaaSSuite");
  expect(html).toContain("Install the snapshot");
  expect(html).toContain("Customize the sales video");
  expect(html).toContain("Watch the SaaSSuite training");
  expect(html).toContain("Watch the menu training");
  expect(html).toContain("Create your sales page");
  expect(html).toContain("Launch ads");
  expect(html).toContain("Join the Community");
  expect(html).toContain('href="/app/community"');
  expect(html).toContain("Dashboard");
  expect(html).toContain("One Feature Kit");
  expect(html).toContain("Step 1: Install SaaSSuite");
  expect(html).toContain("Step 1 of 8");
  expect(html).toContain("0%");
  expect(html).toContain("Not started");
  expect(html).toContain("In progress");
  expect(html).toContain("returnTo=%2Fapp%2Fdashboard%3Fview%3Dkit%26step%3Dinstall-saas");
  expect(html).not.toContain("Loading your kit");
  expect(html).not.toContain("lg:hidden");
  expect(html).not.toContain("hidden lg:block");

  const confirmed = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(KitDeliveryList, {
        lineIds: ["kit", "bump-replay", "launch", "webinar-system"],
        signals: installed,
      }),
    ),
  );
  expect(confirmed).toContain('data-kit-progress="1/9"');
  expect(confirmed).toContain('data-kit-step="install-saas"');
  expect(confirmed).toContain('data-kit-step-status="confirmed"');
  expect(confirmed).toContain("Confirmed");
  expect(confirmed).toContain('data-kit-check="launch" data-kit-check-status="confirmed"');
  expect(confirmed).toContain('data-kit-check="webinar-system" data-kit-check-status="confirmed"');
  expect(confirmed).toContain(
    'data-kit-check="onboarding-form" data-kit-check-status="unverified"',
  );

  const guide = readFileSync("src/components/dashboard/KitOnboardingGuide.tsx", "utf8");
  expect(guide).not.toContain("lg:hidden");
  expect(guide).not.toContain("hidden lg:block");
  const dashboard = readFileSync("src/components/Dashboard.tsx", "utf8");
  expect(dashboard).toContain('searchParams.get("view") === "kit"');
  expect(dashboard).toContain("{overview && <HubUrlCard />}");
  expect(dashboard).toContain('const overview = view !== "kit" && view !== "affiliate"');
});

test("the sales page step asks for the landing page under the template link", () => {
  const saved = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/app/dashboard?view=kit&step=sales-page"] },
      createElement(KitOnboardingGuide, {
        lineIds: ["kit"],
        userId: "user-1",
        signals: {
          ...emptyKitTrackerSignals(),
          landingPageUrl: "https://example.com/offer",
        },
        syncUrl: false,
      }),
    ),
  );
  const openAt = saved.indexOf("Open the sales page");
  const fieldAt = saved.indexOf("Your landing page for selling this offer");
  expect(openAt).toBeGreaterThan(-1);
  expect(fieldAt).toBeGreaterThan(openAt);
  expect(saved).toContain('href="https://example.com/offer"');
  expect(saved).toContain('target="_blank"');
  expect(saved).toContain("Edit");
  expect(saved).toContain("Confirmed: your landing page is saved.");
  expect(saved).toContain('data-kit-step="sales-page"');
  expect(saved).toContain('data-kit-step-status="confirmed"');

  const empty = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/app/dashboard?view=kit&step=sales-page"] },
      createElement(KitOnboardingGuide, {
        lineIds: ["kit"],
        userId: "user-1",
        signals: emptyKitTrackerSignals(),
        syncUrl: false,
      }),
    ),
  );
  expect(empty.indexOf("Your landing page for selling this offer")).toBeGreaterThan(
    empty.indexOf("Open the sales page"),
  );
  expect(empty).toContain('placeholder="https://example.com/your-offer"');
  expect(empty).toContain('type="text"');
  expect(empty).toContain(">Save<");
  expect(empty).not.toContain("kit-landing-page-edit");
  expect(empty).toContain("Save the landing page you use to sell this offer.");
});

test("a kit return path stays on the kit step and rejects anything else", () => {
  expect(kitStepLocation("install-snapshot")).toBe("/app/dashboard?view=kit&step=install-snapshot");
  expect(kitReturnTarget("/app/dashboard?view=kit&step=install-snapshot")).toBe(
    "/app/dashboard?view=kit&step=install-snapshot",
  );
  expect(kitReturnTarget("https://evil.example/app/dashboard?view=kit")).toBeNull();
  expect(kitReturnTarget("//evil.example/app/dashboard?view=kit&step=replay")).toBeNull();
  expect(kitReturnTarget("/app/dashboard?view=overview")).toBeNull();
  expect(kitReturnTarget("/app/dashboard?view=kit&step=not-a-step")).toBeNull();
  expect(withKitReturn("/app/copilot", "install-saas")).toContain("returnTo=");
  expect(withKitReturn("https://example.com/watch", "replay")).toBe("https://example.com/watch");
});
