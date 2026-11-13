// RevenueCat webhook: the source of truth for store subscription changes
// (initial purchase, renewal, cancellation, expiration, billing issue, refund).
//
// Configure in RevenueCat → Integrations → Webhooks:
//   URL:    https://auth.saassuite.ai/functions/v1/revenuecat-webhook
//   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  corsHeaders,
  fetchSubscriber,
  grantsFromSubscriber,
  normalizeProductId,
  STORE_PRODUCTS,
  storeLabel,
} from "../_shared/revenuecat.ts";

const log = (step: string, details?: unknown) =>
  console.log(`[RC-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const ACTIVATING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
]);
const DEACTIVATING = new Set(["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED", "TRANSFER"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const provided = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!expected || provided !== expected) {
    log("Unauthorized request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const event = body?.event ?? {};
    const type = String(event?.type ?? "UNKNOWN");
    const appUserId = String(
      event?.app_user_id ?? event?.original_app_user_id ?? "",
    ).trim().toLowerCase();
    const email = (event?.subscriber_attributes?.$email?.value ?? appUserId)
      .toString()
      .trim()
      .toLowerCase();
    const productId = normalizeProductId(event?.product_id);
    log("Event", { type, email, productId });

    if (!email || !email.includes("@")) {
      // Nothing we can attach the purchase to; ack so RevenueCat stops retrying.
      return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const secretKey = Deno.env.get("REVENUECAT_SECRET_KEY");

    // Prefer a fresh, authoritative read of every product on the subscriber.
    let grants: Array<{
      productId: string;
      entitlement: string;
      plan: "BASIC" | "ADVANCED" | null;
      premiumSupport: boolean;
      seats: number;
      expiresAt: string | null;
      store: string;
      active: boolean;
    }> = [];

    if (secretKey) {
      try {
        const subscriber = await fetchSubscriber(appUserId || email, secretKey);
        grants = grantsFromSubscriber(subscriber);
      } catch (e) {
        log("Subscriber lookup failed, falling back to event payload", { message: String(e) });
      }
    }

    if (grants.length === 0) {
      const mapped = STORE_PRODUCTS[productId];
      if (!mapped) {
        return new Response(JSON.stringify({ ok: true, skipped: "unknown_product", productId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      const expiresAt = event?.expiration_at_ms
        ? new Date(Number(event.expiration_at_ms)).toISOString()
        : null;
      const active = ACTIVATING.has(type)
        ? true
        : DEACTIVATING.has(type)
          ? false
          : Boolean(expiresAt && Date.parse(expiresAt) > Date.now());
      grants = [
        {
          productId,
          entitlement: mapped.entitlement,
          plan: mapped.plan,
          premiumSupport: mapped.premiumSupport,
          seats: mapped.seats ?? 0,
          expiresAt,
          store: storeLabel(event?.store),
          active,
        },
      ];
    }

    for (const grant of grants) {
      const { error } = await admin.rpc("apply_store_subscription", {
        p_email: email,
        p_store: grant.store,
        p_product_id: grant.productId,
        p_entitlement: grant.entitlement,
        p_plan: grant.plan,
        p_premium: grant.premiumSupport,
        p_active: grant.active,
        p_expires: grant.expiresAt,
        p_app_user_id: appUserId || email,
        p_event: type,
        p_raw: event,
      });
      if (error) log("apply_store_subscription failed", { product: grant.productId, error: error.message });
    }

    const seatGrant = grants.find((g) => g.productId === "ss_agency_seat_monthly");
    if (seatGrant) {
      const { error: seatError } = await admin.rpc("set_agency_support_wallet", {
        _email: email,
        _quantity: seatGrant.active ? seatGrant.seats || 1 : 0,
        _subscription_id: "store:ss_agency_seat_monthly",
      });
      if (seatError) log("set_agency_support_wallet failed", { error: seatError.message });
    }

    return new Response(JSON.stringify({ ok: true, applied: grants.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
