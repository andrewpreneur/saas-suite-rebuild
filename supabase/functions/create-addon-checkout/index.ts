import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { recordCheckoutSession } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// One-time add-on products created lazily and reused via lookup_key.
const PRODUCTS: Record<
  string,
  { lookupKey: string; name: string; description: string; amount: number; returnPath: string }
> = {
  strategy_call: {
    lookupKey: "ss_strategy_call_150",
    name: "1:1 Strategy & Coaching Call with Andrew George",
    description:
      "60-minute recorded 1:1 session: ads for SaaS agencies, your best offer, a custom 30-day client-getting checklist, plus a free follow-up call if you don't hit your goal.",
    amount: 15000,
    returnPath: "/success",
  },
  white_label_call: {
    lookupKey: "ss_white_label_call_30",
    name: "White-Label Onboarding / Support Call (50% off)",
    description: "One white-label onboarding or support call delivered to one of your customers.",
    amount: 3000,
    returnPath: "/success",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const product = typeof body.product === "string" ? body.product : "";
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : undefined;
    const testMode = body.testMode === true;

    const config = PRODUCTS[product];
    if (!config) {
      return new Response(
        JSON.stringify({ error: "product must be 'strategy_call' or 'white_label_call'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe secret key is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find (or create) the price for this add-on.
    let priceId: string | undefined;
    const found = await stripe.prices.list({ lookup_keys: [config.lookupKey], limit: 1 });
    if (found.data.length > 0) {
      priceId = found.data[0].id;
    } else {
      const created = await stripe.prices.create({
        currency: "usd",
        unit_amount: config.amount,
        lookup_key: config.lookupKey,
        product_data: { name: config.name },
      });
      priceId = created.id;
    }

    let customerId: string | undefined;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://saassuite.ai";
    const returnUrl = new URL(`${origin}${config.returnPath}`);
    returnUrl.searchParams.set("addon", product);
    if (email) returnUrl.searchParams.set("email", email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded",
      redirect_on_completion: "if_required",
      return_url: returnUrl.toString(),
      metadata: { product, email: email ?? "" },
    });

    await recordCheckoutSession({
      stripeCheckoutSessionId: session.id,
      email,
      plan: product,
      billingInterval: "one_time",
      flow: "addon",
      surface: config.returnPath,
      page: config.returnPath,
      button: "Checkout",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : config.amount,
      currency: session.currency || "usd",
      status: "open",
    });

    console.log(`[CREATE-ADDON-CHECKOUT] product=${product} email=${email ?? "n/a"} session=${session.id}`);

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id, priceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-ADDON-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});