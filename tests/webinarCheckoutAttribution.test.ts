import { expect, test } from "bun:test";
import { checkoutAttributionForTrial } from "../src/lib/webinarCheckoutAttribution";

const facebookFirstTouch = {
  utm_source: "facebook",
  utm_medium: "paid",
  utm_campaign: "ai-saas-webinar",
  utm_content: "registrant-ad",
  fbclid: "IwAR-click",
  landing_page: "https://saassuite.ai/ai-saas-webinar",
};

test("webinar trial keeps first-touch UTMs and records the offer separately", () => {
  expect(checkoutAttributionForTrial(facebookFirstTouch, "webinar_registrant_14day")).toEqual({
    ...facebookFirstTouch,
    offer: "registrant-trial",
    entry_point: "webinar-confirmation",
  });
});

test("webinar trial does not invent UTMs when the visit has none", () => {
  expect(checkoutAttributionForTrial({}, "webinar_registrant_14day")).toEqual({
    offer: "registrant-trial",
    entry_point: "webinar-confirmation",
  });
});

test("other trials leave attribution unchanged", () => {
  expect(checkoutAttributionForTrial(facebookFirstTouch, "onefeature_training_14day")).toEqual(
    facebookFirstTouch,
  );
  expect(checkoutAttributionForTrial(facebookFirstTouch, undefined)).toEqual(facebookFirstTouch);
});
