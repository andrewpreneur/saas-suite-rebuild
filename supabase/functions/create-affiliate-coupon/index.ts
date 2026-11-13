import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.24.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  affiliateSlug: z.string().min(1),
  affiliateName: z.string().min(1),
  testMode: z.boolean().optional().default(false),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { affiliateSlug, affiliateName, testMode } = parsed.data;

    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error("Stripe secret key is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create a 10% off coupon (or reuse existing one)
    const couponId = "affiliate_10_percent_off";
    let coupon;
    try {
      coupon = await stripe.coupons.retrieve(couponId);
    } catch {
      // Coupon doesn't exist, create it
      coupon = await stripe.coupons.create({
        id: couponId,
        percent_off: 10,
        duration: "forever",
        name: "Affiliate 10% Discount",
      });
    }

    // Generate a unique promotion code for this affiliate
    const promoCode = affiliateSlug.toUpperCase().replace(/[^A-Z0-9]/g, "");
    
    // Check if promo code already exists
    const existingCodes = await stripe.promotionCodes.list({
      code: promoCode,
      limit: 1,
    });

    if (existingCodes.data.length > 0) {
      console.log(`[CREATE-AFFILIATE-COUPON] Promo code ${promoCode} already exists`);
      return new Response(JSON.stringify({
        ok: true,
        promoCode: promoCode,
        alreadyExisted: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the promotion code
    await stripe.promotionCodes.create({
      coupon: couponId,
      code: promoCode,
      metadata: {
        affiliate_slug: affiliateSlug,
        affiliate_name: affiliateName,
      },
    });

    console.log(`[CREATE-AFFILIATE-COUPON] Created promo code: ${promoCode} for affiliate: ${affiliateSlug}`);

    return new Response(JSON.stringify({
      ok: true,
      promoCode: promoCode,
      alreadyExisted: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-AFFILIATE-COUPON] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
