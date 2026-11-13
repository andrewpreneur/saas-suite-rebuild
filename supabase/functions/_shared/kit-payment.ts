import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { KIT_PLAN_CHANGE_TAG, kitBasicAccessUpdate, kitPlanChangeIsKitGrant } from "./kit-basic.ts";
import { KIT_CATALOG, KIT_CUSTOMER_COPY, KIT_FUNNEL, type KitLineId, type KitPostPurchaseId } from "./kit-catalog.ts";
import { checkoutEntitlementRows, kitCheckoutSettlement, kitBuyerEmail, saveKitEntitlements, upsellChargeMode, upsellEntitlementRow, type KitCheckoutSession } from "./kit-entitlements.ts";
import { completeKitLoginAfterGhl, deliverKitBuyerLogin, kitLoginActionKey, parseStoredKitLogin } from "./kit-login.ts";
import { kitBuyerAttributionPatch } from "./saas-user-write.ts";
import { metadataIsTest } from "./test-traffic.ts";
export { Stripe };

/** Stripe Checkout metadata written at create time. */
export function kitPaymentIsTest(metadata: { is_test?: unknown } | null | undefined): boolean {
  if (!metadata) return false;
  return metadataIsTest(metadata as Record<string, unknown>);
}
export function kitStripe() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}
export function kitDb() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Payment storage is not configured");
  return createClient(url, key);
}
export async function kitHash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function verifiedKitSession(stripe: Stripe, id: string, capability?: string) {
  const session = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent", "setup_intent", "discounts"] });
  const settlement = kitCheckoutSettlement(session as KitCheckoutSession);
  if (capability !== undefined && (!session.metadata?.capability_hash || await kitHash(capability) !== session.metadata.capability_hash)) throw new Error("Checkout could not be verified in this browser");
  return { session, ...settlement };
}
export async function validateKitPrices(stripe: Stripe, ids: KitLineId[]) {
  await Promise.all(ids.map(async id => {
    const price = await stripe.prices.retrieve(KIT_CATALOG[id].price);
    if (!price.active || !price.livemode || price.type !== "one_time" || price.currency !== "usd" || price.unit_amount !== KIT_CATALOG[id].amount) throw new Error("Kit price is unavailable");
  }));
  await syncKitProductCopy(stripe, ids);
}

/** Checkout shows the Stripe Product name. Rewrite internal names without changing the Price. */
export async function syncKitProductCopy(stripe: Stripe, ids: KitLineId[]) {
  await Promise.all(ids.map(async id => {
    const price = await stripe.prices.retrieve(KIT_CATALOG[id].price, { expand: ["product"] });
    const product = price.product;
    if (!product || typeof product === "string" || ("deleted" in product && product.deleted)) return;
    const copy = KIT_CUSTOMER_COPY[id];
    if (product.name === copy.name && product.description === copy.description) return;
    await stripe.products.update(product.id, { name: copy.name, description: copy.description });
  }));
}

/**
 * Raise a Starter account to Basic for 30 days after the kit login row exists.
 * The clock is trial_start_date plus trial_length. expire-payment-grace returns
 * the row to STARTER when those 30 days end. Advanced and a paid Basic stay.
 */
export async function grantKitBasicAccess(db: ReturnType<typeof kitDb>, email: string, purchasedAt?: string | null) {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) return "missing" as const;
  const { data, error } = await db.from("saas_suite_users").select("id, plan, trial_source, trial_start_date, trial_length").ilike("email", clean).maybeSingle();
  if (error) throw new Error("Could not read the buyer plan");
  if (!data) return "missing" as const;
  const grant = kitBasicAccessUpdate(data, Date.now(), purchasedAt);
  if (!grant) return "kept" as const;
  const { data: updated, error: updateError } = await db.from("saas_suite_users").update(grant).eq("id", data.id).in("plan", ["STARTER", "null", "NULL", "Null", ""]).select("id");
  if (updateError) throw new Error("Could not grant SaaSSuite Basic");
  if (updated && updated.length > 0) {
    console.log("kit basic granted", JSON.stringify({ email: clean, until_days: grant.trial_length, started: grant.trial_start_date }));
    try { await tagKitBasicPlanChange(db, clean); }
    catch (error) { console.error("kit plan history", error instanceof Error ? error.message : "unknown"); }
    return "upgraded" as const;
  }
  return "kept" as const;
}
export type KitSlackForwardResult =
  | { ok: true; skipped: string }
  | { ok: true; forwarded: true; channel: string | null; team: string | null };

/**
 * Post one kit event through slack-notify.
 * Uses KIT_SLACK_AGENCY_ID and SLACK_NOTIFY_TOKEN, the same post requestKitNotify reaches.
 */
export async function forwardKitSlack(eventType: string, data: object): Promise<KitSlackForwardResult> {
  const agency = Deno.env.get("KIT_SLACK_AGENCY_ID")?.trim();
  const token = Deno.env.get("SLACK_NOTIFY_TOKEN");
  if (!agency || !token) {
    const skipped = !agency ? "no agency" : "no token";
    console.error("kit slack notify failed", JSON.stringify({ eventType, skipped }));
    return { ok: true, skipped };
  }
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agency_id: agency, event_type: eventType, data }),
  });
  const raw = await res.text();
  let payload: { ok?: boolean; skipped?: string; error?: string; channel?: string; team?: string; team_domain?: string; slack_error?: string; ts?: string } = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
  const failed = !res.ok || payload.ok === false || Boolean(payload.skipped) || Boolean(payload.error);
  if (failed) {
    console.error("kit slack notify failed", JSON.stringify({
      status: res.status, agency, eventType, skipped: payload.skipped ?? null, error: payload.error ?? payload.slack_error ?? raw.slice(0, 300),
    }));
    if (res.status === 404 || payload.skipped) return { ok: true, skipped: payload.skipped || "no install" };
    throw new Error("Slack notification failed");
  }
  console.log("kit slack posted", JSON.stringify({
    agency, eventType, channel: payload.channel ?? null, team: payload.team ?? null, team_domain: payload.team_domain ?? null, ts: payload.ts ?? null,
  }));
  return { ok: true, forwarded: true, channel: payload.channel ?? null, team: payload.team ?? null };
}

const KIT_ATTRIBUTION_COLUMNS = "id, full_name, fbclid, fbc, fbp, landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, referrer, checkout_page, source, last_utm_source, last_utm_medium, last_utm_campaign, last_utm_term, last_utm_content, last_utm_id, last_touch_at";

/** Point the trigger's database row at the kit grant. Failures stay on source database. */
async function tagKitBasicPlanChange(db: ReturnType<typeof kitDb>, email: string) {
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await db.from("plan_change_history")
    .select("id, old_plan, new_plan, source")
    .ilike("user_email", email)
    .eq("new_plan", "BASIC")
    .eq("source", "database")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error || !data) {
    if (error) console.error("kit plan history", error.message);
    return;
  }
  const row = (data as { id: string; old_plan?: string | null; new_plan?: string | null; source?: string | null }[])
    .find((item) => kitPlanChangeIsKitGrant(item));
  if (!row) return;
  const { error: updateError } = await db.from("plan_change_history").update(KIT_PLAN_CHANGE_TAG).eq("id", row.id).eq("source", "database");
  if (updateError) console.error("kit plan history", updateError.message);
}

/**
 * Create the starter row when needed, fill empty attribution columns, then grant Basic.
 * register_starter_user stamps source signup on insert. createdHere replaces that default.
 * Errors are logged by the caller. This throws so a caller can decide to continue.
 */
export async function prepareKitBuyer(
  db: ReturnType<typeof kitDb>,
  email: string,
  name: string,
  metadata: Record<string, string | null | undefined> | null | undefined,
  purchasedAt?: string | null,
) {
  const clean = email.trim().toLowerCase();
  const read = async () => {
    const { data, error } = await db.from("saas_suite_users").select(KIT_ATTRIBUTION_COLUMNS).ilike("email", clean).maybeSingle();
    if (error) throw new Error(error.message || "Could not read the buyer");
    return data as { id: number; source?: string | null } | null;
  };
  try {
    const before = await read();
    const { error } = await db.rpc("register_starter_user", { user_email: clean, user_affiliate_id: null });
    if (error) console.error("kit starter row", error.message);
    const after = await read();
    if (after?.id) {
      const patch = kitBuyerAttributionPatch({
        existing: after,
        metadata,
        name,
        nowIso: new Date().toISOString(),
        createdHere: !before && after.source === "signup",
      });
      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await db.from("saas_suite_users").update(patch).eq("id", after.id);
        if (updateError) console.error("kit attribution", updateError.message);
      }
    }
  } catch (error) {
    console.error("kit attribution", error instanceof Error ? error.message : "unknown");
  }
  await grantKitBasicAccess(db, clean, purchasedAt);
}
export async function kitNotify(stripe: Stripe, checkoutId: string, offerId?: KitPostPurchaseId, intentId?: string) {
  const verified = await verifiedKitSession(stripe, checkoutId);
  const { session, customerId, paymentMethodId } = verified;
  let ids: KitLineId[] = verified.ids;
  let charged = verified.comped ? 0 : ids.reduce((sum, id) => sum + KIT_CATALOG[id].amount, 0);
  const db = kitDb();
  if (offerId) {
    const mode = upsellChargeMode(verified);
    if (mode === "comped") {
      if (intentId) throw new Error("Comped add-on has no payment");
      ids = [offerId];
      charged = 0;
      await saveKitEntitlements(db, [upsellEntitlementRow(session as KitCheckoutSession, checkoutId, offerId, null, true)]);
    } else {
      if (!intentId || !paymentMethodId) throw new Error("Missing add-on payment");
      const intent = await stripe.paymentIntents.retrieve(intentId);
      const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
      const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
      if (!intent.livemode || intent.status !== "succeeded" || intent.currency !== "usd" || intent.amount_received !== KIT_CATALOG[offerId].amount || intent.metadata.funnel !== KIT_FUNNEL || intent.metadata.checkout_id !== checkoutId || intent.metadata.offer_id !== offerId || customer !== customerId || pm !== paymentMethodId) throw new Error("Add-on payment has not been confirmed");
      ids = [offerId];
      charged = KIT_CATALOG[offerId].amount;
      await saveKitEntitlements(db, [upsellEntitlementRow(session as KitCheckoutSession, checkoutId, offerId, intent.id, false)]);
    }
  } else {
    await saveKitEntitlements(db, checkoutEntitlementRows(session as KitCheckoutSession, checkoutId));
  }
  await attachKnownKitBuyer(db, kitBuyerEmail(session as KitCheckoutSession));
  // Only the server's configured agency can receive these notifications.
  const agency = Deno.env.get("KIT_SLACK_AGENCY_ID")?.trim();
  const token = Deno.env.get("SLACK_NOTIFY_TOKEN");
  if (!agency || !token) {
    const skipped = !agency ? "no agency" : "no token";
    console.error("kit slack notify failed", JSON.stringify({ checkoutId, skipped }));
    return { ok: true, skipped };
  }
  const actionKey = `notify:${checkoutId}:${offerId ?? "checkout"}`;
  const { data: claimed, error } = await db.rpc("claim_one_feature_kit_action", { p_key: actionKey });
  if (error) throw new Error("Notification claim failed");
  if (!claimed) {
    const { data: action } = await db.from("one_feature_kit_actions").select("completed").eq("action_key", actionKey).single();
    if (action?.completed) return { ok: true, duplicate: true };
    throw new Error("Notification is already processing; retry later");
  }
  try {
    const forwarded = await forwardKitSlack("one_feature_kit_purchase", {
      checkout_id: checkoutId,
      ...(offerId ? { offer_id: offerId } : {}),
      name: session.customer_details?.name || session.metadata?.name || "",
      email: session.customer_details?.email || session.metadata?.email || "",
      phone: session.customer_details?.phone || session.metadata?.phone || "",
      total: `$${(charged / 100).toFixed(2)}`,
      lines: ids.map(id => KIT_CUSTOMER_COPY[id].name),
    });
    if ("skipped" in forwarded) {
      await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", actionKey);
      return { ok: true, skipped: forwarded.skipped };
    }
    const { error: doneError } = await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", actionKey);
    if (doneError) throw new Error("Notification completion failed");
    return { ok: true, forwarded: true, channel: forwarded.channel, team: forwarded.team };
  } catch (error) {
    await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", actionKey);
    throw error;
  }
}
/** Copy an already-linked user onto later rows for the same email, such as an upsell. */
export async function attachKnownKitBuyer(db: ReturnType<typeof kitDb>, email: string, userId?: string | null) {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) return;
  let id = userId ?? null;
  if (!id) {
    const { data, error } = await db.from("kit_purchases").select("user_id").eq("email", clean).not("user_id", "is", null).limit(1);
    if (error) throw new Error("Could not read kit purchases");
    id = data?.[0]?.user_id ?? null;
  }
  if (!id) return;
  const { error } = await db.from("kit_purchases").update({ user_id: id }).eq("email", clean).is("user_id", null);
  if (error) throw new Error("Could not link kit purchases");
}

/**
 * Create or reuse the buyer's SaaSSuite login and link kit_purchases.user_id.
 * The login email is the GoHighLevel kit_purchased workflow, not Resend.
 */
export async function sendKitBuyerLogin(stripe: Stripe, checkoutId: string) {
  const { session } = await verifiedKitSession(stripe, checkoutId);
  const email = kitBuyerEmail(session as KitCheckoutSession);
  const name = session.customer_details?.name || session.metadata?.name || "";
  const purchasedAt = typeof session.created === "number" ? new Date(session.created * 1000).toISOString() : null;
  const db = kitDb();
  const metadata = (session.metadata ?? null) as Record<string, string | null | undefined> | null;
  const loginKey = `kit-login:${checkoutId}`;
  const settleBuyer = async (buyerEmail: string, buyerName: string, buyerMetadata: Record<string, string | null | undefined> | null) => {
    try {
      await prepareKitBuyer(db, buyerEmail, buyerName, buyerMetadata, purchasedAt);
    } catch (error) {
      console.error("kit starter", error instanceof Error ? error.message : "unknown");
    }
  };
  const result = await deliverKitBuyerLogin({
    checkoutId,
    email,
    name,
    metadata,
    claim: async (key) => {
      const { data, error } = await db.rpc("claim_one_feature_kit_action", { p_key: key });
      if (error) return null;
      return data === true;
    },
    readClaim: async (key) => {
      const { data } = await db.from("one_feature_kit_actions").select("completed").eq("action_key", key).maybeSingle();
      return data ? { completed: data.completed === true } : null;
    },
    releaseClaim: async (key) => {
      await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", key);
    },
    readStoredLogin: async () => {
      const { data } = await db.from("one_feature_kit_actions").select("stripe_id").eq("action_key", loginKey).maybeSingle();
      return parseStoredKitLogin(data?.stripe_id);
    },
    rememberLogin: async (stored) => {
      const { error } = await db.from("one_feature_kit_actions").update({ stripe_id: JSON.stringify(stored) }).eq("action_key", loginKey);
      if (error) console.error("kit login link store", error.message);
    },
    admin: db.auth.admin,
    ensureStarter: (buyerEmail, context) => settleBuyer(buyerEmail, context.name || name, context.metadata ?? metadata),
    linkUser: (buyerEmail, userId) => attachKnownKitBuyer(db, buyerEmail, userId),
  });
  // A repeat claim returns before ensureStarter. Still raise Starter and fill empty attribution.
  if (result.duplicate || result.skipped === "in progress") await settleBuyer(email, name, metadata);
  return result;
}

/**
 * Mark kit-login completed after GoHighLevel returned 2xx for kit_purchased.
 * Minting the link does not do this. A timeout or a non-2xx leaves the row incomplete.
 * The update keeps a stored magic link in stripe_id. A missing row is inserted.
 */
export async function markKitLoginCompleted(db: ReturnType<typeof kitDb>, checkoutId: string, outcome: string): Promise<boolean> {
  return completeKitLoginAfterGhl({
    checkoutId,
    outcome,
    markCompleted: async (key) => {
      if (key !== kitLoginActionKey(checkoutId)) throw new Error("Kit login key mismatch");
      const { data, error } = await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", key).select("action_key");
      if (error) throw new Error("Kit login completion failed");
      if (data && data.length > 0) return;
      const { error: insertError } = await db.from("one_feature_kit_actions").insert({ action_key: key, completed: true });
      if (insertError && insertError.code !== "23505") throw new Error("Kit login completion failed");
    },
  });
}

// All payment confirmations go through the kit notification endpoint, including webhooks.
export async function requestKitNotify(checkoutId: string, offerId?: string, intentId?: string) {
  const key = Deno.env.get("SLACK_NOTIFY_TOKEN");
  if (!key || !Deno.env.get("KIT_SLACK_AGENCY_ID")?.trim()) return;
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/one-feature-kit-purchase-notify`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ event_type: "one_feature_kit_purchase", data: { checkout_id: checkoutId, offer_id: offerId, payment_intent_id: intentId } }),
  });
  if (!response.ok) {
    console.error("kit purchase notify http", response.status, (await response.text()).slice(0, 300));
    throw new Error("Purchase notification needs retry");
  }
}
