import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  AGENCY_SUPPORT_UNIT_PRICE,
  findSeatPrice,
} from "../_shared/agency-support.ts";
import { recordCheckoutSession } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, quantity } = await req.json().catch(() => ({}));
    const normalizedEmail =
      typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;
    const qty = Math.max(1, Math.min(100, Number(quantity) || 1));

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse the shared $49/mo seat price when it exists; otherwise price inline.
    const price = await findSeatPrice(stripe);


    let customerId: string | undefined;
    if (normalizedEmail) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://saassuite.ai";
    const returnUrl = new URL(`${origin}/app/agency-support`);
    returnUrl.searchParams.set("agencySupportPurchase", "true");
    if (normalizedEmail) returnUrl.searchParams.set("email", normalizedEmail);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [
        {
          ...(price
            ? { price: price.id }
            : {
                price_data: {
                  currency: "usd",
                  unit_amount: AGENCY_SUPPORT_UNIT_PRICE * 100,
                  recurring: { interval: "month" as const },
                  product_data: {
                    name: "Agency Support (per client account)",
                    description:
                      "White-glove Agency Support fulfillment for one client sub-account.",
                    metadata: { product: "agency_support" },
                  },
                },
              }),
          quantity: qty,
          adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 },
        },
      ],
      mode: "subscription",
      ui_mode: "embedded",
      redirect_on_completion: "if_required",
      return_url: returnUrl.toString(),
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          product: "agency_support",
          email: normalizedEmail ?? "",
        },
      },
      metadata: {
        product: "agency_support",
        email: normalizedEmail ?? "",
        quantity: String(qty),
      },
    });

    await recordCheckoutSession({
      stripeCheckoutSessionId: session.id,
      email: normalizedEmail,
      plan: "agency_support",
      billingInterval: "monthly",
      flow: "agency_support",
      surface: "/app/agency-support",
      page: "/app/agency-support",
      button: "Checkout",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : AGENCY_SUPPORT_UNIT_PRICE * 100 * qty,
      currency: session.currency || "usd",
      status: "open",
    });

    console.log(
      `[CREATE-AGENCY-SUPPORT-CHECKOUT] session=${session.id} email=${normalizedEmail ?? "n/a"} qty=${qty} price=${price?.id ?? "inline"} unit=$${AGENCY_SUPPORT_UNIT_PRICE}`,
    );

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-AGENCY-SUPPORT-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
