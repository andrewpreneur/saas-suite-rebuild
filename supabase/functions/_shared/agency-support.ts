import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * Agency Support add-on: $49/month per client sub-account.
 *
 * The "wallet" is always derived from Stripe: it is the summed quantity of every
 * ACTIVE Agency Support subscription item on the customer. That makes purchases,
 * quantity changes and cancellations all self-healing — we never increment blindly.
 */
export const AGENCY_SUPPORT_LOOKUP_KEY = "agency_support_seat_49_monthly";
export const AGENCY_SUPPORT_UNIT_PRICE = 49;

const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Returns the existing recurring $49/month seat price if one exists (looked up by
 * lookup key — a direct lookup, not the eventually-consistent search index).
 * Returns null when it has not been created in Stripe yet, in which case the
 * checkout falls back to inline price_data.
 */

export async function findSeatPrice(stripe: Stripe): Promise<Stripe.Price | null> {
  try {
    const existing = await stripe.prices.list({
      lookup_keys: [AGENCY_SUPPORT_LOOKUP_KEY],
      active: true,
      limit: 1,
    });
    return existing.data[0] ?? null;
  } catch (e) {
    console.error("[AGENCY-SUPPORT] price lookup failed", e);
    return null;
  }
}

function isAgencySupportItem(item: Stripe.SubscriptionItem, priceIds: Set<string>) {
  const price = item.price;
  if (!price) return false;
  if (priceIds.has(price.id)) return true;
  if (price.lookup_key === AGENCY_SUPPORT_LOOKUP_KEY) return true;
  if ((price.metadata as Record<string, string> | null)?.product === "agency_support") return true;
  return false;
}

/**
 * Recomputes the wallet for a Stripe customer and writes it to the app user row.
 * Returns the new seat count, or null when the email could not be resolved.
 */
export async function syncAgencySupportWallet(
  stripe: Stripe,
  customerId: string,
  fallbackEmail?: string,
): Promise<{ email: string; seats: number } | null> {
  let email = (fallbackEmail || "").trim().toLowerCase();
  if (!email && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer) && customer.email) {
        email = customer.email.trim().toLowerCase();
      }
    } catch (e) {
      console.error("[AGENCY-SUPPORT] customer lookup failed", e);
    }
  }
  if (!email) return null;

  let priceIds = new Set<string>();
  try {
    const seatPrices = await stripe.prices.list({
      lookup_keys: [AGENCY_SUPPORT_LOOKUP_KEY],
      limit: 10,
    });
    priceIds = new Set(seatPrices.data.map((p: Stripe.Price) => p.id));
  } catch (_) { /* lookup-key price may not exist yet */ }

  let seats = 0;
  let latestSubId: string | null = null;

  if (customerId) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    });
    for (const sub of subs.data) {
      if (!LIVE_STATUSES.has(sub.status)) continue;
      const taggedSub =
        ((sub.metadata ?? {}) as Record<string, string>).product === "agency_support";
      for (const item of sub.items?.data ?? []) {
        if (taggedSub || isAgencySupportItem(item, priceIds)) {
          seats += item.quantity ?? 1;
          latestSubId = sub.id;
        }
      }
    }
  }

  const admin = adminClient();
  const { error } = await admin.rpc("set_agency_support_wallet", {
    _email: email,
    _quantity: seats,
    _subscription_id: latestSubId,
  });
  if (error) {
    console.error("[AGENCY-SUPPORT] set_agency_support_wallet failed", error);
    throw error;
  }

  console.log(`[AGENCY-SUPPORT] wallet synced email=${email} seats=${seats} sub=${latestSubId}`);
  return { email, seats };
}

/** True when a subscription is an Agency Support subscription (metadata tagged at checkout). */
export function isAgencySupportSubscription(sub: Stripe.Subscription) {
  const md = (sub.metadata ?? {}) as Record<string, string>;
  if (md.product === "agency_support") return true;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    if (price?.lookup_key === AGENCY_SUPPORT_LOOKUP_KEY) return true;
    if ((price?.metadata as Record<string, string> | null)?.product === "agency_support") return true;
  }
  return false;
}
