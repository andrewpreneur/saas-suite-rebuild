/**
 * When the kit wire chunk is allowed to wait.
 * A buyer already has a checkout draft, a Stripe id, or a payment capability.
 * Cold thank-you visits can wait. Checkout, launch, and webinar never wait:
 * their pay buttons and checkout_start listeners have to be bound before a click.
 */
import { KIT_DRAFT_STORAGE_KEY, orderTotalCents, type KitDraft, type OrderLine } from "./order";

/** Same key as payment.ts. Kept here so the funnel entry does not import the payment client. */
const PAYMENT_CAPABILITY_KEY = "ofk-payment-capability";

const PURCHASE_QUERY_KEYS = ["session_id", "sessionId", "checkout_session_id", "payment_intent", "payment_intent_id"] as const;

function storageGet(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function draftRawMarksPurchase(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { checkoutId?: unknown };
    return typeof parsed.checkoutId === "string" && parsed.checkoutId.trim().length > 0;
  } catch {
    return /"checkoutId"\s*:\s*"cs_(?:live|test)_/.test(raw);
  }
}

export function searchMarksPurchase(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    return /cs_(?:live|test)_/.test(search);
  }
  for (const key of PURCHASE_QUERY_KEYS) {
    const value = params.get(key);
    if (value && value.trim()) return true;
  }
  return /cs_(?:live|test)_/.test(search);
}

export function kitPurchaseMarkerPresent(search = ""): boolean {
  if (searchMarksPurchase(search)) return true;
  const stores: Array<Storage | undefined> = [
    typeof sessionStorage === "undefined" ? undefined : sessionStorage,
    typeof localStorage === "undefined" ? undefined : localStorage,
  ];
  for (const store of stores) {
    if (draftRawMarksPurchase(storageGet(store, KIT_DRAFT_STORAGE_KEY))) return true;
    if (storageGet(store, PAYMENT_CAPABILITY_KEY)) return true;
  }
  return false;
}

export type FunnelWireBoot = "immediate" | "deferred";

export function funnelWireBoot(pageId: string, search = ""): FunnelWireBoot {
  if (pageId === "sales") return "deferred";
  if (pageId === "thankyou") return kitPurchaseMarkerPresent(search) ? "immediate" : "deferred";
  return "immediate";
}

/** Pixel Purchase for a stored paid checkout. $0 drafts stay quiet. The event id matches the server Purchase. */
export function thankYouCheckoutPurchase(draft: Pick<KitDraft, "checkoutId" | "lines">): {
  sessionId: string;
  amountTotal: number;
  comped: boolean;
  lines: OrderLine[];
} | null {
  const sessionId = draft.checkoutId?.trim() ?? "";
  if (!sessionId.startsWith("cs_live_") && !sessionId.startsWith("cs_test_")) return null;
  const amountTotal = orderTotalCents({ lines: draft.lines } as KitDraft) / 100;
  if (!(amountTotal > 0)) return null;
  return { sessionId, amountTotal, comped: false, lines: draft.lines };
}
