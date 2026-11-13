import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendMetaPurchase } from "../_shared/meta-capi.ts";
import { sendClaimedSubscriptionPurchase, subscriptionPurchasePlan } from "../_shared/app-purchase-send.ts";
import { purchaseEventId, splitPersonName } from "../_shared/stape-purchase.ts";
import { skipCheckoutPurchase } from "../_shared/meta-purchase-guard.ts";
import { isOneFeatureKitFunnel } from "../_shared/kit-meta.ts";
import { purgeBrandingCacheForEmail } from "../_shared/branding-cache.ts";
import {
  isAgencySupportSubscription,
  syncAgencySupportWallet,
} from "../_shared/agency-support.ts";
import { recordCheckoutSession } from "../_shared/journey-log.ts";
import {
  applyImmediateCancelAttempt,
  bindSubscriptionCanceledClaim,
  cancelDedupeKey,
  cancelResponseStatus,
  emailImmediateClaimKey,
  immediateClaimKeyFromPrior,
  immediateClaimKeysToHonor,
  insertSubscriptionCanceledClaim,
  logSubscriptionOutcome,
  planSubscriptionCancel,
  readCancelClaim,
  recordSubscriptionCanceled,
  shouldRecordScheduledCancel,
  writeCancelSchedule,
  type MessageInsertResult,
  type SubscriptionCanceledMessage,
} from "../_shared/subscription-cancel-log.ts";
import { metadataIsTest, metaSendPlan, metaTestEventCode } from "../_shared/test-traffic.ts";
import { commitSaasUserWrite } from "../_shared/saas-user-write.ts";
import { decideSubscriptionPlan } from "../_shared/planRank.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Map of Stripe price IDs -> plan tier. Includes both live + test price IDs
// from supabase/functions/create-checkout/index.ts.
const PRICE_TO_PLAN: Record<string, "BASIC" | "ADVANCED"> = {
  // Live
  price_1Se8YfGdZ9PRE3Zi2GWbiNel: "BASIC",
  price_1UJ0C2GdZ9PRE3ZiObuEAWzF: "BASIC", // $240/year
  price_1SDdmJGdZ9PRE3Zi84yGzqVd: "ADVANCED",
  price_1UJ0CHGdZ9PRE3ZiGBkh28XD: "ADVANCED", // $870/year
  price_1UJ0CYGdZ9PRE3ZirCTXUbRf: "ADVANCED", // Premium Support $2,670/year
  price_1SDdlrGdZ9PRE3Zil8llulnB: "ADVANCED", // yearly
  price_1UGrjzGdZ9PRE3Zi5rEknrLQ: "ADVANCED", // Webinar Special $2,470/year
  price_1UNPAOGdZ9PRE3ZiQIH5kh8O: "ADVANCED", // Special offer $997/year
  price_1S8su4GdZ9PRE3Zi28ngcJmQ: "ADVANCED", // SAASSuite SUPER PROMO $582/year
  // Legacy / GoHighLevel-created prices still being sold on funnels + payment
  // links. These MUST be mapped: an unmapped price means a paying customer is
  // never upgraded and stays on STARTER.
  price_1S5e0GGdZ9PRE3ZiwB9RqElW: "ADVANCED", // legacy $97/month (LeadConnector)
  price_1S0rmpGdZ9PRE3ZiYBtf1fmc: "ADVANCED", // legacy $99/month
  price_1SF5lfGdZ9PRE3ZiHOkFa5d5: "ADVANCED", // Advanced Trial $97
  price_1RvlDAGdZ9PRE3Zi0CGfNVDj: "ADVANCED", // legacy $19/month (yearly $970 plan)
  price_1STCN6GdZ9PRE3Zi3CAjmYWq: "ADVANCED", // Webinar Special $970/year
  price_1SDUz7GdZ9PRE3ZiT6oUjevW: "BASIC", // SaaSSuite Basic $27
  price_1SF5kZGdZ9PRE3Zi2aleHiFE: "BASIC", // SaaSSuite Basic Trial $27
  // Test
  price_1Se8YfGdZ9PRE3ZiEuKVMphI: "BASIC",
  price_1SDdmJGdZ9PRE3ZiHzQklJJi: "ADVANCED",
};


// Every Stripe price (current + legacy) that grants SaaSSuite platform access.
// Only cancellations of THESE prices revoke access — cancelling an add-on such
// as the Branding Tool, Agency Support or an unrelated product must not.
const ACCESS_PRICE_IDS = new Set<string>([
  ...Object.keys(PRICE_TO_PLAN),
  "price_1SDUz7GdZ9PRE3ZiT6oUjevW", // SaaSSuite Basic $27
  "price_1SF5kZGdZ9PRE3Zi2aleHiFE", // SaaSSuite Basic Trial $27
  "price_1SF5lfGdZ9PRE3ZiHOkFa5d5", // SaaSSuite Advanced Trial $97
  "price_1S5e0GGdZ9PRE3ZiwB9RqElW", // legacy $97/month
  "price_1S0rmpGdZ9PRE3ZiYBtf1fmc", // legacy $99/month
  "price_1RvlDAGdZ9PRE3Zi0CGfNVDj", // legacy $19/month (yearly $970 plan)
  "price_1STCN6GdZ9PRE3Zi3CAjmYWq", // Webinar Special $970/year
  "price_1UGrjzGdZ9PRE3Zi5rEknrLQ", // Webinar Special $2,470/year
  "price_1UNPAOGdZ9PRE3ZiQIH5kh8O", // Special offer $997/year
]);

// Advanced + Premium Support lives on this Stripe product ($297/mo, plus
// legacy prices). It grants the ADVANCED tier and sets premium_support.
const PREMIUM_SUPPORT_PRODUCT = "prod_TkZfcTSnSGktxJ";
const LEGACY_PREMIUM_SUPPORT_PRICES = new Set<string>([
  "price_1TuDQLGdZ9PRE3ZijTZc2bAl", // legacy $197/mo
  "price_1UFi82GdZ9PRE3ZilpBUcd4t", // legacy $247/mo (ss_premium_support_247_monthly)
  "price_1UFnB8GdZ9PRE3ZiKwa8pHPH", // current $297/mo (ss_premium_support_297_monthly)
  "price_1UJ0CYGdZ9PRE3ZirCTXUbRf", // current $2,670/year
]);

function stripeCustomerId(customer: Stripe.Subscription["customer"] | Stripe.Checkout.Session["customer"]): string {
  if (!customer) return "";
  return typeof customer === "string" ? customer : customer.id || "";
}

function subProductId(sub: Stripe.Subscription): string {
  const product = sub.items?.data?.[0]?.price?.product;
  if (!product) return "";
  return typeof product === "string" ? product : (product as { id?: string }).id ?? "";
}

function isPremiumSupportSub(sub: Stripe.Subscription): boolean {
  const priceId = sub.items?.data?.[0]?.price?.id || "";
  return subProductId(sub) === PREMIUM_SUPPORT_PRODUCT || LEGACY_PREMIUM_SUPPORT_PRICES.has(priceId);
}

/** End of the period the customer already paid for (item-level on basil API). */
function paidPeriodEnd(sub: Stripe.Subscription): Date | null {
  // deno-lint-ignore no-explicit-any
  const s = sub as any;
  const ts = s.items?.data?.[0]?.current_period_end ?? s.current_period_end ?? null;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

const MAX_USERS: Record<string, number> = {
  BASIC: 5,
  ADVANCED: 10000,
};


const liveSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
const testSecret = Deno.env.get("STRIPE_TEST_SECRET_KEY") || "";
const liveWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const testWebhookSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET") || "";

async function insertTrackedMessage(row: SubscriptionCanceledMessage): Promise<MessageInsertResult> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    const error = "missing Supabase credentials";
    console.error(`customer_message_events insert skipped template=${row.templateKey} email=${row.userEmail}: ${error}`);
    return { ok: false, error };
  }
  const admin = createClient(url, serviceKey);
  return insertSubscriptionCanceledClaim(admin, row);
}

async function verifyWithEither(stripe: Stripe, payload: string, sig: string) {
  const secrets = [liveWebhookSecret, testWebhookSecret].filter(Boolean);
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(payload, sig, secret);
    } catch (_) { /* try next */ }
  }
  throw new Error("Invalid signature for all configured webhook secrets");
}

export async function handleStripeSubscriptionWebhook(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  // Use the live key for verification primarily; signature verification doesn't
  // hit Stripe's API so the key choice here is irrelevant. We use both webhook
  // secrets to support live + test endpoints under the same function.
  const stripe = new Stripe(liveSecret || testSecret, { apiVersion: "2025-08-27.basil" });

  let event: Stripe.Event;
  try {
    event = await verifyWithEither(stripe, payload, sig);
  } catch (err) {
    console.error("[STRIPE-SUB-WEBHOOK] Signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[STRIPE-SUB-WEBHOOK] Received ${event.type} (livemode=${event.livemode})`);

  // One closing line per event: who, which price, and what we did or why we skipped.
  let followUp = "";
  const endTracked = (
    body: Record<string, unknown>,
    outcome: { customer?: string | null; price?: string | null; result: string },
    status = 200,
  ) => {
    const result = followUp ? `${followUp}; ${outcome.result}` : outcome.result;
    logSubscriptionOutcome({ customer: outcome.customer, price: outcome.price, result });
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  // checkout.session.completed: fulfillment is handled by notify-stripe-purchase,
  // but Meta reporting must not depend on the browser coming back. Fire the
  // Purchase here for a completed paid order. A $0 total or a 100%-off promo
  // skips the Purchase event and its value. event_id order_<session id> matches
  // the pixel and notify-stripe-purchase, so Meta dedupes to one conversion.
  if (event.type === "checkout.session.expired") {
    const expired = event.data.object as Stripe.Checkout.Session;
    const expiredEmail = expired.customer_details?.email || expired.customer_email || expired.metadata?.email || null;
    await recordCheckoutSession({
      stripeCheckoutSessionId: expired.id,
      email: expiredEmail,
      status: "expired",
      amountCents: typeof expired.amount_total === "number" ? expired.amount_total : null,
      currency: expired.currency,
      isTest: metadataIsTest(expired.metadata),
    });
    return endTracked(
      { received: true, checkout: "expired" },
      {
        customer: expiredEmail || stripeCustomerId(expired.customer),
        price: expired.metadata?.plan || "checkout",
        result: "checkout expired",
      },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await recordCheckoutSession({
      stripeCheckoutSessionId: session.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email || null,
      status: session.payment_status === "paid" || session.status === "complete" ? "completed" : "open",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
      currency: session.currency,
      plan: session.metadata?.plan || null,
      flow: isOneFeatureKitFunnel(session.metadata) ? "one_feature_kit" : "subscription",
      isTest: metadataIsTest(session.metadata),
    });
    // Kit purchases are reported by one-feature-kit-webhook with fbp/fbc/IP/UA
    // and the real line items. This generic Purchase has none of that.
    let sessionEmailForLog =
      session.customer_details?.email || session.customer_email || (session.metadata as Record<string, string> | null)?.email || "";
    const sessionPriceForLog = (session.metadata as Record<string, string> | null)?.plan || "checkout";
    if (isOneFeatureKitFunnel(session.metadata)) {
      console.log(`[STRIPE-SUB-WEBHOOK] skipped Meta Purchase ${session.id} one-feature-kit`);
      return endTracked(
        { received: true, meta_purchase: false, skipped: "one-feature-kit" },
        { customer: sessionEmailForLog || stripeCustomerId(session.customer), price: sessionPriceForLog, result: "skipped one-feature-kit" },
      );
    }
    if (session.payment_status === "paid" || session.status === "complete") {
      const md = (session.metadata ?? {}) as Record<string, string>;
      let sessionEmail =
        session.customer_details?.email || session.customer_email || md.email || "";
      if (!sessionEmail && typeof session.customer === "string") {
        try {
          const apiStripe = new Stripe(event.livemode ? liveSecret : testSecret, {
            apiVersion: "2025-08-27.basil",
          });
          const customer = await apiStripe.customers.retrieve(session.customer);
          if (!("deleted" in customer) && customer.email) sessionEmail = customer.email;
        } catch (e) {
          console.error("[STRIPE-SUB-WEBHOOK] customer lookup failed", e);
        }
      }

      const testPurchase = metadataIsTest(md);
      const capiPlan = metaSendPlan(testPurchase, metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")));
      const purchaseRoute = subscriptionPurchasePlan({
        isTest: testPurchase,
        utmSource: md.utm_source,
        explicitTestEventCode: md.test_event_code,
      });
      if (purchaseRoute.route === "stape") {
        if (skipCheckoutPurchase(session)) {
          console.log(`[STRIPE-SUB-WEBHOOK] skipped Meta Purchase ${session.id} zero total or 100% off`);
        } else {
          const buyerName = splitPersonName(session.customer_details?.name || md.name);
          const contentId = md.plan || md.course || md.product;
          await sendClaimedSubscriptionPurchase({
            plan: purchaseRoute,
            orderId: session.id,
            purchase: {
              eventId: purchaseEventId(session.id),
              eventTimeSec: typeof session.created === "number" ? session.created : Math.floor(Date.now() / 1000),
              value: typeof session.amount_total === "number" ? session.amount_total / 100 : 0,
              currency: session.currency || "USD",
              orderId: session.id,
              email: sessionEmail,
              phone: session.customer_details?.phone || md.phone || null,
              firstName: buyerName.firstName,
              lastName: buyerName.lastName,
              fbp: md.fbp || null,
              fbc: md.fbc || null,
              fbclid: md.fbclid || null,
              eventSourceUrl: md.checkout_page || md.landing_page || null,
              clientIp: md.client_ip || null,
              clientUserAgent: md.client_ua || null,
              externalId: typeof session.customer === "string" ? session.customer : null,
              contentIds: contentId ? [contentId] : null,
            },
          });
        }
      } else if (purchaseRoute.route === "skip" || (testPurchase && !capiPlan.send)) {
        console.log(`[STRIPE-SUB-WEBHOOK] skipped Meta Purchase ${session.id} test traffic`);
      } else if (skipCheckoutPurchase(session)) {
        console.log(`[STRIPE-SUB-WEBHOOK] skipped Meta Purchase ${session.id} zero total or 100% off`);
      } else {
        console.log("purchase route direct", session.id);
        await sendMetaPurchase({
          orderId: session.id,
          email: sessionEmail,
          value: typeof session.amount_total === "number" ? session.amount_total / 100 : 0,
          currency: session.currency || "USD",
          fbclid: md.fbclid || null,
          fbc: md.fbc || null,
          fbp: md.fbp || null,
          eventSourceUrl: md.checkout_page || md.landing_page || null,
          isTest: testPurchase,
        });
      }
      if (sessionEmail) sessionEmailForLog = sessionEmail;
    }
    const testPurchase = metadataIsTest((session.metadata ?? {}) as Record<string, string>);
    const capiPlan = metaSendPlan(testPurchase, metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")));
    const checkoutPaid = session.payment_status === "paid" || session.status === "complete";
    const checkoutResult = !checkoutPaid
      ? "checkout open"
      : testPurchase && !capiPlan.send
        ? "test mode"
        : skipCheckoutPurchase(session)
          ? "skipped zero total"
          : "checkout completed";
    return endTracked(
      {
        received: true,
        meta_purchase: !(testPurchase && !capiPlan.send) && !skipCheckoutPurchase(session),
      },
      {
        customer: sessionEmailForLog || stripeCustomerId(session.customer),
        price: sessionPriceForLog,
        result: checkoutResult,
      },
    );
  }

  // Agency Support add-on ($49/mo per client account): the wallet is the summed
  // quantity of the customer's active Agency Support subscription items, so any
  // create / update / cancel event re-syncs it from Stripe.
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const agencySub = event.data.object as Stripe.Subscription;
    if (isAgencySupportSubscription(agencySub)) {
      const customerId = stripeCustomerId(agencySub.customer);
      const fallbackEmail = (agencySub.metadata as Record<string, string> | null)?.email || "";
      const agencyPrice = agencySub.items?.data?.[0]?.price?.id || subProductId(agencySub);
      try {
        const apiStripe = new Stripe(event.livemode ? liveSecret : testSecret, {
          apiVersion: "2025-08-27.basil",
        });
        const result = await syncAgencySupportWallet(apiStripe, customerId, fallbackEmail);
        return endTracked(
          { received: true, agency_support: true, wallet: result?.seats ?? null },
          {
            customer: result?.email || fallbackEmail || customerId,
            price: agencyPrice,
            result: "synced agency support wallet",
          },
        );
      } catch (e) {
        console.error("[STRIPE-SUB-WEBHOOK] agency support sync failed", e);
        return endTracked(
          { received: true, agency_support_error: true },
          { customer: fallbackEmail || customerId, price: agencyPrice, result: "agency support sync failed" },
        );
      }
    }
  }

  // Scheduled cancellation (cancel at period end): show the countdown banner,
  // or clear it if they resumed. Plan-change handling below still runs.
  if (event.type === "customer.subscription.updated") {
    const s = event.data.object as Stripe.Subscription;
    const pid = s.items?.data?.[0]?.price?.id || "";
    if (["active", "trialing"].includes(s.status) && (ACCESS_PRICE_IDS.has(pid) || isPremiumSupportSub(s))) {
      try {
        const apiStripe = new Stripe(event.livemode ? liveSecret : testSecret, { apiVersion: "2025-08-27.basil" });
        const cid = typeof s.customer === "string" ? s.customer : s.customer?.id || "";
        let em = (s.metadata as Record<string, string> | null)?.email || "";
        if (!em && cid) {
          const c = await apiStripe.customers.retrieve(cid);
          if (!("deleted" in c) && c.email) em = c.email;
        }
        if (em) {
          const scheduled = s.cancel_at_period_end || !!s.cancel_at;
          const until = scheduled
            ? (s.cancel_at ? new Date(s.cancel_at * 1000) : paidPeriodEnd(s))
            : null;
          const untilIso = until ? until.toISOString() : null;
          const normalized = em.trim().toLowerCase();
          const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          const { data: prior, error: priorError } = await admin
            .from("saas_suite_users")
            .select("cancel_access_until")
            .ilike("email", normalized)
            .maybeSingle();
          const whenIso = paidPeriodEnd(s)?.toISOString()
            ?? (s.cancel_at ? new Date(s.cancel_at * 1000).toISOString() : null);
          const immediateKey = untilIso
            ? cancelDedupeKey(s.id, whenIso ?? untilIso, "immediate")
            : null;
          await writeCancelSchedule(admin, normalized, {
            cancel_access_until: untilIso,
            cancel_claim_key: immediateKey,
          });
          if (priorError) {
            console.error("[STRIPE-SUB-WEBHOOK] cancel schedule read failed", priorError.message);
          } else if (prior && shouldRecordScheduledCancel(prior.cancel_access_until, untilIso)) {
            // Countdown key ends in :cancel_at_period_end. A later delete uses
            // :access_kept or :immediate, so those keys do not match.
            const claim = bindSubscriptionCanceledClaim(admin);
            const recorded = await recordSubscriptionCanceled({
              email: normalized,
              priceId: pid,
              productId: subProductId(s),
              subscriptionId: s.id,
              kind: "cancel_at_period_end",
              accessUntil: untilIso,
              dedupeKey: cancelDedupeKey(s.id, whenIso ?? untilIso, "cancel_at_period_end"),
              immediateClaimKey: immediateKey,
              markStatus: claim.markStatus,
              insertMessage: insertTrackedMessage,
            });
            followUp = recorded.duplicate ? "duplicate" : `scheduled cancel until ${untilIso}`;
          } else if (prior && !untilIso && prior.cancel_access_until) {
            followUp = "cancel schedule cleared";
          }
        }
      } catch (e) {
        console.error("[STRIPE-SUB-WEBHOOK] scheduled-cancel sync failed", e);
      }
    }
  }

  // ── CANCELLATIONS (Stripe is the source of truth) ───────────────────────────
  // A cancelled / unpaid SaaSSuite plan revokes access immediately, regardless of
  // whether the GHL automation fires. Add-ons and unrelated products are ignored.
  //
  // Stripe sends customer.subscription.updated (status canceled) and
  // customer.subscription.deleted for one cancel, in either order. Each request
  // used to log "access kept until" once, so the pair looked like a deleted
  // event logging twice. The dedupe key is the subscription id, the period
  // end (or cancel_at), and the kind. The same kind shares one row. The
  // countdown kind does not share a key with the delete. The claim locks that
  // key and inserts only when no row exists. GoHighLevel is posted only when
  // a row comes back. A claim error that is not a duplicate returns 500 so
  // Stripe retries. Duplicates and a failed GoHighLevel post stay 200.
  // expire-payment-grace claims the same immediate key, so only one of them posts.
  // Grace also posts when that key was never stored. This handler treats the
  // stored key and the email fallback as the same claim and does not post again.
  //
  // customer.subscription.deleted means the subscription is already gone in
  // Stripe. A future current_period_end still means they paid through that
  // instant, so access stays (cancel_access_until) and billing_state stays
  // ACTIVE. The updated event uses that same rule only after status is
  // canceled. An updated event that is still active or trialing with
  // cancel_at_period_end does not enter this branch; the block above only
  // sets the countdown. expire-payment-grace revokes access when the date passes.
  const isCancelEvent =
    event.type === "customer.subscription.deleted" ||
    (event.type === "customer.subscription.updated" &&
      ["canceled", "unpaid", "incomplete_expired"].includes(
        (event.data.object as Stripe.Subscription).status,
      ));

  if (isCancelEvent) {
    try {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items?.data?.[0]?.price?.id || "";
      const productId = subProductId(sub);
      const priceLabel = priceId || productId;
      if (!ACCESS_PRICE_IDS.has(priceId) && !isPremiumSupportSub(sub)) {
        return endTracked(
          { received: true, cancel_ignored_price: priceId },
          { customer: stripeCustomerId(sub.customer), price: priceLabel, result: "not a SaaSSuite price" },
        );
      }

      const apiStripe = new Stripe(event.livemode ? liveSecret : testSecret, {
        apiVersion: "2025-08-27.basil",
      });
      const customerId = stripeCustomerId(sub.customer);

      // Don't suspend if the same customer still has another live plan
      // (upgrade/downgrade replaces one subscription with another).
      if (customerId) {
        const others = await apiStripe.subscriptions.list({ customer: customerId, limit: 100 });
        const stillLive = others.data.some(
          (s: Stripe.Subscription) =>
            s.id !== sub.id &&
            ["active", "trialing", "past_due"].includes(s.status) &&
            (ACCESS_PRICE_IDS.has(s.items?.data?.[0]?.price?.id || "") || isPremiumSupportSub(s)),
        );
        if (stillLive) {
          return endTracked(
            { received: true, cancel_skipped: "other_active_plan" },
            { customer: customerId, price: priceLabel, result: "other active plan" },
          );
        }
      }

      let cancelEmail = (sub.metadata as Record<string, string> | null)?.email || "";
      if (!cancelEmail && customerId) {
        const customer = await apiStripe.customers.retrieve(customerId);
        if (!("deleted" in customer) && customer.email) cancelEmail = customer.email;
      }
      if (!cancelEmail) {
        console.error("[STRIPE-SUB-WEBHOOK] cancel event with no email", sub.id);
        return endTracked(
          { received: true, cancel_no_email: true },
          { customer: customerId, price: priceLabel, result: "unknown customer" },
        );
      }
      const cancelNormalized = cancelEmail.trim().toLowerCase();

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: current } = await admin
        .from("saas_suite_users")
        .select("approval")
        .ilike("email", cancelNormalized)
        .maybeSingle();

      if (!current) {
        return endTracked(
          { received: true, cancel_user_not_found: true },
          { customer: cancelNormalized, price: priceLabel, result: "unknown customer" },
        );
      }
      // Losing the Premium Support subscription removes that flag straight away.
      const paidUntil = paidPeriodEnd(sub);
      const plan = planSubscriptionCancel({
        eventType: event.type,
        subscriptionId: sub.id,
        status: sub.status,
        periodEndMs: paidUntil ? paidUntil.getTime() : null,
        cancelAtMs: sub.cancel_at ?? null,
        nowMs: Date.now(),
      });
      const claim = bindSubscriptionCanceledClaim(admin);
      const storedClaim = await readCancelClaim(admin, cancelNormalized);
      const periodIso = paidUntil ? paidUntil.toISOString() : null;
      const { data: priorCancels } = await admin
        .from("customer_message_events")
        .select("metadata")
        .eq("template_key", "subscription_canceled")
        .eq("user_email", cancelNormalized)
        .order("created_at", { ascending: false })
        .limit(20);
      const priorInstant = periodIso || storedClaim.accessUntil || plan.accessUntil;
      const fromPrior = priorInstant
        ? immediateClaimKeyFromPrior(priorCancels ?? [], priorInstant)
        : null;
      const honorKeys = immediateClaimKeysToHonor({
        subscriptionKey: plan.dedupeKey,
        email: cancelNormalized,
        storedKey: storedClaim.claimKey || fromPrior,
        instants: [periodIso, storedClaim.accessUntil, plan.accessUntil],
      });
      for (const key of honorKeys) {
        if (await claim.findExisting(key)) {
          return endTracked(
            { received: true, duplicate: true },
            { customer: cancelNormalized, price: priceLabel, result: "duplicate" },
          );
        }
      }
      // Honor the already-paid billing period: keep full access until it ends.
      // The daily expire-payment-grace job downgrades once the date passes and
      // claims the same immediate key this delete will use later.
      if (plan.keepsAccess && plan.accessUntil) {
        const immediateKey = cancelDedupeKey(sub.id, plan.accessUntil, "immediate");
        await writeCancelSchedule(admin, cancelNormalized, {
          cancel_access_until: plan.accessUntil,
          cancel_claim_key: immediateKey,
        });
        const recorded = await recordSubscriptionCanceled({
          email: cancelNormalized,
          priceId,
          productId,
          subscriptionId: sub.id,
          kind: plan.kind,
          accessUntil: plan.accessUntil,
          dedupeKey: plan.dedupeKey,
          immediateClaimKey: cancelDedupeKey(sub.id, plan.accessUntil, "immediate"),
          markStatus: claim.markStatus,
          insertMessage: insertTrackedMessage,
        });
        if (recorded.duplicate) {
          return endTracked(
            { received: true, duplicate: true },
            { customer: cancelNormalized, price: priceLabel, result: "duplicate" },
          );
        }
        if (cancelResponseStatus(recorded) !== 200) {
          return endTracked(
            { received: true, claim_failed: true },
            { customer: cancelNormalized, price: priceLabel, result: "subscription_canceled claim failed" },
            500,
          );
        }
        console.log(`[STRIPE-SUB-WEBHOOK] ${cancelNormalized} canceled; access kept until ${plan.accessUntil}`);
        return endTracked(
          { received: true, access_until: plan.accessUntil },
          { customer: cancelNormalized, price: priceLabel, result: `canceled; access kept until ${plan.accessUntil}` },
        );
      }

      // Cancellation never blocks the owner's login — it flips the account to
      // PAST_DUE: Starter limits, branding/menu-link removals parked, and only
      // their first customer keeps hub access.
      // Those writes are safe on a Stripe retry: Premium Support stays false,
      // mark_payment_delinquent does nothing once the account is PAST_DUE, and
      // the audit row is inserted once per cancel key.
      let delinquency: unknown = null;
      // Prefer the key grace already has. With nothing stored, both paths claim
      // the email instant so a missing subscription_canceled row cannot dual-skip
      // or double-post.
      const fallbackInstant = periodIso || storedClaim.accessUntil;
      const postKey = storedClaim.claimKey
        || fromPrior
        || (fallbackInstant ? emailImmediateClaimKey(cancelNormalized, fallbackInstant) : plan.dedupeKey);
      const delivery = await applyImmediateCancelAttempt({
        cancelKey: postKey,
        clearPremium: async () => {
          if (!isPremiumSupportSub(sub)) return;
          await admin
            .from("saas_suite_users")
            .update({ premium_support: false })
            .ilike("email", cancelNormalized);
        },
        markDelinquent: async () => {
          const { data, error } = await admin.rpc("mark_payment_delinquent", {
            user_email: cancelNormalized,
            p_reason: "stripe_canceled",
          });
          if (error) {
            console.error("[STRIPE-SUB-WEBHOOK] mark_payment_delinquent failed", error);
            return { error: true, details: null };
          }
          delinquency = data;
          return { error: false, details: data };
        },
        auditExists: async () => {
          const { data, error } = await admin
            .from("billing_delinquency_log")
            .select("id")
            .eq("email", cancelNormalized)
            .eq("action", "past_due")
            .contains("details", { cancel_key: postKey })
            .limit(1);
          if (error) {
            console.error("[STRIPE-SUB-WEBHOOK] delinquency audit lookup failed", error.message);
            return false;
          }
          return (data?.length ?? 0) > 0;
        },
        insertAudit: async (details) => {
          await admin.from("billing_delinquency_log").insert({
            email: cancelNormalized,
            action: "past_due",
            details,
          });
        },
        purgeCache: () => purgeBrandingCacheForEmail(admin, cancelNormalized),
        record: () => recordSubscriptionCanceled({
          email: cancelNormalized,
          priceId,
          productId,
          subscriptionId: sub.id,
          kind: plan.kind,
          accessUntil: periodIso,
          dedupeKey: postKey,
          markStatus: claim.markStatus,
          insertMessage: insertTrackedMessage,
        }),
      });
      if (delivery.duplicate) {
        return endTracked(
          { received: true, duplicate: true },
          { customer: cancelNormalized, price: priceLabel, result: "duplicate" },
        );
      }
      if (delivery.status !== 200) {
        return endTracked(
          { received: true, claim_failed: true },
          { customer: cancelNormalized, price: priceLabel, result: "subscription_canceled claim failed" },
          delivery.status,
        );
      }

      console.log(`[STRIPE-SUB-WEBHOOK] Marked past due ${cancelNormalized} (price ${priceId}, status ${sub.status})`);
      return endTracked(
        { received: true, past_due: true, email: cancelNormalized, delinquency },
        { customer: cancelNormalized, price: priceLabel, result: `marked past due (${sub.status})` },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[STRIPE-SUB-WEBHOOK] cancel handling failed", msg);
      return endTracked(
        { received: true, cancel_error: msg },
        { customer: "unknown", price: "unknown", result: "cancel handling failed" },
      );
    }
  }

  // Only process events that signal a plan change on an existing subscription.
  if (event.type !== "customer.subscription.updated" && event.type !== "customer.subscription.created") {
    return endTracked(
      { received: true, ignored: event.type },
      { customer: "unknown", price: "unknown", result: `skipped ${event.type}` },
    );
  }



  try {
    const sub = event.data.object as Stripe.Subscription;
    const priceId = sub.items?.data?.[0]?.price?.id || "";
    const priceLabel = priceId || subProductId(sub);
    if (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due") {
      console.log(`[STRIPE-SUB-WEBHOOK] Ignoring subscription in status=${sub.status}`);
      return endTracked(
        { received: true, ignored_status: sub.status },
        { customer: stripeCustomerId(sub.customer), price: priceLabel, result: `skipped status ${sub.status}` },
      );
    }

    const premiumSupport = isPremiumSupportSub(sub);
    const newPlan = PRICE_TO_PLAN[priceId] ?? (premiumSupport ? "ADVANCED" : undefined);
    if (!newPlan) {
      console.log(`[STRIPE-SUB-WEBHOOK] Unknown price ${priceId}, skipping`);
      return endTracked(
        { received: true, unknown_price: priceId },
        { customer: stripeCustomerId(sub.customer), price: priceLabel, result: "not a SaaSSuite price" },
      );
    }

    // Resolve customer email via the appropriate Stripe key for this event.
    const apiStripe = new Stripe(event.livemode ? liveSecret : testSecret, {
      apiVersion: "2025-08-27.basil",
    });
    let email = "";
    if (typeof sub.customer === "string") {
      const customer = await apiStripe.customers.retrieve(sub.customer);
      if (!("deleted" in customer) && customer.email) email = customer.email;
    }
    if (!email) {
      console.error("[STRIPE-SUB-WEBHOOK] No email on customer", sub.customer);
      return endTracked(
        { received: true, no_email: true },
        { customer: stripeCustomerId(sub.customer), price: priceLabel, result: "unknown customer" },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let { data: existing } = await supabase
      .from("saas_suite_users")
      .select("email, plan, agency_id, agency_id_basic, agency_id_advanced, max_onboarding_users, billing_state, premium_support, plan_before_delinquency")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (!existing) {
      // Server-side fulfillment safety net: a paying customer must ALWAYS get an
      // app row, even if the browser never returned to /success (tab closed,
      // redirect lost, payment link used instead of embedded checkout).
      let customerName = "";
      if (typeof sub.customer === "string") {
        try {
          const c = await apiStripe.customers.retrieve(sub.customer);
          if (!("deleted" in c) && c.name) customerName = c.name;
        } catch (_) { /* non-fatal */ }
      }
      const slugSource = customerName || normalizedEmail.split("@")[0] || "my-agency";
      const generatedAgencyId =
        slugSource
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 60) || "my-agency";

      const userColumns = "email, plan, agency_id, agency_id_basic, agency_id_advanced, max_onboarding_users, billing_state, premium_support, plan_before_delinquency";
      const insertRow = {
        email: normalizedEmail,
        approval: "YES",
        plan: newPlan,
        max_onboarding_users: MAX_USERS[newPlan],
        full_name: customerName || null,
        agency_name: customerName || generatedAgencyId,
        agency_id: generatedAgencyId,
        agency_id_basic: generatedAgencyId,
        ...(newPlan === "ADVANCED" ? { agency_id_advanced: generatedAgencyId } : {}),
        initial_questions_completed: false,
        source: "stripe_webhook",
        ...(premiumSupport
          ? { premium_support: true, premium_support_started_at: new Date().toISOString() }
          : {}),
      };
      // Slow updates on this table usually come from trg_branding_cache_users
      // (a forced CSS/JS rebuild when billing or agency ids change) plus
      // trg_ensure_agency_id on every write. Timeouts are retried below.
      const committed = await commitSaasUserWrite({
        insert: async () =>
          await supabase.from("saas_suite_users").insert(insertRow).select(userColumns).maybeSingle(),
        adopt: async () =>
          await supabase.from("saas_suite_users").select(userColumns).ilike("email", normalizedEmail).maybeSingle(),
      });
      if (!committed.ok) {
        console.error(`[STRIPE-SUB-WEBHOOK] user row not saved ${normalizedEmail}`, committed.reason, committed.message);
        return endTracked(
          { received: true, user_row_error: committed.message },
          { customer: normalizedEmail, price: priceLabel, result: "user row not saved" },
          500,
        );
      }
      if (committed.created) {
        await supabase
          .from("v2_home_settings")
          .upsert({ agency_id: generatedAgencyId }, { onConflict: "agency_id" });
        await supabase.from("agency_menu_config").upsert(
          { agency_id: generatedAgencyId, remove_launchpad: true, auto_navigate_on_login: true },
          { onConflict: "agency_id" },
        );

        console.log(`[STRIPE-SUB-WEBHOOK] Created missing user ${normalizedEmail} plan=${newPlan} agency_id=${generatedAgencyId}`);
        return endTracked(
          { received: true, created: true, email: normalizedEmail, plan: newPlan },
          { customer: normalizedEmail, price: priceLabel, result: `created ${newPlan}` },
        );
      }
      existing = committed.row;
      console.log(`[STRIPE-SUB-WEBHOOK] Insert conflict; syncing existing user ${normalizedEmail}`);
    }

    if (!existing) {
      console.error(`[STRIPE-SUB-WEBHOOK] user row missing after write ${normalizedEmail}`);
      return endTracked(
        { received: true, user_row_error: "missing" },
        { customer: normalizedEmail, price: priceLabel, result: "user row missing" },
        500,
      );
    }

    // A Basic price event must not replace Advanced. reconcile-plans already
    // skips when the current rank is at least the price's rank. This path did
    // not, so one Basic subscription.updated wrote ADVANCED → BASIC.
    const decision = decideSubscriptionPlan({
      currentPlan: existing.plan,
      protectedPlan: (existing as { plan_before_delinquency?: string | null }).plan_before_delinquency,
      incomingPlan: newPlan,
      currentMax: existing.max_onboarding_users,
    });
    const pastDue = String((existing as any).billing_state || "ACTIVE").toUpperCase() === "PAST_DUE";

    const clearDelinquency = async (plan: string) => {
      const { data: cleared, error: clearError } = await supabase.rpc(
        "clear_payment_delinquency",
        { user_email: normalizedEmail, p_plan: plan },
      );
      if (clearError) {
        console.error("[STRIPE-SUB-WEBHOOK] clear_payment_delinquency failed", clearError);
        return null;
      }
      return cleared;
    };

    if (premiumSupport && !(existing as any).premium_support) {
      await supabase
        .from("saas_suite_users")
        .update({ premium_support: true, premium_support_started_at: new Date().toISOString() })
        .ilike("email", normalizedEmail);
    }

    if (decision.action === "skip_downgrade") {
      console.log(`[STRIPE-SUB-WEBHOOK] skipped downgrade ${normalizedEmail}: kept ${decision.kept}, ignored ${decision.ignored} price=${priceLabel}`);
      // Past-due rows sit on STARTER. Restore the higher plan, not the cheaper price.
      if (pastDue || decision.liveBelowKept) {
        const cleared = await clearDelinquency(decision.kept);
        if (cleared) {
          await supabase.from("billing_delinquency_log").insert({
            email: normalizedEmail,
            action: "restored",
            details: cleared,
          });
        }
        await purgeBrandingCacheForEmail(supabase, normalizedEmail);
      }
      return endTracked(
        { received: true, skipped_downgrade: true, kept: decision.kept, ignored: decision.ignored },
        { customer: normalizedEmail, price: priceLabel, result: `skipped downgrade ${decision.kept} not ${decision.ignored}` },
      );
    }

    if (decision.action === "same") {
      if (pastDue) {
        const cleared = await clearDelinquency(newPlan);
        if (cleared) {
          await supabase.from("billing_delinquency_log").insert({
            email: normalizedEmail,
            action: "restored",
            details: cleared,
          });
        }
        await purgeBrandingCacheForEmail(supabase, normalizedEmail);
      }
      // Same tier: raise a short seat count, never lower it.
      if (decision.maxUsers != null) {
        await supabase
          .from("saas_suite_users")
          .update({ max_onboarding_users: decision.maxUsers })
          .ilike("email", normalizedEmail);
      }
      return endTracked(
        { received: true, no_change: true },
        { customer: normalizedEmail, price: priceLabel, result: "no change" },
      );
    }

    const updateData: Record<string, unknown> = {
      plan: decision.plan,
      max_onboarding_users: decision.maxUsers,
      approval: "YES",
    };

    // If they're being upgraded to ADVANCED and don't have an advanced agency id,
    // promote their existing agency_id (or basic id) as their advanced id so menu
    // links / dynamic styles work for the new tier.
    if (decision.plan === "ADVANCED" && !existing.agency_id_advanced) {
      const fallback = existing.agency_id || existing.agency_id_basic;
      if (fallback) updateData.agency_id_advanced = fallback;
    }

    await supabase
      .from("saas_suite_users")
      .update(updateData)
      .ilike("email", normalizedEmail);

    // Strip any "NO" suffix left over from a prior suspension.
    await supabase.rpc("restore_user_access", {
      user_email: normalizedEmail,
      user_plan: decision.plan,
    });

    // Payment is good again: restore branding, menu link removals and plan.
    const cleared = await clearDelinquency(decision.plan);
    if (cleared && (cleared as { branding_restored?: boolean }).branding_restored) {
      await supabase.from("billing_delinquency_log").insert({
        email: normalizedEmail,
        action: "restored",
        details: cleared,
      });
    }
    await purgeBrandingCacheForEmail(supabase, normalizedEmail);

    console.log(`[STRIPE-SUB-WEBHOOK] Synced ${normalizedEmail}: ${existing.plan} -> ${decision.plan}`);

    return endTracked(
      { received: true, email: normalizedEmail, new_plan: decision.plan },
      { customer: normalizedEmail, price: priceLabel, result: `synced ${existing.plan} -> ${decision.plan}` },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[STRIPE-SUB-WEBHOOK] Error:", message);
    return endTracked(
      { error: message },
      { customer: "unknown", price: "unknown", result: "handler error" },
      500,
    );
  }
}

if (Deno.env.get("STRIPE_SUB_WEBHOOK_TEST") !== "1") {
  serve(handleStripeSubscriptionWebhook);
}