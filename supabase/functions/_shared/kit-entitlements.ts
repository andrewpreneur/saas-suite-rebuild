import {
  assertKitPaid,
  FRIENDS_INTERNAL_PROMOTION_CODE_ID,
  isFriendsInternalDiscount,
  isKitPostPurchaseId,
  KIT_CATALOG,
  type KitDiscount,
  type KitLineId,
  type KitPostPurchaseId,
} from "./kit-catalog.ts";

type IdRef = string | { id?: string | null; status?: string | null; payment_method?: IdRef | null } | null;

export type KitCheckoutSession = {
  metadata: Record<string, string> | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  mode: string | null;
  livemode: boolean;
  discounts?: KitDiscount[] | null;
  customer?: IdRef;
  payment_intent?: IdRef;
  setup_intent?: IdRef;
  customer_details?: { email?: string | null; name?: string | null; phone?: string | null } | null;
};

export type KitPurchaseRow = {
  email: string;
  stripe_customer_id: string;
  checkout_session_id: string;
  line_id: KitLineId;
  stripe_price_id: string;
  payment_intent_id: string | null;
  amount_cents: number;
  currency: "usd";
  comped: boolean;
  promotion_code_id: string | null;
  source: "checkout" | "upsell";
};

export type KitSettlement = {
  ids: KitLineId[];
  customerId: string;
  paymentMethodId: string | null;
  comped: boolean;
  paymentIntentId: string | null;
};

function refId(value: IdRef | undefined): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof value.id === "string" && value.id) return value.id;
  return null;
}

/** Paid checkout, including a $0 FRIENDSINTERNAL session that has no PaymentIntent. */
export function kitCheckoutSettlement(session: KitCheckoutSession): KitSettlement {
  const ids = assertKitPaid(session);
  const comped = session.amount_total === 0 && isFriendsInternalDiscount(session.discounts);
  const intent = session.payment_intent;
  if (!comped) {
    if (!intent || typeof intent === "string" || intent.status !== "succeeded") {
      throw new Error("Payment has not been confirmed");
    }
  } else if (intent && typeof intent === "object" && intent.status && intent.status !== "succeeded") {
    throw new Error("Payment has not been confirmed");
  }
  let paymentMethodId: string | null = null;
  if (intent && typeof intent === "object") paymentMethodId = refId(intent.payment_method ?? null);
  if (!paymentMethodId && session.setup_intent && typeof session.setup_intent === "object") {
    paymentMethodId = refId(session.setup_intent.payment_method ?? null);
  }
  const customerId = refId(session.customer ?? null);
  if (!customerId) throw new Error("Saved card is unavailable");
  if (!comped && !paymentMethodId) throw new Error("Saved card is unavailable");
  return { ids, customerId, paymentMethodId, comped, paymentIntentId: refId(intent ?? null) };
}

/** Charge a saved card. A FRIENDSINTERNAL checkout with no reusable card is a $0 comped test. */
export function upsellChargeMode(settlement: Pick<KitSettlement, "comped" | "paymentMethodId">): "charge" | "comped" {
  if (settlement.paymentMethodId) return "charge";
  if (settlement.comped) return "comped";
  throw new Error("Saved card is unavailable");
}

export function kitBuyerEmail(session: KitCheckoutSession): string {
  return (session.customer_details?.email || session.metadata?.email || "").trim().toLowerCase();
}

function purchaseRow(input: {
  email: string;
  customerId: string;
  checkoutId: string;
  lineId: KitLineId;
  paymentIntentId: string | null;
  comped: boolean;
  source: "checkout" | "upsell";
}): KitPurchaseRow {
  if (!input.email.includes("@")) throw new Error("Buyer email is missing");
  return {
    email: input.email,
    stripe_customer_id: input.customerId,
    checkout_session_id: input.checkoutId,
    line_id: input.lineId,
    stripe_price_id: KIT_CATALOG[input.lineId].price,
    payment_intent_id: input.comped ? null : input.paymentIntentId,
    amount_cents: input.comped ? 0 : KIT_CATALOG[input.lineId].amount,
    currency: "usd",
    comped: input.comped,
    promotion_code_id: input.comped ? FRIENDS_INTERNAL_PROMOTION_CODE_ID : null,
    source: input.source,
  };
}

export function checkoutEntitlementRows(session: KitCheckoutSession, checkoutId: string): KitPurchaseRow[] {
  const settlement = kitCheckoutSettlement(session);
  const email = kitBuyerEmail(session);
  return settlement.ids.map(lineId => purchaseRow({
    email, customerId: settlement.customerId, checkoutId, lineId,
    paymentIntentId: settlement.paymentIntentId, comped: settlement.comped, source: "checkout",
  }));
}

/** Checkout lines plus later purchases. Unknown ids are dropped. Order follows the catalog. */
export function mergeOwnedKitLineIds(
  checkoutIds: readonly string[],
  extras: readonly (string | null | undefined)[],
): KitLineId[] {
  const order = Object.keys(KIT_CATALOG) as KitLineId[];
  const seen = new Set<string>();
  const out: KitLineId[] = [];
  for (const id of [...checkoutIds, ...extras]) {
    if (!id || !order.includes(id as KitLineId) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as KitLineId);
  }
  out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return out;
}

/** A completed upsell action key is `upsell:<checkout session>:<line id>`. */
export function completedUpsellLineId(actionKey: string, checkoutId: string): KitPostPurchaseId | null {
  const prefix = `upsell:${checkoutId}:`;
  if (!actionKey.startsWith(prefix)) return null;
  const id = actionKey.slice(prefix.length);
  return isKitPostPurchaseId(id) ? id : null;
}

/** False when the line is already on the checkout or in kit_purchases, so we do not charge twice. */
export function addonChargeAllowed(ownedLineIds: readonly string[], offerId: string): boolean {
  return isKitPostPurchaseId(offerId) && !ownedLineIds.includes(offerId);
}

export function upsellEntitlementRow(
  session: KitCheckoutSession,
  checkoutId: string,
  offerId: KitPostPurchaseId,
  paymentIntentId: string | null,
  comped: boolean,
): KitPurchaseRow {
  const customerId = kitCheckoutSettlement(session).customerId;
  return purchaseRow({
    email: kitBuyerEmail(session), customerId, checkoutId, lineId: offerId, paymentIntentId, comped, source: "upsell",
  });
}

export function mergeKitPurchases(existing: KitPurchaseRow[], incoming: KitPurchaseRow[]): KitPurchaseRow[] {
  const map = new Map(existing.map(row => [`${row.checkout_session_id}:${row.line_id}`, row]));
  for (const row of incoming) {
    const key = `${row.checkout_session_id}:${row.line_id}`;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

export function attachPurchasesByEmail<T extends { email: string; user_id: string | null }>(
  rows: T[],
  email: string,
  userId: string,
): T[] {
  const clean = email.trim().toLowerCase();
  return rows.map(row => (row.email === clean ? { ...row, user_id: userId } : row));
}

type KitPurchaseWriter = {
  from(table: string): {
    upsert(
      rows: KitPurchaseRow[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: { message?: string } | null }>;
  };
};

export async function saveKitEntitlements(db: KitPurchaseWriter, rows: KitPurchaseRow[]) {
  if (rows.length === 0) return;
  const { error } = await db.from("kit_purchases").upsert(rows, {
    onConflict: "checkout_session_id,line_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error("Entitlement storage unavailable");
}
