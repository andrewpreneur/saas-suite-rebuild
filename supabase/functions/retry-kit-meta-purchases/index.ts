import { kitDb, kitStripe, verifiedKitSession } from "../_shared/kit-payment.ts";
import { isKitPostPurchaseId, KIT_CATALOG, KIT_CUSTOMER_COPY, type KitLineId } from "../_shared/kit-catalog.ts";
import { kitPurchaseRoute, sendKitRoutedPurchase } from "../_shared/kit-purchase-send.ts";
import {
  kitCheckoutMetaPurchase,
  kitMetaUserData,
  kitPaymentIntentKind,
  kitUpsellMetaPurchase,
  runMetaPurchaseDelivery,
  type KitMetaPurchase,
} from "../_shared/kit-meta.ts";
import { KIT_META_RETRY_MAX_ATTEMPTS, kitMetaRetryDue, kitMetaRetryOrderId, kitMetaRetryPlan } from "../_shared/kit-meta-retry.ts";
import { secretEquals } from "../_shared/meta-capi-policy.ts";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

type RetryUser = ReturnType<typeof kitMetaUserData>;

async function loadRetryPurchase(orderId: string): Promise<{ purchase: KitMetaPurchase | null; user: RetryUser; externalId: string | null }> {
  const stripe = kitStripe();
  if (orderId.startsWith("cs_")) {
    const verified = await verifiedKitSession(stripe, orderId);
    const checkout = verified.session;
    const checkoutMeta = (checkout.metadata ?? {}) as Record<string, string>;
    const user = kitMetaUserData({
      ...checkoutMeta,
      email: checkout.customer_details?.email || checkoutMeta.email || "",
      phone: checkout.customer_details?.phone || checkoutMeta.phone || "",
      name: checkoutMeta.name || checkout.customer_details?.name || "",
    });
    const lines = verified.ids.map((id: KitLineId) => ({
      id,
      amountCents: KIT_CATALOG[id].amount,
      name: KIT_CUSTOMER_COPY[id].name,
    }));
    return {
      user,
      externalId: verified.customerId,
      purchase: kitCheckoutMetaPurchase({
        sessionId: orderId,
        amountTotalCents: checkout.amount_total ?? null,
        comped: verified.comped,
        trackingOptout: user.trackingOptout,
        lines,
      }),
    };
  }
  const intent = await stripe.paymentIntents.retrieve(orderId);
  if (kitPaymentIntentKind(intent.metadata) !== "upsell") {
    return { purchase: null, user: kitMetaUserData(null), externalId: null };
  }
  const offerId = String(intent.metadata?.offer_id ?? "");
  const checkoutId = intent.metadata?.checkout_id;
  if (!checkoutId) return { purchase: null, user: kitMetaUserData(null), externalId: null };
  const verified = await verifiedKitSession(stripe, checkoutId);
  const knownOffer = isKitPostPurchaseId(offerId);
  const catalogAmount = knownOffer ? KIT_CATALOG[offerId].amount : null;
  const offerMeta = { ...(verified.session.metadata ?? {}), ...(intent.metadata ?? {}) } as Record<string, string>;
  const user = kitMetaUserData(offerMeta);
  const copy = (KIT_CUSTOMER_COPY as Record<string, { name: string } | undefined>)[offerId];
  return {
    user,
    externalId: verified.customerId,
    purchase: kitUpsellMetaPurchase({
      paymentIntentId: intent.id,
      amountReceivedCents: intent.amount_received,
      offerId,
      contentName: copy?.name,
      itemAmountCents: catalogAmount ?? intent.amount_received,
      trackingOptout: user.trackingOptout,
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const db = kitDb();
  const { data: auth, error: authError } = await db.from("kit_meta_retry_auth").select("secret").eq("id", 1).maybeSingle();
  if (authError || typeof auth?.secret !== "string" || !auth.secret) {
    console.error("kit meta retry auth unavailable", authError?.message ?? "missing");
    return json({ ok: false, skipped: "auth" });
  }
  if (!secretEquals(req.headers.get("x-webhook-secret") ?? "", auth.secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const now = Date.now();
  const { data: rows, error } = await db.from("one_feature_kit_actions")
    .select("action_key, completed, attempts, lease_until")
    .like("action_key", "meta:%")
    .eq("completed", false)
    .lt("attempts", KIT_META_RETRY_MAX_ATTEMPTS)
    .lte("lease_until", new Date(now).toISOString())
    .limit(10);
  if (error) {
    console.error("kit meta retry read", error.message);
    return json({ ok: false }, 500);
  }
  const due = (rows ?? []).filter(row => kitMetaRetryDue({
    actionKey: row.action_key,
    completed: row.completed === true,
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    leaseUntilMs: Date.parse(row.lease_until),
  }, now));
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    const orderId = kitMetaRetryOrderId(row.action_key);
    if (!orderId) continue;
    const attempts = typeof row.attempts === "number" ? row.attempts : 0;
    const { data: claimed, error: claimError } = await db.rpc("claim_one_feature_kit_action", { p_key: row.action_key });
    if (claimError || claimed !== true) continue;
    const writeBackoff = async () => {
      const plan = kitMetaRetryPlan(attempts, Date.now());
      await db.from("one_feature_kit_actions").update({
        attempts: plan.attempts,
        lease_until: new Date(plan.retryAtMs).toISOString(),
      }).eq("action_key", row.action_key);
      if (plan.exhausted) console.error("kit meta retry exhausted", orderId);
    };
    const markDone = async () => {
      await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", row.action_key);
    };
    try {
      const loaded = await loadRetryPurchase(orderId);
      const route = kitPurchaseRoute(loaded.user);
      if (route.route === "skip") {
        console.log("kit meta retry skipped test traffic", orderId);
        await markDone();
        continue;
      }
      if (!loaded.purchase) {
        await markDone();
        continue;
      }
      const purchase = loaded.purchase;
      const result = await runMetaPurchaseDelivery({
        claimed: true,
        completed: false,
        purchase,
        send: () => sendKitRoutedPurchase({
          route,
          purchase,
          user: loaded.user,
          externalId: loaded.externalId,
        }),
        release: writeBackoff,
        complete: markDone,
      });
      if (result === "skipped") await markDone();
      if (result === "sent") sent += 1;
      if (result === "failed") failed += 1;
      console.log("kit meta retry", orderId, result);
    } catch (retryError) {
      console.error("kit meta retry", orderId, retryError instanceof Error ? retryError.message : "unknown");
      await writeBackoff();
      failed += 1;
    }
  }
  return json({ ok: true, due: due.length, sent, failed });
});
