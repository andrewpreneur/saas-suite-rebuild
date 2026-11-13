import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.24.2";
import { attachKnownKitBuyer, kitDb, kitHash, kitStripe, prepareKitBuyer, requestKitNotify, validateKitPrices, verifiedKitSession } from "../_shared/kit-payment.ts";
import { KIT_CATALOG, KIT_CUSTOMER_COPY, KIT_FUNNEL, KIT_POST_PURCHASE_IDS, KIT_PROMO_INVALID, activeKitPromotionId, kitCheckoutIds, kitCheckoutPromoFields, kitPromoQuote, kitTotal } from "../_shared/kit-catalog.ts";
import { addonChargeAllowed, completedUpsellLineId, kitBuyerEmail, mergeOwnedKitLineIds, saveKitEntitlements, upsellChargeMode, upsellEntitlementRow, type KitCheckoutSession } from "../_shared/kit-entitlements.ts";
import { sendMetaEvent } from "../_shared/meta-capi.ts";
import { META_LEAD_PIXEL_ID, chargedUsd, kitInitiateCheckoutEventId, kitLeadEventId, kitStripeTrackingMetadata, kitUtmFields, kitUtmMetadata, kitUpsellEventSource, pickKitEventMetadata } from "../_shared/kit-meta.ts";
import { clientIpFromForwarded } from "../_shared/meta-capi-policy.ts";
import { ghlEmailClaims } from "../_shared/ghl-email-claim.ts";
import { queueKitCheckoutStarted } from "../_shared/kit-checkout-started.ts";
import { logCustomerMessage, recordCheckoutSession } from "../_shared/journey-log.ts";
import { isKitOfkSessionId, isSiteAnalyticsSessionId } from "../_shared/kit-events.ts";
import { requestIsTest } from "../_shared/test-traffic.ts";
const contactSchema = z.object({ firstName: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(255), phone: z.string().trim().min(7).max(30).regex(/^[+\d\s().-]+$/) });
const utmField = z.preprocess(
  (value) => (typeof value === "string" ? value : undefined),
  z.string().transform((value) => value.trim().slice(0, 200)).optional(),
);
const trackingSchema = z.object({
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(500).optional(),
  fbclid: z.string().max(500).optional(),
  utm_source: utmField,
  utm_medium: utmField,
  utm_campaign: utmField,
  utm_content: utmField,
  utm_term: z.string().max(200).optional(),
  utm_id: utmField,
  landing_page: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  page_url: z.string().max(500).optional(),
  checkout_page: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().slice(0, 500) : undefined),
    z.string().optional(),
  ),
  lead_event_id: z.string().max(80).optional(),
  tracking_optout: z.boolean().optional(),
  is_test: z.boolean().optional(),
}).optional();
const ofkSessionId = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return isKitOfkSessionId(trimmed) ? trimmed : undefined;
}, z.string().optional());
const siteSessionId = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return isSiteAnalyticsSessionId(trimmed) ? trimmed : undefined;
}, z.string().optional());
const capability = z.string().uuid();
const sessionId = z.string().regex(/^cs_live_[A-Za-z0-9]+$/).max(255);
const promotionCode = z.string().trim().min(1).max(200);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    capability,
    contact: contactSchema,
    bumps: z.object({ replay: z.boolean(), video: z.boolean(), install: z.boolean() }),
    promotionCode: promotionCode.optional(),
    tracking: trackingSchema,
    utm_source: utmField,
    utm_medium: utmField,
    utm_campaign: utmField,
    utm_content: utmField,
    ofk_session_id: ofkSessionId,
    site_session_id: siteSessionId,
  }),
  z.object({ action: z.literal("promo"), capability, promotionCode }),
  z.object({ action: z.literal("verify"), capability, sessionId }),
  z.object({ action: z.literal("upsell"), capability, sessionId, offerId: z.enum(KIT_POST_PURCHASE_IDS), page_url: z.string().max(500).optional() }),
]);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function requestClientIp(req: Request): string {
  return clientIpFromForwarded(req.headers.get("x-forwarded-for")) || clientIpFromForwarded(req.headers.get("x-real-ip")) || "";
}
/** Meta must not hold the checkout secret. Supabase keeps the task alive via waitUntil. */
function scheduleKitCheckoutMeta(work: Promise<unknown>) {
  const bounded = Promise.race([
    work,
    new Promise<void>(resolve => setTimeout(resolve, 4000)),
  ]).catch(error => {
    console.error("kit checkout meta", error instanceof Error ? error.message : "unknown");
  });
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof runtime?.waitUntil === "function") {
    runtime.waitUntil(bounded);
    return;
  }
  void bounded;
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Check your payment details and try again." }, 400);
  const input = body.data;
  try {
    const stripe = kitStripe();
    if (input.action === "promo") {
      const listed = (await stripe.promotionCodes.list({ code: input.promotionCode, active: true, limit: 1 })).data;
      const promotionCodeId = activeKitPromotionId(listed, input.promotionCode);
      const matched = listed.find((item: { id: string }) => item.id === promotionCodeId) as { coupon?: Parameters<typeof kitPromoQuote>[0] } | undefined;
      const quote = kitPromoQuote(matched?.coupon);
      return json({ ok: true, percentOff: quote.percentOff, amountOff: quote.amountOff });
    }
    if (input.action === "create") {
      const code = input.promotionCode?.trim() ?? "";
      // Reject an unknown code before creating a customer or redirecting to Stripe.
      const promotionCodeId = code
        ? activeKitPromotionId((await stripe.promotionCodes.list({ code, active: true, limit: 1 })).data, code)
        : null;
      const ids = kitCheckoutIds(input.bumps);
      await validateKitPrices(stripe, ids);
      const capabilityHash = await kitHash(input.capability);
      const fingerprint = await kitHash(JSON.stringify({ contact: input.contact, ids, promotionCodeId }));
      const key = `kit:${capabilityHash}:${fingerprint}`;
      // Guest customer is isolated to this checkout; never reuse someone else's customer by email.
      const customer = await stripe.customers.create({ name: input.contact.firstName, email: input.contact.email, phone: input.contact.phone, metadata: { funnel: KIT_FUNNEL } }, { idempotencyKey: `${key}:customer` });
      const utms = kitUtmFields({
        utm_source: input.utm_source ?? input.tracking?.utm_source,
        utm_medium: input.utm_medium ?? input.tracking?.utm_medium,
        utm_campaign: input.utm_campaign ?? input.tracking?.utm_campaign,
        utm_content: input.utm_content ?? input.tracking?.utm_content,
      });
      const isTest = requestIsTest({ body: input, cookieHeader: req.headers.get("cookie") });
      const trackingMeta = kitStripeTrackingMetadata({
        tracking: { ...input.tracking, is_test: isTest },
        clientIp: requestClientIp(req),
        clientUa: req.headers.get("user-agent"),
      });
      // Empty UTM strings stay off the session. Stripe treats an empty metadata value as an error.
      const metadata = { funnel: KIT_FUNNEL, capability_hash: capabilityHash, name: input.contact.firstName, email: input.contact.email, phone: input.contact.phone, line_ids: ids.join(","), ...trackingMeta, ...kitUtmMetadata(utms), ...(input.ofk_session_id ? { ofk_session_id: input.ofk_session_id } : {}), ...(input.site_session_id ? { site_session_id: input.site_session_id } : {}) };
      // These prices are one-time. Stripe rejects a collection flag here unless a price is recurring.
      // setup_future_usage still saves the card, including on a $0 promotion.
      // checkout3 is the embedded session. checkout2 would replay the old hosted session.
      const session = await stripe.checkout.sessions.create({
        mode: "payment", ui_mode: "embedded", customer: customer.id, payment_method_types: ["card"],
        ...kitCheckoutPromoFields(promotionCodeId),
        line_items: ids.map(id => ({ price: KIT_CATALOG[id].price, quantity: 1 })), metadata,
        payment_intent_data: { setup_future_usage: "off_session", metadata },
        return_url: "https://saassuite.ai/one-feature-kit/ghl-signup-and-upgrade?session_id={CHECKOUT_SESSION_ID}",
        redirect_on_completion: "always",
      }, { idempotencyKey: `${key}:checkout3` });
      if (!session.client_secret || !session.id) throw new Error("Secure checkout is unavailable");
      await recordCheckoutSession({
        stripeCheckoutSessionId: session.id,
        email: input.contact.email,
        plan: "one_feature_kit",
        billingInterval: "one_time",
        flow: "one_feature_kit",
        surface: "one-feature-kit checkout",
        page: trackingMeta.page_url || "/one-feature-kit/checkout",
        button: "Checkout",
        amountCents: kitTotal(ids),
        currency: "usd",
        status: "open",
        isTest,
      });
      // GoHighLevel follow-up if they leave without paying. The POST must not fail checkout.
      const checkoutStarted = queueKitCheckoutStarted({
        livemode: session.livemode === true,
        email: input.contact.email,
        phone: input.contact.phone,
        name: input.contact.firstName,
        lineIds: ids,
        amountCentsTotal: kitTotal(ids),
        promotionCode: code || null,
        checkoutSessionId: session.id,
        startedAt: new Date().toISOString(),
        webhookUrl: Deno.env.get("KIT_CHECKOUT_STARTED_WEBHOOK_URL"),
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        isTest,
      }, {
        claims: ghlEmailClaims(kitDb()),
        onResult: (result) => logCustomerMessage({
          userEmail: input.contact.email,
          channel: "webhook",
          templateKey: "kit_checkout_started",
          provider: "ghl",
          status: result === "sent" ? "sent" : result === "failed" || result === "uncertain" || result === "missing_url" ? "failed" : "suppressed",
          source: "one-feature-kit-payment",
          detail: result === "missing_url" ? "missing_checkout_url" : result,
          metadata: { claim_key: `checkout_started:${session.id}` },
        }),
      }).catch(error => {
        console.error("kit checkout started", error instanceof Error ? error.message : "unknown");
      });
      const leadEventId = kitLeadEventId(capabilityHash);
      const initiateCheckoutEventId = kitInitiateCheckoutEventId(session.id);
      if (trackingMeta.tracking_optout !== "true") {
        const source = trackingMeta.page_url || "https://saassuite.ai/one-feature-kit/checkout";
        const contents = ids.map(id => ({ id, quantity: 1, item_price: chargedUsd(KIT_CATALOG[id].amount) }));
        scheduleKitCheckoutMeta(Promise.all([
          sendMetaEvent({
            event_name: "Lead", event_id: leadEventId, email: input.contact.email, phone: input.contact.phone,
            first_name: input.contact.firstName, fbp: trackingMeta.fbp, fbc: trackingMeta.fbc, fbclid: trackingMeta.fbclid,
            event_source_url: source, external_id: customer.id, client_ip: trackingMeta.client_ip, client_user_agent: trackingMeta.client_ua,
            pixel_ids: [META_LEAD_PIXEL_ID], is_test: isTest,
          }),
          sendMetaEvent({
            event_name: "InitiateCheckout", event_id: initiateCheckoutEventId, email: input.contact.email, phone: input.contact.phone,
            first_name: input.contact.firstName, value: chargedUsd(kitTotal(ids)), currency: "USD",
            fbp: trackingMeta.fbp, fbc: trackingMeta.fbc, fbclid: trackingMeta.fbclid, event_source_url: source,
            external_id: customer.id, client_ip: trackingMeta.client_ip, client_user_agent: trackingMeta.client_ua,
            content_ids: [...ids], contents, content_type: "product", content_name: KIT_CUSTOMER_COPY.kit.name,
            num_items: ids.length, order_id: session.id, is_test: isTest,
          }),
        ]));
      }
      await checkoutStarted;
      return json({ clientSecret: session.client_secret, sessionId: session.id, leadEventId, initiateCheckoutEventId });
    }
    const verified = await verifiedKitSession(stripe, input.sessionId, input.capability);
    if (input.action === "verify") {
      // Confirm the payment and prepare the account. Do not mint a link or send email.
      // GoHighLevel sends login_url from the Stripe webhook, and kit-login is completed on that 2xx.
      try {
        const email = kitBuyerEmail(verified.session as KitCheckoutSession);
        const name = verified.session.customer_details?.name || verified.session.metadata?.name || "";
        const created = (verified.session as KitCheckoutSession & { created?: number }).created;
        const purchasedAt = typeof created === "number" ? new Date(created * 1000).toISOString() : null;
        await prepareKitBuyer(kitDb(), email, name, verified.session.metadata, purchasedAt);
      } catch (error) {
        console.error("kit buyer", error instanceof Error ? error.message : "unknown");
      }
      await requestKitNotify(input.sessionId).catch(() => console.warn("Kit notification deferred to webhook retry"));
      let extras: string[] = [];
      try {
        const readDb = kitDb();
        const { data: purchases } = await readDb.from("kit_purchases").select("line_id").eq("checkout_session_id", input.sessionId);
        const { data: actions } = await readDb.from("one_feature_kit_actions").select("action_key, completed").like("action_key", `upsell:${input.sessionId}:%`);
        extras = [
          ...(purchases ?? []).map((row: { line_id?: string }) => row.line_id ?? ""),
          ...(actions ?? []).flatMap((row: { action_key?: string; completed?: boolean }) => (
            row.completed ? [completedUpsellLineId(row.action_key ?? "", input.sessionId) ?? ""] : []
          )),
        ];
      } catch (error) {
        console.error("kit line ids", error instanceof Error ? error.message : "unknown");
      }
      const lineIds = mergeOwnedKitLineIds(verified.ids, extras);
      return json({ checkoutId: input.sessionId, customerId: verified.customerId, paymentMethodId: verified.paymentMethodId, comped: verified.comped,
        amountTotal: typeof verified.session.amount_total === "number" ? verified.session.amount_total / 100 : 0, contentIds: verified.ids, lineIds,
        contact: { firstName: verified.session.metadata?.name ?? "", email: verified.session.metadata?.email ?? "", phone: verified.session.metadata?.phone ?? "" },
        bumps: { replay: verified.ids.includes("bump-replay"), video: verified.ids.includes("bump-video"), install: verified.ids.includes("bump-install") } });
    }
    const db = kitDb();
    const { data: purchases, error: purchaseReadError } = await db.from("kit_purchases").select("line_id").eq("checkout_session_id", input.sessionId);
    if (purchaseReadError) throw new Error("Payment storage unavailable");
    const owned = mergeOwnedKitLineIds(verified.ids, (purchases ?? []).map((row: { line_id?: string }) => row.line_id ?? ""));
    if (!addonChargeAllowed(owned, input.offerId)) return json({ paid: true, alreadyOwned: true });
    await validateKitPrices(stripe, [input.offerId]);
    const actionKey = `upsell:${input.sessionId}:${input.offerId}`;
    const { data: claimed, error: claimError } = await db.rpc("claim_one_feature_kit_action", { p_key: actionKey });
    if (claimError) throw new Error("Payment storage unavailable");
    if (!claimed) {
      const { data: prior } = await db.from("one_feature_kit_actions").select("completed,stripe_id").eq("action_key", actionKey).single();
      if (prior?.completed && !prior.stripe_id) return json({ paid: true, comped: true });
      if (prior?.completed && prior.stripe_id) {
        const payment = await stripe.paymentIntents.retrieve(prior.stripe_id);
        if (payment.status === "succeeded") return json({ paid: true, paymentIntentId: payment.id });
      }
      return json({ error: "This add-on is processing. Please wait before trying again." }, 409);
    }
    try {
      if (upsellChargeMode(verified) === "comped") {
        await saveKitEntitlements(db, [upsellEntitlementRow(verified.session as KitCheckoutSession, input.sessionId, input.offerId, null, true)]);
        await attachKnownKitBuyer(db, kitBuyerEmail(verified.session as KitCheckoutSession));
        const { error: doneError } = await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", actionKey);
        if (doneError) throw new Error("Payment confirmation unavailable");
        await requestKitNotify(input.sessionId, input.offerId).catch(() => console.warn("Kit add-on notification deferred to webhook retry"));
        return json({ paid: true, comped: true });
      }
      const paymentMethodId = verified.paymentMethodId;
      if (!paymentMethodId) throw new Error("Saved card is unavailable");
      const item = KIT_CATALOG[input.offerId];
      // Permanent action record survives Stripe's 24-hour idempotency window.
      const { data: prior, error: readError } = await db.from("one_feature_kit_actions").select("stripe_id,created_at").eq("action_key", actionKey).single();
      if (readError || !prior) throw new Error("Payment storage unavailable");
      // An unrecorded intent might exist after an interrupted Stripe response. Never
      // recreate it after Stripe expires its idempotency key; fail closed for review.
      if (!prior.stripe_id && Date.now() - Date.parse(prior.created_at) > 23 * 60 * 60 * 1000) throw new Error("Payment needs review");
      let payment = prior?.stripe_id ? await stripe.paymentIntents.retrieve(prior.stripe_id) : await stripe.paymentIntents.create({
        amount: item.amount, currency: "usd", customer: verified.customerId, payment_method: paymentMethodId,
        payment_method_types: ["card"], description: `${KIT_CUSTOMER_COPY[input.offerId].name}. ${KIT_CUSTOMER_COPY[input.offerId].description}`,
        metadata: { funnel: KIT_FUNNEL, checkout_id: input.sessionId, offer_id: input.offerId, price_id: item.price, ...pickKitEventMetadata(verified.session.metadata), page_url: kitUpsellEventSource(input.offerId, input.page_url) },
      }, { idempotencyKey: actionKey });
      const { error: saveError } = await db.from("one_feature_kit_actions").update({ stripe_id: payment.id }).eq("action_key", actionKey);
      if (saveError) throw new Error("Payment storage unavailable");
      if (payment.status !== "succeeded") payment = await stripe.paymentIntents.confirm(payment.id, { off_session: true, payment_method: paymentMethodId }, { idempotencyKey: `${actionKey}:confirm` });
      if (payment.status !== "succeeded") throw new Error("Card was not charged successfully");
      await saveKitEntitlements(db, [upsellEntitlementRow(verified.session as KitCheckoutSession, input.sessionId, input.offerId, payment.id, false)]);
      await attachKnownKitBuyer(db, kitBuyerEmail(verified.session as KitCheckoutSession));
      const { error: doneError } = await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", actionKey);
      if (doneError) throw new Error("Payment confirmation unavailable");
      await requestKitNotify(input.sessionId, input.offerId, payment.id).catch(() => console.warn("Kit add-on notification deferred to webhook retry"));
      return json({ paid: true, paymentIntentId: payment.id });
    } catch (error) {
      await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", actionKey);
      throw error;
    }
  } catch (error) {
    console.error("one-feature-kit-payment failed", input.action, error instanceof Error ? error.message : "unknown");
    if ((input.action === "create" || input.action === "promo") && error instanceof Error && error.message === KIT_PROMO_INVALID) {
      return json({ error: KIT_PROMO_INVALID }, 400);
    }
    return json({ error: input.action === "upsell" ? "We couldn't charge your saved card. Nothing was added. Please try again or choose No thanks." : input.action === "verify" ? "Payment isn't confirmed. Return to checkout and try again." : input.action === "promo" ? "We couldn't check that code. Please try again." : "We couldn't open secure checkout. Please try again." }, 400);
  }
});
