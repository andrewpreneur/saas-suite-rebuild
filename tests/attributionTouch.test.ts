import { expect, test } from "bun:test";
import { applyFirstTouch, applyLastTouch } from "../src/utils/fbAttribution";
import { billingIntervalForPlan, checkoutSurfaceLabel } from "../src/lib/checkoutSurface";

test("first touch keeps the original landing page when a later visit has no UTM", () => {
  const first = applyFirstTouch(
    {},
    { utm_source: "facebook", utm_campaign: "webinar" },
    true,
    "https://facebook.com",
    "https://saassuite.ai/webinar",
  );
  const later = applyFirstTouch(first, {}, false, "https://saassuite.ai/app", "https://saassuite.ai/app/billing");
  expect(later.landing_page).toBe("https://saassuite.ai/webinar");
  expect(later.utm_source).toBe("facebook");
  expect(later.utm_campaign).toBe("webinar");
});

test("last touch records the page the buyer is on now", () => {
  const first = applyLastTouch(
    {},
    { utm_source: "facebook", fbclid: "click-1" },
    "https://facebook.com",
    "https://saassuite.ai/webinar",
    "2026-10-16T20:00:00.000Z",
  );
  const later = applyLastTouch(first, {}, "", "https://saassuite.ai/app/billing", "2026-10-21T14:00:00.000Z");
  expect(later.landing_page).toBe("https://saassuite.ai/app/billing");
  expect(later.utm_source).toBe("facebook");
  expect(later.fbclid).toBe("click-1");
  expect(later.touched_at).toBe("2026-10-21T14:00:00.000Z");
  expect(later.referrer).toBe("https://facebook.com");
});

test("checkout surface names the billing card and the billing interval", () => {
  expect(checkoutSurfaceLabel("advanced", "/app/billing")).toBe("/app/billing Advanced card");
  expect(checkoutSurfaceLabel("enhanced", "/app/billing")).toBe("/app/billing Premium Support card");
  expect(checkoutSurfaceLabel("basic_annual", "/special")).toBe("/special Basic card");
  expect(billingIntervalForPlan("advanced")).toBe("monthly");
  expect(billingIntervalForPlan("advanced_annual")).toBe("annual");
  expect(billingIntervalForPlan("special")).toBe("annual");
});
