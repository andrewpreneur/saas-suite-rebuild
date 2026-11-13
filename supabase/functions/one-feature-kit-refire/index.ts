import { KIT_CATALOG, KIT_CUSTOMER_COPY, type KitLineId } from "../_shared/kit-catalog.ts";
import { kitBuyerEmail, type KitCheckoutSession } from "../_shared/kit-entitlements.ts";
import { kitBuyerSignInUrl } from "../_shared/kit-login.ts";
import {
  deliverLynkificKitPurchase,
  kitGhlPostResult,
  kitGhlReceipt,
  kitLoginLogStatus,
  kitLynkificActionKey,
  kitPromotionCode,
  kitPurchasedPayload,
  kitPurchasedSamplePayload,
  kitPurchasedUrlProblem,
  kitPurchasedWebhookUrl,
  runLynkificDelivery,
} from "../_shared/kit-lynkific.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { logKitPurchasedSend } from "../_shared/kit-purchased-log.ts";
import { kitCheckoutMetaPurchase, kitMetaActionKey, kitMetaUserData, kitUtmFields, runMetaPurchaseDelivery } from "../_shared/kit-meta.ts";
import { kitDb, kitStripe, markKitLoginCompleted, sendKitBuyerLogin, verifiedKitSession } from "../_shared/kit-payment.ts";
import { kitPurchaseRoute, sendKitRoutedPurchase } from "../_shared/kit-purchase-send.ts";
import { isServiceRoleRequest } from "../_shared/meta-capi-policy.ts";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/**
 * Service-role only. mode "sample" posts a fake kit_purchased for one email and
 * does not call Stripe or write a user. A checkout_session_id re-posts GoHighLevel
 * and the Purchase event once; completed claims are not sent again.
 * skip_meta: true posts GoHighLevel and does not claim or send Purchase.
 * Kiro's Purchase already reached Meta (event_id order_cs_live_b1dVr08q5famku5s8Rx2yx7iUDa1RZVTrYsBOp2sirYgy5H8N6Xmn1NIPa)
 * and there is no meta: claim row, so a replay without skip_meta would POST again.
 * Meta dedupes that same event_id. Example session: cs_live_b1dVr08q5famku5s8Rx2yx7iUDa1RZVTrYsBOp2sirYgy5H8N6Xmn1NIPa
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!isServiceRoleRequest({
    authorization: req.headers.get("authorization"),
    apikey: req.headers.get("apikey"),
    serviceRoleKey: serviceKey,
  })) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const url = kitPurchasedWebhookUrl(
    Deno.env.get("GHL_KIT_PURCHASED_WEBHOOK_URL"),
    Deno.env.get("LYNKIFIC_KIT_WEBHOOK_URL"),
  );
  if (body.mode === "sample" || body.sample === true) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@") || email.length > 320) return json({ error: "email is required" }, 400);
    const payload = kitPurchasedSamplePayload(email);
    const sampleReceipt = kitGhlReceipt();
    const posted = await deliverLynkificKitPurchase(payload, url, async (target, raw, signal) => {
      const res = await fetch(target, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw, signal });
      return kitGhlPostResult(res.status, await res.text());
    }, 8000, sampleReceipt);
    await logKitPurchasedSend({
      email,
      checkoutSessionId: payload.checkout_session_id,
      source: "manual_refire",
      outcome: posted,
      reason: posted === "missing_url" ? kitPurchasedUrlProblem(payload) : null,
      httpStatus: sampleReceipt.httpStatus,
      responseId: sampleReceipt.responseId,
    });
    return json({ ok: posted === "sent", posted, payload });
  }

  const checkoutId = String(body.checkout_session_id ?? "");
  if (!/^cs_live_[A-Za-z0-9]+$/.test(checkoutId)) return json({ error: "checkout_session_id is required" }, 400);
  const stripe = kitStripe();
  const verified = await verifiedKitSession(stripe, checkoutId);
  const checkout = verified.session as KitCheckoutSession & { created?: number; currency?: string | null };
  const email = kitBuyerEmail(checkout);
  const login = await sendKitBuyerLogin(stripe, checkoutId).catch(() => ({
    actionLink: null as string | null,
    signInUrl: kitBuyerSignInUrl(email),
  }));
  const purchasedAt = typeof checkout.created === "number"
    ? new Date(checkout.created * 1000).toISOString()
    : new Date().toISOString();
  const db = kitDb();
  const key = kitLynkificActionKey(checkoutId);
  const { data: claimed, error: claimError } = await db.rpc("claim_one_feature_kit_action", { p_key: key });
  if (claimError) return json({ ok: false, ghl: "claim-failed" }, 500);
  let completed = false;
  if (claimed !== true) {
    const { data: prior } = await db.from("one_feature_kit_actions").select("completed").eq("action_key", key).maybeSingle();
    completed = prior?.completed === true;
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
    checkoutSessionId: checkoutId,
    loginUrl: login.signInUrl || kitBuyerSignInUrl(email),
    magicLink: login.actionLink,
    paymentIntentId: verified.paymentIntentId,
    currency: checkout.currency,
    purchasedAt,
    fbclid: checkout.metadata?.fbclid,
    utm_term: checkout.metadata?.utm_term,
    ...kitUtmFields(checkout.metadata),
  });
  const ghl = await runLynkificDelivery({
    claimed: claimed === true,
    completed,
    receipt: ghlReceipt,
    payload: purchasedPayload,
    url,
    post: async (target, raw, signal) => {
      const res = await fetch(target, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw, signal });
      return kitGhlPostResult(res.status, await res.text());
    },
    release: async () => {
      await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", key);
    },
    complete: async () => {
      await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", key);
    },
  });
  await markKitLoginCompleted(db, checkoutId, ghl).catch((error) => {
    console.error("kit login complete", error instanceof Error ? error.message : "unknown");
  });
  await logKitPurchasedSend({
    email,
    checkoutSessionId: checkoutId,
    source: "manual_refire",
    outcome: ghl,
    reason: ghl === "missing_url" ? kitPurchasedUrlProblem(purchasedPayload) : null,
    httpStatus: ghlReceipt.httpStatus,
    responseId: ghlReceipt.responseId,
  });
  const loginStatus = kitLoginLogStatus(ghl);
  if (loginStatus) {
    await logCustomerMessage({
      userEmail: email,
      channel: "webhook",
      templateKey: "kit_login",
      provider: "ghl",
      status: loginStatus,
      source: "one-feature-kit-refire",
      detail: loginStatus,
    });
  }
  const checkoutMeta = (checkout.metadata ?? {}) as Record<string, string>;
  const user = kitMetaUserData({
    ...checkoutMeta,
    email: checkout.customer_details?.email || checkoutMeta.email || "",
    phone: checkout.customer_details?.phone || checkoutMeta.phone || "",
    name: checkoutMeta.name || checkout.customer_details?.name || "",
  });
  const lines = verified.ids.map((id: KitLineId) => ({ id, amountCents: KIT_CATALOG[id].amount, name: KIT_CUSTOMER_COPY[id].name }));
  const purchase = kitCheckoutMetaPurchase({
    sessionId: checkoutId,
    amountTotalCents: checkout.amount_total ?? null,
    comped: verified.comped,
    trackingOptout: user.trackingOptout,
    lines,
  });
  const skipMeta = body.skip_meta === true || body.skip_meta === "true";
  let purchaseResult = "skipped";
  const purchaseRoute = purchase ? kitPurchaseRoute(user) : null;
  if (!skipMeta && purchase && purchaseRoute && purchaseRoute.route !== "skip") {
    const metaKey = kitMetaActionKey(purchase.orderId);
    const { data: metaClaimed } = await db.rpc("claim_one_feature_kit_action", { p_key: metaKey });
    let metaCompleted = false;
    if (metaClaimed !== true) {
      const { data: priorMeta } = await db.from("one_feature_kit_actions").select("completed").eq("action_key", metaKey).maybeSingle();
      metaCompleted = priorMeta?.completed === true;
    }
    const route = purchaseRoute;
    purchaseResult = await runMetaPurchaseDelivery({
      claimed: metaClaimed === true,
      completed: metaCompleted,
      purchase,
      send: () => sendKitRoutedPurchase({ route, purchase, user, externalId: verified.customerId }),
      release: async () => {
        await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", metaKey);
      },
      complete: async () => {
        await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", metaKey);
      },
    });
  }
  return json({ ok: true, ghl, purchase: purchaseResult, skip_meta: skipMeta });
});
