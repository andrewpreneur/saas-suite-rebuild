import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { recordCheckoutSession } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LIVE_PRICE_ID = "price_1TfOBsGdZ9PRE3ZiVEOzqQSE"; // $60 onboarding call

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, quantity } = await req.json().catch(() => ({}));
    const normalizedEmail =
      typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;
    const qty = Math.max(1, Math.min(10, Number(quantity) || 1));

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId: string | undefined;
    if (normalizedEmail) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://saassuite.ai";
    const returnUrl = new URL(`${origin}/app/onboarding-calls`);
    returnUrl.searchParams.set("onboardingPurchase", "true");
    if (normalizedEmail) returnUrl.searchParams.set("email", normalizedEmail);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [{ price: LIVE_PRICE_ID, quantity: qty }],
      mode: "payment",
      ui_mode: "embedded",
      redirect_on_completion: "if_required",
      return_url: returnUrl.toString(),
      allow_promotion_codes: true,
      metadata: {
        product: "onboarding_call",
        email: normalizedEmail ?? "",
        quantity: String(qty),
      },
    });

    await recordCheckoutSession({
      stripeCheckoutSessionId: session.id,
      email: normalizedEmail,
      plan: "onboarding_call",
      billingInterval: "one_time",
      flow: "onboarding_call",
      surface: "/app/onboarding-calls",
      page: "/app/onboarding-calls",
      button: "Checkout",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : 6000 * qty,
      currency: session.currency || "usd",
      status: "open",
    });

    console.log(
      `[CREATE-ONBOARDING-CHECKOUT] session=${session.id} email=${normalizedEmail ?? "n/a"} qty=${qty}`,
    );

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-ONBOARDING-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});