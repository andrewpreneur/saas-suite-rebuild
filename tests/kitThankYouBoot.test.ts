import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import {
  draftRawMarksPurchase,
  funnelWireBoot,
  kitPurchaseMarkerPresent,
  searchMarksPurchase,
  thankYouCheckoutPurchase,
} from "../src/funnel/one-feature-kit/bootTiming";
import { EMPTY_DRAFT, KIT_DRAFT_STORAGE_KEY, loadDraft } from "../src/funnel/one-feature-kit/order";
import { KIT_PAYMENT_CAPABILITY_KEY } from "../src/funnel/one-feature-kit/payment";
import { deferFunnelModuleScript } from "../scripts/prerenderPostProcess";

const PAID_DRAFT = {
  ...EMPTY_DRAFT,
  checkoutId: "cs_live_speedtest",
  paymentMethodId: "pm_card_blocked",
  lines: [
    {
      id: "kit",
      label: "The GoHighLevel One Feature Kit",
      amountCents: 2700,
      kind: "one_time" as const,
    },
  ],
  contact: { firstName: "Ada", email: "ada@example.com", phone: "5555551212" },
};

function installStorage() {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const make = (memory: Map<string, string>): Storage => ({
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  });
  const previousSession = globalThis.sessionStorage;
  const previousLocal = globalThis.localStorage;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: make(session) });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: make(local) });
  return {
    session,
    local,
    restore() {
      Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: previousSession });
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousLocal });
    },
  };
}

test("thank-you loads the wire immediately when a checkout draft or purchase marker exists", () => {
  const storage = installStorage();
  try {
    expect(funnelWireBoot("thankyou", "")).toBe("deferred");
    expect(kitPurchaseMarkerPresent("")).toBe(false);

    storage.local.set(KIT_DRAFT_STORAGE_KEY, JSON.stringify(PAID_DRAFT));
    expect(kitPurchaseMarkerPresent("")).toBe(true);
    expect(funnelWireBoot("thankyou", "")).toBe("immediate");
    expect(loadDraft().checkoutId).toBe("cs_live_speedtest");
    expect(thankYouCheckoutPurchase(loadDraft())).toEqual({
      sessionId: "cs_live_speedtest",
      amountTotal: 27,
      comped: false,
      lines: PAID_DRAFT.lines,
    });

    storage.local.delete(KIT_DRAFT_STORAGE_KEY);
    expect(funnelWireBoot("thankyou", "")).toBe("deferred");

    storage.session.set(KIT_DRAFT_STORAGE_KEY, JSON.stringify({ ...EMPTY_DRAFT, checkoutId: "cs_test_abc" }));
    expect(funnelWireBoot("thankyou", "")).toBe("immediate");
    expect(thankYouCheckoutPurchase(loadDraft())).toBeNull();

    storage.session.clear();
    storage.local.set(KIT_PAYMENT_CAPABILITY_KEY, "cap-1");
    expect(funnelWireBoot("thankyou", "")).toBe("immediate");

    storage.local.clear();
    expect(searchMarksPurchase("?session_id=cs_live_return")).toBe(true);
    expect(searchMarksPurchase("?payment_intent=pi_live_1")).toBe(true);
    expect(searchMarksPurchase("?utm_source=facebook")).toBe(false);
    expect(funnelWireBoot("thankyou", "?checkout_session_id=cs_live_q")).toBe("immediate");
    expect(draftRawMarksPurchase(JSON.stringify({ checkoutId: null }))).toBe(false);
    expect(draftRawMarksPurchase(JSON.stringify({ checkoutId: "  " }))).toBe(false);
  } finally {
    storage.restore();
  }
});

test("checkout, launch, and webinar wire immediately, and a cold thank-you still waits", () => {
  expect(funnelWireBoot("checkout", "")).toBe("immediate");
  expect(funnelWireBoot("launch", "")).toBe("immediate");
  expect(funnelWireBoot("webinar", "")).toBe("immediate");
  expect(funnelWireBoot("upsell1", "")).toBe("immediate");
  expect(funnelWireBoot("sales", "?session_id=cs_live_x")).toBe("deferred");
  expect(funnelWireBoot("thankyou", "")).toBe("deferred");

  const page = readFileSync("src/pages/OneFeatureKit.tsx", "utf8");
  expect(page).toContain("funnelWireBoot(pageId, search)");
  expect(page).toContain('pageId === "thankyou" && boot === "deferred"');
  expect(page).toContain("const deferWire = boot === \"deferred\"");
  expect(page).toContain("scheduleInteractOrIdle(startWire, pageId === \"sales\" ? 10_000 : 12_000)");
  expect(page).toContain('root.querySelector("#ofk-name")');
  expect(page).toContain("enhance();");
  const clickAt = page.indexOf("onClick={(event) => {");
  const preventAt = page.indexOf("if (internal || interactive) event.preventDefault();", clickAt);
  const ensureAt = page.indexOf("ensureEnhanced(root, path).then", clickAt);
  expect(clickAt).toBeGreaterThan(0);
  expect(preventAt).toBeGreaterThan(clickAt);
  expect(ensureAt).toBeGreaterThan(preventAt);
  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  const thanksAt = wire.indexOf("pathname === FUNNEL_ROUTES.thanks");
  const purchaseAt = wire.indexOf("thankYouCheckoutPurchase(draft)");
  const entitlementsAt = wire.indexOf("loadKitEntitlements(draft.checkoutId)");
  const notifyAt = wire.indexOf("maybeNotifyKitPurchase(draft)");
  expect(thanksAt).toBeGreaterThan(0);
  expect(purchaseAt).toBeGreaterThan(thanksAt);
  expect(purchaseAt).toBeLessThan(entitlementsAt);
  expect(notifyAt).toBeGreaterThan(purchaseAt);
  expect(wire).toContain("trackKitCheckoutPurchase(purchase)");
  expect(readFileSync("src/funnel/one-feature-kit/bootTiming.ts", "utf8")).toContain(KIT_PAYMENT_CAPABILITY_KEY);
  expect(readFileSync("src/funnel/one-feature-kit/bootTiming.ts", "utf8")).not.toContain('from "./payment"');
  expect(wire).toContain('field.addEventListener("focus", onField)');

  const html = `<head><script type="module" src="/assets/index-abc.js"></script></head><body><h1>Kit</h1></body>`;
  const booted = deferFunnelModuleScript(html);
  expect(booted).toContain('path==="/one-feature-kit/checkout"||path==="/checkout"');
  expect(booted).toContain('path==="/one-feature-kit/launch-pack"||path==="/launch-pack"');
  expect(booted).toContain('path==="/one-feature-kit/webinar-sales-system"||path==="/webinar-sales-system"');
  expect(booted).toContain('path==="/one-feature-kit/thank-you"||path==="/thank-you"');
  expect(booted).toContain("ofk-one-feature-kit-v2");
  expect(booted).toContain("ofk-payment-capability");
  expect(booted).toContain("if(urgent()){document.addEventListener(\"click\"");
  expect(booted).toContain("window.__ofkClicks");
  expect(booted).toContain("window.__ofkFocus");
  expect(booted).toContain("boot();return;}");
  expect(readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8")).toContain("flushQueuedFunnelInput");
  expect(booted).toContain("setTimeout(boot,400)");
});
