import { expect, test } from "bun:test";
import { assertKitPaid, KIT_CATALOG, kitCheckoutIds, kitTotal, parseKitCheckoutIds } from "../supabase/functions/_shared/kit-catalog";
import { KIT_STRIPE_PRODUCTS, missingKitPriceIds } from "../src/funnel/one-feature-kit/stripe";

test("kit alone costs $27 and excludes all add-ons", () => {
  const ids = kitCheckoutIds({ replay: false, video: false, install: false });
  expect(ids).toEqual(["kit"]);
  expect(kitTotal(ids)).toBe(2700);
});
test("all three checkout bumps cost $370", () => {
  expect(kitTotal(kitCheckoutIds({ replay: true, video: true, install: true }))).toBe(37000);
});
test("replay alone adds $17", () => {
  expect(kitTotal(kitCheckoutIds({ replay: true, video: false, install: false }))).toBe(4400);
});
test("branded video alone adds $27", () => {
  expect(kitTotal(kitCheckoutIds({ replay: false, video: true, install: false }))).toBe(5400);
});
test("installation alone adds $299", () => {
  expect(kitTotal(kitCheckoutIds({ replay: false, video: false, install: true }))).toBe(32600);
});
test("Launch Yes charges only $147", () => { expect(kitTotal(["launch"])).toBe(14700); });
test("Webinar Yes charges only $97", () => { expect(kitTotal(["webinar-system"])).toBe(9700); });
test("No thanks has no paid lines", () => { expect(kitTotal([])).toBe(0); });
test("all six frontend prices match the server catalog", () => {
  expect(missingKitPriceIds()).toEqual([]);
  expect(KIT_STRIPE_PRODUCTS.length).toBe(6);
  for (const row of KIT_STRIPE_PRODUCTS) {
    const item = KIT_CATALOG[row.id as keyof typeof KIT_CATALOG];
    expect(row.stripePriceId).toBe(item.price);
    expect(row.amountCents).toBe(item.amount);
    expect(row.type).toBe("one_time");
  }
});
const paid = { metadata: { funnel: "one-feature-kit", line_ids: "kit,bump-replay" }, payment_status: "paid", amount_total: 4400, currency: "usd", mode: "payment", livemode: true };
test("only a paid matching live kit checkout is confirmed", () => {
  expect(assertKitPaid(paid)).toEqual(["kit", "bump-replay"]);
  expect(() => assertKitPaid({ ...paid, payment_status: "unpaid" })).toThrow();
  expect(() => assertKitPaid({ ...paid, amount_total: 2700 })).toThrow();
  expect(() => assertKitPaid({ ...paid, livemode: false })).toThrow();
  expect(() => assertKitPaid({ ...paid, currency: "eur" })).toThrow();
  expect(() => assertKitPaid({ ...paid, mode: "subscription" })).toThrow();
  expect(() => assertKitPaid({ ...paid, metadata: { ...paid.metadata, funnel: "subscription" } })).toThrow();
});
test("checkout rejects upsells, duplicate lines and missing kit", () => {
  expect(() => parseKitCheckoutIds("kit,launch")).toThrow();
  expect(() => parseKitCheckoutIds("kit,kit")).toThrow();
  expect(() => parseKitCheckoutIds("bump-replay")).toThrow();
});