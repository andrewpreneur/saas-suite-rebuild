import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { label: string; monthly: number }> = {
  basic: { label: "Basic", monthly: 27 },
  advanced: { label: "Advanced", monthly: 97 },
};

const randomSuffix = () =>
  Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const plan = typeof body.plan === "string" ? body.plan.toLowerCase() : "";
    const testMode = body.testMode === true;

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!PLANS[plan]) {
      return new Response(JSON.stringify({ error: "plan must be 'basic' or 'advanced'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe secret key is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Reuse an existing, still-valid offer for this email + plan.
    const { data: existing } = await supabase
      .from("bump_offers")
      .select("promo_code, percent_off, expires_at")
      .eq("email", email)
      .eq("plan", plan)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing?.promo_code) {
      return new Response(
        JSON.stringify({
          code: existing.promo_code,
          percentOff: existing.percent_off,
          expiresAt: existing.expires_at,
          plan,
          monthly: PLANS[plan].monthly,
          discounted: Number((PLANS[plan].monthly * (1 - existing.percent_off / 100)).toFixed(2)),
          reused: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Customer (needed so the promo code can be locked to this person only).
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) customerId = customers.data[0].id;
    if (!customerId) {
      const created = await stripe.customers.create({ email });
      customerId = created.id;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const redeemBy = Math.floor(expiresAt.getTime() / 1000);

    const coupon = await stripe.coupons.create({
      percent_off: 40,
      duration: "once",
      name: `40% off first month – ${PLANS[plan].label}`,
      redeem_by: redeemBy,
      metadata: { email, plan, source: "bump_offer" },
    });

    const code = `SAVE40-${randomSuffix()}`;
    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      customer: customerId,
      expires_at: redeemBy,
      max_redemptions: 1,
      metadata: { email, plan, source: "bump_offer" },
    });

    await supabase.from("bump_offers").delete().eq("email", email).eq("plan", plan);
    await supabase.from("bump_offers").insert({
      email,
      plan,
      promo_code: promo.code,
      percent_off: 40,
      expires_at: expiresAt.toISOString(),
      redeemed: false,
    });

    console.log(`[CREATE-BUMP-OFFER] ${email} plan=${plan} code=${promo.code}`);

    return new Response(
      JSON.stringify({
        code: promo.code,
        percentOff: 40,
        expiresAt: expiresAt.toISOString(),
        plan,
        monthly: PLANS[plan].monthly,
        discounted: Number((PLANS[plan].monthly * 0.60).toFixed(2)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-BUMP-OFFER] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});