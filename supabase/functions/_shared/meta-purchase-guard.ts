/**
 * A Purchase must not be sent when the buyer paid nothing.
 * amount_total is cents. A 100% coupon counts even if a caller still has the list price.
 */
export function skipMetaPurchase(input: {
  amountTotal?: number | null;
  amountSubtotal?: number | null;
  amountDiscount?: number | null;
  percentOff?: number | null;
}): boolean {
  if (typeof input.amountTotal === "number" && input.amountTotal <= 0) return true;
  if (typeof input.percentOff === "number" && input.percentOff >= 100) return true;
  if (
    typeof input.amountSubtotal === "number" &&
    input.amountSubtotal > 0 &&
    typeof input.amountDiscount === "number" &&
    input.amountDiscount >= input.amountSubtotal
  ) return true;
  return false;
}

export function sessionPercentOff(discounts: unknown): number | null {
  if (!Array.isArray(discounts)) return null;
  for (const discount of discounts) {
    if (!discount || typeof discount !== "object") continue;
    const coupon = (discount as { coupon?: unknown }).coupon;
    if (!coupon || typeof coupon !== "object") continue;
    const percent = (coupon as { percent_off?: unknown }).percent_off;
    if (typeof percent === "number") return percent;
  }
  return null;
}

export function skipCheckoutPurchase(session: {
  amount_total?: number | null;
  amount_subtotal?: number | null;
  total_details?: { amount_discount?: number | null } | null;
  discounts?: unknown;
}): boolean {
  return skipMetaPurchase({
    amountTotal: session.amount_total,
    amountSubtotal: session.amount_subtotal,
    amountDiscount: session.total_details?.amount_discount,
    percentOff: sessionPercentOff(session.discounts),
  });
}
