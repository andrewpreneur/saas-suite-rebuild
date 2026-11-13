import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { trialError, WEBINAR_TRIAL_SOURCE, trialDaysFor } from "./trial-policy.ts";
import { billingIntervalForPlan, recordCheckoutSession } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LIVE_PRICE_IDS: Record<string, string> = {
  basic: "price_1Se8YfGdZ9PRE3Zi2GWbiNel",
  basic_annual: "price_1UJ0C2GdZ9PRE3ZiObuEAWzF",
  advanced: "price_1SDdmJGdZ9PRE3Zi84yGzqVd",
  advanced_annual: "price_1UJ0CHGdZ9PRE3ZiGBkh28XD",
  special: "price_1UNPAOGdZ9PRE3ZiQIH5kh8O", // $997/year special offer
  // Advanced + Premium Support. Resolved live by lookup key below ($297/mo),
  // with this known live price as the fallback.
  enhanced: "price_1UFnB8GdZ9PRE3ZiKwa8pHPH", // $297/mo Premium Support (lookup key: ss_premium_support_297_monthly)
  enhanced_annual: "price_1UJ0CYGdZ9PRE3ZirCTXUbRf",
};

const TEST_PRICE_IDS: Record<string, string> = {
  basic: "price_1Se8YfGdZ9PRE3ZiEuKVMphI",
  advanced: "price_1SDdmJGdZ9PRE3ZiHzQklJJi",
  enhanced: "price_1SDdmJGdZ9PRE3ZiHzQklJJi",
};

// Premium Support ($297/mo) lives on the existing support product. Resolved by
// lookup key so the price is created once and reused forever after.
const PREMIUM_SUPPORT_PRODUCT = "prod_TkZfcTSnSGktxJ";
const PREMIUM_SUPPORT_LOOKUP_KEY = "ss_premium_support_297_monthly";


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plan, email, testMode, affiliateId, attribution, promoCode, addonCall, trialSource } = await req.json();
    const normalizedEmail = typeof email === "string" && email.trim()
      ? email.trim().toLowerCase()
      : undefined;
    const PRICE_IDS = testMode ? TEST_PRICE_IDS : LIVE_PRICE_IDS;

    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error(testMode ? "STRIPE_TEST_SECRET_KEY is not set" : "STRIPE_SECRET_KEY is not set");
    }

    if (!plan || !PRICE_IDS[plan]) {
      return new Response(
        JSON.stringify({ error: "Invalid plan." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Training trials are public; webinar trials still require a matching registration.
    let applyTrial = false;
    if (trialSource !== undefined && trialSource !== null && trialSource !== "") {
      const fail = (msg: string) => new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const policyError = trialError(trialSource, plan, normalizedEmail, Date.now());
      if (policyError) return fail(policyError);
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      if (!normalizedEmail) return fail("Enter your email to claim your free trial.");
      if (trialSource === WEBINAR_TRIAL_SOURCE) {
        const { data: reg, error: regError } = await admin.from("webinar_registrations").select("id").eq("email", normalizedEmail).limit(1);
        if (regError) return fail("Unable to verify registration. Please try again.");
        if (!reg?.length) return fail("This trial is only for webinar registrants. Please register first.");
      }
      const { data: prior, error: priorError } = await admin.from("saas_suite_users").select("trial_source").eq("email", normalizedEmail);
      if (priorError) return fail("Unable to verify trial eligibility. Please try again.");
      if (prior?.some((row) => row.trial_source)) return fail("You've already used this free trial.");
      const existingCustomers = await stripe.customers.list({ email: normalizedEmail, limit: 100 });
      for (const customer of existingCustomers.data) {
        const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
        if (subscriptions.data.some((subscription) => subscription.trial_start || subscription.status === "active")) {
          return fail("This free trial is for new subscribers who haven't used a trial before.");
        }
      }
      applyTrial = true;
    }

    // Optional 40% off bump code (email-locked promotion code created by create-bump-offer).
    let promotionCodeId: string | undefined;
    let promoCustomerId: string | undefined;
    if (typeof promoCode === "string" && promoCode.trim()) {
      const promos = await stripe.promotionCodes.list({ code: promoCode.trim(), active: true, limit: 1 });
      if (promos.data.length === 0) {
        console.error(`[CREATE-CHECKOUT] Promo code not found/active in ${testMode ? "test" : "live"} mode: ${promoCode}`);
        return new Response(
          JSON.stringify({ error: "That discount code is no longer valid. Please refresh and try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      promotionCodeId = promos.data[0].id;
      // Bump codes are locked to a specific customer; the session MUST use that
      // same customer or Stripe rejects the discount.
      const restrictedCustomer = promos.data[0].customer;
      if (restrictedCustomer) {
        promoCustomerId = typeof restrictedCustomer === "string" ? restrictedCustomer : restrictedCustomer.id;
      }
    }

    // Optional one-time $30 white-label call add-on (bump on the Advanced order).
    let addonPriceId: string | undefined;
    if (addonCall === true) {
      const lookupKey = "ss_white_label_call_30";
      const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      if (found.data.length > 0) {
        addonPriceId = found.data[0].id;
      } else {
        const created = await stripe.prices.create({
          currency: "usd",
          unit_amount: 3000,
          lookup_key: lookupKey,
          product_data: { name: "White-Label Onboarding / Support Call (50% off)" },
        });
        addonPriceId = created.id;
      }
    }

    // Premium Support: always bill the current $297/mo price. The price is
    // managed in the Stripe dashboard; the restricted API key cannot create
    // prices, so a missing price must fail loudly instead of silently billing
    // the legacy $197 amount.
    let planPriceId = PRICE_IDS[plan];
    if (plan === "enhanced" && !testMode) {
      const found = await stripe.prices.list({
        lookup_keys: [PREMIUM_SUPPORT_LOOKUP_KEY],
        active: true,
        limit: 1,
      });
      if (found.data.length > 0) {
        planPriceId = found.data[0].id;
      } else {
        // Fall back to the known live $297 price ID.
        planPriceId = PRICE_IDS.enhanced;
      }
    }



    let customerId: string | undefined = promoCustomerId;
    if (!customerId && normalizedEmail) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "https://saassuite.ai";

    const returnUrl = new URL(`${origin}/app`);
    returnUrl.searchParams.set("confirmed", "true");
    if (normalizedEmail) {
      returnUrl.searchParams.set("email", normalizedEmail);
    }

    // Stripe metadata values must be strings; keep only non-empty strings.
    const attributionMeta: Record<string, string> = {};
    if (attribution && typeof attribution === "object") {
      for (const [k, v] of Object.entries(attribution as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) attributionMeta[k] = v.slice(0, 480);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [
        { price: planPriceId, quantity: 1 },
        ...(addonPriceId ? [{ price: addonPriceId, quantity: 1 }] : []),
      ],
      mode: "subscription",
      ui_mode: "embedded",
      redirect_on_completion: "if_required",
      return_url: returnUrl.toString(),
      // Stripe rejects allow_promotion_codes together with discounts.
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      ...(applyTrial
        ? {
            subscription_data: {
              trial_period_days: trialDaysFor(trialSource),
              metadata: { trial_source: String(trialSource), email: normalizedEmail ?? "" },
            },
          }
        : {}),
      metadata: {
        plan,
        ...(applyTrial ? { trial_source: String(trialSource), trial_days: String(trialDaysFor(trialSource)) } : {}),
        email: normalizedEmail ?? "",
        affiliateId: affiliateId ?? "",
        promoCode: promotionCodeId ? String(promoCode).trim() : "",
        addonCall: addonPriceId ? "white_label_call" : "",
        ...attributionMeta,
      },
    });

    console.log(`[CREATE-CHECKOUT] Embedded session created for plan=${plan}, email=${normalizedEmail ?? "undefined"}, sessionId=${session.id}`);

    await recordCheckoutSession({
      stripeCheckoutSessionId: session.id,
      email: normalizedEmail,
      plan,
      billingInterval: billingIntervalForPlan(plan),
      flow: "subscription",
      surface: attributionMeta.checkout_surface,
      page: attributionMeta.checkout_page,
      button: attributionMeta.checkout_button,
      amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
      currency: session.currency,
      status: "open",
      metadata: attributionMeta,
    });

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CHECKOUT] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
