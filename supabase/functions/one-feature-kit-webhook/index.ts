import { attachKnownKitBuyer, kitDb, kitPaymentIsTest, kitStripe, markKitLoginCompleted, requestKitNotify, sendKitBuyerLogin, verifiedKitSession } from "../_shared/kit-payment.ts";
import { isKitPostPurchaseId, KIT_CATALOG, KIT_CUSTOMER_COPY, KIT_FUNNEL, type KitLineId } from "../_shared/kit-catalog.ts";
import { checkoutEntitlementRows, kitBuyerEmail, saveKitEntitlements, upsellEntitlementRow, type KitCheckoutSession } from "../_shared/kit-entitlements.ts";
import { fulfillKitCheckout, kitBuyerSignInUrl } from "../_shared/kit-login.ts";
import { linkSiteAnalyticsEmail } from "../_shared/kit-site-link.ts";
import { kitGhlPostResult, kitGhlReceipt, kitLoginLogStatus, kitLynkificActionKey, kitPromotionCode, kitPurchasedPayload, kitPurchasedUrlProblem, kitPurchasedWebhookUrl, runLynkificDelivery } from "../_shared/kit-lynkific.ts";
import { logKitPurchasedSend } from "../_shared/kit-purchased-log.ts";
import { logCustomerMessage, recordCheckoutSession } from "../_shared/journey-log.ts";
import { kitPurchaseRoute, sendKitRoutedPurchase } from "../_shared/kit-purchase-send.ts";
import { kitCheckoutMetaPurchase, kitMetaActionKey, kitMetaUserData, kitPaymentIntentKind, kitUpsellMetaPurchase, kitUtmFields, runMetaPurchaseDelivery, type KitMetaPurchase } from "../_shared/kit-meta.ts";
import { insertKitPurchaseEvents } from "../_shared/kit-events.ts";

async function emitKitPurchase(purchase: KitMetaPurchase | null, user: ReturnType<typeof kitMetaUserData>, externalId: string | null) {
  if (!purchase) return;
  const route = kitPurchaseRoute(user);
  if (route.route === "skip") {
    console.log("kit meta purchase skipped test traffic", purchase.orderId);
    return;
  }
  try {
    const db = kitDb();
    const key = kitMetaActionKey(purchase.orderId);
    const { data, error } = await db.rpc("claim_one_feature_kit_action", { p_key: key });
    if (error) {
      console.error("kit meta purchase", "claim failed", purchase.orderId);
      return;
    }
    const claimed = data === true;
    let completed = false;
    if (!claimed) {
      const { data: prior } = await db.from("one_feature_kit_actions").select("completed").eq("action_key", key).maybeSingle();
      completed = prior?.completed === true;
    }
    const result = await runMetaPurchaseDelivery({
      claimed,
      completed,
      purchase,
      send: () => sendKitRoutedPurchase({ route, purchase, user, externalId }),
      release: async () => {
        await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", key);
      },
      complete: async () => {
        const { error: doneError } = await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", key);
        if (doneError) throw new Error("Meta purchase completion failed");
      },
    });
    if (result === "failed" || result === "busy") console.error("kit meta purchase", result, purchase.orderId);
  } catch (error) {
    console.error("kit meta purchase", error instanceof Error ? error.message : "unknown");
  }
}
Deno.serve(async req => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("KIT_STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Kit webhook is not configured", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const stripe = kitStripe();
  let event;
  try { event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret); }
  catch { return new Response("Invalid signature", { status: 400 }); }
  try {
    if (!event.livemode) return new Response("Ignored");
    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      if (session.metadata?.funnel !== KIT_FUNNEL) return new Response("Ignored");
      await recordCheckoutSession({
        stripeCheckoutSessionId: session.id,
        email: session.customer_details?.email || session.metadata?.email || null,
        plan: "one_feature_kit",
        billingInterval: "one_time",
        flow: "one_feature_kit",
        amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
        currency: session.currency,
        status: "expired",
        isTest: kitPaymentIsTest(session.metadata),
      });
      return new Response("ok");
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.funnel !== KIT_FUNNEL) return new Response("Ignored");
      const verified = await verifiedKitSession(stripe, session.id);
      await recordCheckoutSession({
        stripeCheckoutSessionId: session.id,
        email: kitBuyerEmail(verified.session as KitCheckoutSession),
        plan: "one_feature_kit",
        billingInterval: "one_time",
        flow: "one_feature_kit",
        amountCents: typeof verified.session.amount_total === "number" ? verified.session.amount_total : null,
        currency: verified.session.currency || "usd",
        status: "completed",
        isTest: kitPaymentIsTest(verified.session.metadata),
      });
      const checkout = verified.session as KitCheckoutSession & { created?: number };
      const entitlementRows = checkoutEntitlementRows(checkout, session.id);
      await saveKitEntitlements(kitDb(), entitlementRows);
      await insertKitPurchaseEvents(kitDb(), {
        lines: entitlementRows.map((row) => ({ line_id: row.line_id, amount_cents: row.amount_cents })),
        checkoutSessionId: session.id,
        ofkSessionId: checkout.metadata?.ofk_session_id ?? null,
        source: "checkout",
        metadata: checkout.metadata,
      });
      const email = kitBuyerEmail(checkout);
      try {
        await linkSiteAnalyticsEmail(kitDb(), checkout.metadata?.site_session_id, email);
      } catch (error) {
        console.error("kit site session", error instanceof Error ? error.message : "unknown");
      }
      // GoHighLevel sends the login email. A login error still posts the durable signup URL.
      const login = await sendKitBuyerLogin(stripe, session.id).catch((error) => {
        console.error("kit login", error instanceof Error ? error.message : "unknown");
        return { actionLink: null as string | null, signInUrl: kitBuyerSignInUrl(email) };
      });
      const purchasedAt = typeof checkout.created === "number"
        ? new Date(checkout.created * 1000).toISOString()
        : new Date().toISOString();
      const loginUrl = login.signInUrl || kitBuyerSignInUrl(email);
      // GoHighLevel hears about the recorded checkout. The magic link is optional.
      // One claim per checkout, so a Stripe retry or an overlapping delivery does not POST twice.
      // Test checkouts stay in our tables and do not enter GoHighLevel.
      await fulfillKitCheckout({
        onLynkificError: (error) => console.error("lynkific kit webhook", error instanceof Error ? error.message : "unknown"),
        onNotifyError: (error) => console.error("kit notify", error instanceof Error ? error.message : "unknown"),
        onPurchaseError: (error) => console.error("kit meta purchase", error instanceof Error ? error.message : "unknown"),
        deliverLynkific: async () => {
          if (kitPaymentIsTest(checkout.metadata)) {
            console.log("lynkific kit webhook skipped test traffic", session.id);
            await logCustomerMessage({
              userEmail: email,
              channel: "webhook",
              templateKey: "kit_purchased",
              provider: "ghl",
              status: "suppressed",
              source: "one-feature-kit-webhook",
              detail: "test_traffic",
            });
            return;
          }
          const lynkificDb = kitDb();
          const lynkificKey = kitLynkificActionKey(session.id);
          const { data: lynkificClaimed, error: lynkificClaimError } = await lynkificDb.rpc("claim_one_feature_kit_action", { p_key: lynkificKey });
          if (lynkificClaimError) {
            console.error("lynkific kit claim failed", session.id);
            return;
          }
          let lynkificCompleted = false;
          if (lynkificClaimed !== true) {
            const { data: priorLynkific } = await lynkificDb.from("one_feature_kit_actions").select("completed").eq("action_key", lynkificKey).maybeSingle();
            lynkificCompleted = priorLynkific?.completed === true;
          }
          const ghlReceipt = kitGhlReceipt();
          const purchasedPayload = kitPurchasedPayload({
            email,
            phone: checkout.customer_details?.phone || checkout.metadata?.phone || "",
            name: checkout.customer_details?.name || checkout.metadata?.name || "",
            lineIds: verified.ids,
            amountCentsTotal: checkout.amount_total ?? 0,
            comped: verified.comped,
            promotionCode: kitPromotionCode(checkout.discounts),
            checkoutSessionId: session.id,
            loginUrl,
            magicLink: login.actionLink,
            paymentIntentId: verified.paymentIntentId,
            currency: checkout.currency,
            purchasedAt,
            fbclid: checkout.metadata?.fbclid,
            utm_term: checkout.metadata?.utm_term,
            ...kitUtmFields(checkout.metadata),
          });
          const lynkific = await runLynkificDelivery({
            claimed: lynkificClaimed === true,
            completed: lynkificCompleted,
            receipt: ghlReceipt,
            payload: purchasedPayload,
            url: kitPurchasedWebhookUrl(Deno.env.get("GHL_KIT_PURCHASED_WEBHOOK_URL"), Deno.env.get("LYNKIFIC_KIT_WEBHOOK_URL")),
            post: async (url, body, signal) => {
              const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
              return kitGhlPostResult(res.status, await res.text());
            },
            release: async () => {
              await lynkificDb.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", lynkificKey);
            },
            complete: async () => {
              await lynkificDb.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", lynkificKey);
            },
          });
          if (lynkific === "failed") console.error("lynkific kit webhook failed");
          if (lynkific === "overlap") console.error("lynkific kit webhook already in progress", session.id);
          await markKitLoginCompleted(lynkificDb, session.id, lynkific).catch((error) => {
            console.error("kit login complete", error instanceof Error ? error.message : "unknown");
          });
          await logKitPurchasedSend({
            email,
            checkoutSessionId: session.id,
            source: "webhook",
            outcome: lynkific,
            reason: lynkific === "missing_url" ? kitPurchasedUrlProblem(purchasedPayload) : null,
            httpStatus: ghlReceipt.httpStatus,
            responseId: ghlReceipt.responseId,
          });
          const loginStatus = kitLoginLogStatus(lynkific);
          if (loginStatus) {
            await logCustomerMessage({
              userEmail: email,
              channel: "webhook",
              templateKey: "kit_login",
              provider: "ghl",
              status: loginStatus,
              source: "one-feature-kit-webhook",
              detail: loginStatus === "sent" ? "kit_purchased" : "kit_purchased_failed",
            });
          }
        },
        notify: () => requestKitNotify(session.id),
        emitPurchase: async () => {
          const checkoutMeta = (verified.session.metadata ?? {}) as Record<string, string>;
          const checkoutUser = kitMetaUserData({
            ...checkoutMeta,
            email: checkout.customer_details?.email || checkoutMeta.email || "",
            phone: checkout.customer_details?.phone || checkoutMeta.phone || "",
            name: checkoutMeta.name || checkout.customer_details?.name || "",
          });
          const checkoutLines = verified.ids.map((id: KitLineId) => ({ id, amountCents: KIT_CATALOG[id].amount, name: KIT_CUSTOMER_COPY[id].name }));
          await emitKitPurchase(kitCheckoutMetaPurchase({
            sessionId: session.id,
            amountTotalCents: verified.session.amount_total ?? null,
            comped: verified.comped,
            trackingOptout: checkoutUser.trackingOptout,
            lines: checkoutLines,
          }), checkoutUser, verified.customerId);
        },
      });
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      if (kitPaymentIntentKind(intent.metadata) !== "upsell") return new Response("Ignored");
      const offerId = String(intent.metadata?.offer_id ?? "");
      const knownOffer = isKitPostPurchaseId(offerId);
      if (!knownOffer) console.error("kit webhook unknown offer", JSON.stringify({ offerId, paymentIntentId: intent.id, amountReceived: intent.amount_received }));
      const catalogAmount = knownOffer ? KIT_CATALOG[offerId].amount : null;
      if (!intent.livemode || intent.status !== "succeeded" || intent.currency !== "usd") throw new Error("Add-on payment has not been confirmed");
      if (knownOffer && intent.amount_received !== catalogAmount) throw new Error("Add-on payment has not been confirmed");
      const checkoutId = intent.metadata.checkout_id;
      if (!checkoutId) throw new Error("Add-on payment has not been confirmed");
      const verified = await verifiedKitSession(stripe, checkoutId);
      const db = kitDb();
      if (knownOffer) {
        const entitlementRow = upsellEntitlementRow(verified.session as KitCheckoutSession, checkoutId, offerId, intent.id, false);
        await saveKitEntitlements(db, [entitlementRow]);
        await insertKitPurchaseEvents(db, {
          lines: [{ line_id: entitlementRow.line_id, amount_cents: entitlementRow.amount_cents }],
          checkoutSessionId: checkoutId,
          ofkSessionId: verified.session.metadata?.ofk_session_id ?? intent.metadata?.ofk_session_id ?? null,
          source: "upsell",
          metadata: { ...(verified.session.metadata ?? {}), ...(intent.metadata ?? {}) },
        });
        await attachKnownKitBuyer(db, (verified.session.customer_details?.email || verified.session.metadata?.email || "").trim().toLowerCase());
        // Notification endpoint independently retrieves and validates this intent and amount.
        await requestKitNotify(checkoutId, offerId, intent.id);
      }
      const offerMeta = { ...(verified.session.metadata ?? {}), ...(intent.metadata ?? {}) } as Record<string, string>;
      const offerUser = kitMetaUserData(offerMeta);
      const copy = (KIT_CUSTOMER_COPY as Record<string, { name: string } | undefined>)[offerId];
      await emitKitPurchase(kitUpsellMetaPurchase({
        paymentIntentId: intent.id,
        amountReceivedCents: intent.amount_received,
        offerId,
        contentName: copy?.name,
        itemAmountCents: catalogAmount ?? intent.amount_received,
        trackingOptout: offerUser.trackingOptout,
      }), offerUser, verified.customerId);
    }
    return new Response("ok");
  } catch (error) {
    console.error("kit webhook", error instanceof Error ? error.message : "unknown");
    return new Response("Purchase processing needs retry", { status: 500 });
  }
});
