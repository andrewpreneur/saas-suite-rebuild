export const KIT_FUNNEL = "one-feature-kit";
export const KIT_CATALOG = {
  kit: { price: "price_1USVOKGdZ9PRE3ZiXErcyWvf", amount: 2700, label: "The GoHighLevel One Feature Kit" },
  "bump-replay": { price: "price_1USVOeGdZ9PRE3Zi0JATCT1f", amount: 1700, label: "Full 90-Minute Training Replay" },
  "bump-video": { price: "price_1USVOrGdZ9PRE3ZiTX97C44L", amount: 2700, label: "Done-For-You Branded AI Studio Sales Video" },
  "bump-install": { price: "price_1USVPBGdZ9PRE3ZiUKYp131V", amount: 29900, label: "DFY Installation, Customization, and Setup" },
  launch: { price: "price_1USVPMGdZ9PRE3ZiquzhQOrn", amount: 14700, label: "25 white-labeled ad templates" },
  "webinar-system": { price: "price_1USVPYGdZ9PRE3ZidArTr362", amount: 9700, label: "Webinar Sales System" },
} as const;
export type KitLineId = keyof typeof KIT_CATALOG;

/** Add-ons a buyer can still purchase after the kit checkout, on the saved card. */
export const KIT_POST_PURCHASE_IDS = ["bump-replay", "bump-video", "bump-install", "launch", "webinar-system"] as const;
export type KitPostPurchaseId = (typeof KIT_POST_PURCHASE_IDS)[number];

export function isKitPostPurchaseId(id: string): id is KitPostPurchaseId {
  return (KIT_POST_PURCHASE_IDS as readonly string[]).includes(id);
}

/** Names and descriptions shown on the Stripe receipt. Price IDs stay the same. */
export const KIT_CUSTOMER_COPY: Record<KitLineId, { name: string; description: string }> = {
  kit: {
    name: "The GoHighLevel One Feature Kit",
    description: "White-label sales video, menu-link snapshot, setup training, and SaaSSuite Basic.",
  },
  "bump-replay": {
    name: "Full 90-Minute Training Replay",
    description: "Watch the full training replay as many times as you want.",
  },
  "bump-video": {
    name: "Done-For-You Branded AI Studio Sales Video",
    description: "We brand the AI Studio sales video with your logo.",
  },
  "bump-install": {
    name: "Done-For-You Installation and Setup",
    description: "We install the snapshot, the sales page, and the sales video in your agency.",
  },
  launch: {
    name: "Launch Pack: 25 Ad Templates",
    description: "25 white-labeled ad templates for your one-feature offer.",
  },
  "webinar-system": {
    name: "Webinar Sales System",
    description: "Training to set up an automated webinar. WebinarKit is a separate account.",
  },
};
export function kitCheckoutIds(bumps: { replay: boolean; video: boolean; install: boolean }): KitLineId[] {
  return ["kit", ...(bumps.replay ? ["bump-replay" as const] : []), ...(bumps.video ? ["bump-video" as const] : []), ...(bumps.install ? ["bump-install" as const] : [])];
}
export function kitTotal(ids: KitLineId[]): number { return ids.reduce((sum, id) => sum + KIT_CATALOG[id].amount, 0); }
/** Live promotion code promo_1UL6f9GdZ9PRE3Zi3QN6m5X0 on coupon YEYMmHpf. 100% off, forever, first purchase only. */
export const FRIENDS_INTERNAL_PROMOTION_CODE_ID = "promo_1UL6f9GdZ9PRE3Zi3QN6m5X0";
export const KIT_PROMO_INVALID = "That code isn't valid";

/** The active promotion code id from a Stripe list filtered by the buyer's code. */
export function activeKitPromotionId(
  codes: { id?: string | null; active?: boolean | null; code?: string | null }[],
  requested: string,
): string {
  const wanted = requested.trim().toLowerCase();
  const promo = codes.find(item => item.active === true && !!item.id && (item.code ?? "").trim().toLowerCase() === wanted);
  if (!promo?.id) throw new Error(KIT_PROMO_INVALID);
  return promo.id;
}

/**
 * Stripe rejects a Checkout Session that sets both discounts and allow_promotion_codes.
 * A code from our checkout box becomes a discount. An empty box leaves Stripe's own field on.
 */
export function kitCheckoutPromoFields(promotionCodeId: string | null):
  | { discounts: [{ promotion_code: string }] }
  | { allow_promotion_codes: true } {
  if (promotionCodeId) return { discounts: [{ promotion_code: promotionCodeId }] };
  return { allow_promotion_codes: true };
}

export type KitCoupon = {
  percent_off?: number | null;
  amount_off?: number | null;
  valid?: boolean | null;
};

export type KitPromoQuote = { percentOff: number | null; amountOff: number | null };

/** Discount numbers from a promotion code's coupon. A string coupon id has no amounts yet. */
export function kitPromoQuote(coupon: KitCoupon | string | null | undefined): KitPromoQuote {
  if (!coupon || typeof coupon === "string" || coupon.valid === false) return { percentOff: null, amountOff: null };
  return {
    percentOff: typeof coupon.percent_off === "number" ? coupon.percent_off : null,
    amountOff: typeof coupon.amount_off === "number" ? coupon.amount_off : null,
  };
}

/** Cents still due after a coupon. 100% off is $0. An unknown coupon leaves the full total. */
export function kitDiscountedCents(totalCents: number, quote: KitPromoQuote | null | undefined): number {
  if (!quote || totalCents <= 0) return Math.max(0, totalCents);
  if (quote.percentOff != null && quote.percentOff > 0) {
    return Math.max(0, Math.round((totalCents * (100 - quote.percentOff)) / 100));
  }
  if (quote.amountOff != null && quote.amountOff > 0) return Math.max(0, totalCents - quote.amountOff);
  return totalCents;
}
export type KitDiscount = { promotion_code?: string | { id?: string | null } | null };
export function promotionCodeId(discount: KitDiscount): string | null {
  const promo = discount.promotion_code;
  if (typeof promo === "string" && promo) return promo;
  if (promo && typeof promo === "object" && typeof promo.id === "string" && promo.id) return promo.id;
  return null;
}
export function isFriendsInternalDiscount(discounts: KitDiscount[] | null | undefined): boolean {
  return (discounts ?? []).some(discount => promotionCodeId(discount) === FRIENDS_INTERNAL_PROMOTION_CODE_ID);
}
export function parseKitCheckoutIds(value: string): KitLineId[] {
  const ids = value.split(",");
  if (ids[0] !== "kit" || new Set(ids).size !== ids.length || ids.some(id => !["kit", "bump-replay", "bump-video", "bump-install"].includes(id))) throw new Error("Invalid checkout lines");
  return ids as KitLineId[];
}
export function assertKitPaid(session: { metadata: Record<string, string> | null; payment_status: string; amount_total: number | null; currency: string | null; mode: string | null; livemode: boolean; discounts?: KitDiscount[] | null }): KitLineId[] {
  if (session.metadata?.funnel !== KIT_FUNNEL || session.payment_status !== "paid" || session.mode !== "payment" || !session.livemode || session.currency !== "usd") throw new Error("Payment has not been confirmed");
  const ids = parseKitCheckoutIds(session.metadata.line_ids ?? "");
  const comped = session.amount_total === 0 && isFriendsInternalDiscount(session.discounts);
  if (!comped && session.amount_total !== kitTotal(ids)) throw new Error("Payment amount does not match");
  return ids;
}
