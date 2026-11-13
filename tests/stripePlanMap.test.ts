import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const SUPER_PROMO_PRICE = "price_1S8su4GdZ9PRE3Zi28ngcJmQ";

const MAP_FILES = [
  "supabase/functions/reconcile-plans/index.ts",
  "supabase/functions/stripe-subscription-webhook/index.ts",
];

function priceToPlan(source: string): Record<string, string> {
  const start = source.indexOf("const PRICE_TO_PLAN");
  if (start < 0) throw new Error("PRICE_TO_PLAN not found");
  const open = source.indexOf("{", start);
  const close = source.indexOf("};", open);
  const block = source.slice(open, close);
  const map: Record<string, string> = {};
  for (const match of block.matchAll(/(price_[A-Za-z0-9]+)\s*:\s*"(BASIC|ADVANCED)"/g)) {
    map[match[1]] = match[2];
  }
  return map;
}

describe("Stripe price to plan", () => {
  test("SAASSuite SUPER PROMO resolves to ADVANCED", () => {
    for (const file of MAP_FILES) {
      const map = priceToPlan(readFileSync(file, "utf8"));
      expect(map[SUPER_PROMO_PRICE]).toBe("ADVANCED");
    }
  });
});
