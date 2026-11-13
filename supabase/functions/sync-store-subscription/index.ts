// Verifies a signed-in user's App Store / Google Play subscriptions directly
// with RevenueCat and writes the resulting plan onto their account.
//
// The client never tells us what it bought — it only asks us to re-check. All
// entitlement data comes from the RevenueCat REST API using the secret key.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders, fetchSubscriber, grantsFromSubscriber } from "../_shared/revenuecat.ts";

const log = (step: string, details?: unknown) =>
  console.log(`[SYNC-STORE-SUB] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("REVENUECAT_SECRET_KEY");
    if (!secretKey) throw new Error("REVENUECAT_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const email = userData.user?.email?.trim().toLowerCase();
    if (!email) throw new Error("User not authenticated or email not available");
    log("Authenticated", { email });

    let subscriber: any = null;
    try {
      subscriber = await fetchSubscriber(email, secretKey);
    } catch (e) {
      log("Subscriber lookup failed", { message: String(e) });
    }

    const grants = subscriber ? grantsFromSubscriber(subscriber) : [];
    log("Grants", grants);

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
        p_app_user_id: email,
        p_event: "client_sync",
        p_raw: grant as unknown as Record<string, unknown>,
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

    const active = grants.filter((g) => g.active);

    return new Response(
      JSON.stringify({
        ok: true,
        activeProductIds: active.map((g) => g.productId),
        activeEntitlements: active.map((g) => g.entitlement),
        expiresAt: active[0]?.expiresAt ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
