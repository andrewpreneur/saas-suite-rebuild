import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { recordCheckoutSession } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * One-time $27 digital course products.
 *
 * The Stripe key available here can create products/prices, so each course is
 * resolved by a stable lookup_key and created once on first purchase attempt.
 * The resulting price id never changes afterwards, so reporting stays clean.
 */
const COURSES = {
  first_client: {
    lookupKey: "ss_course_first_ghl_client_27",
    name: "Get Your First GHL Client in 30 Days",
    description:
      "7 Day Setup Basics course, 25-video Simple SaaS training, Ai Andrew skill file, brandless AI Studio sales video + SaaS welcome video, and a white-label sales page. Get 1 client in 30 days or you don't pay.",
    amount: 2700,
    returnPath: "/first-ghl-client/success",
  },
  agency_freedom: {
    lookupKey: "ss_course_agency_freedom_27",
    name: "Digital Agency Freedom Course — Grow to 20+ Paying GHL Clients",
    description:
      "The scale playbook: 7 Day Setup Basics course, 25-video Simple SaaS training, Ai Andrew skill file, brandless AI Studio sales video + SaaS welcome video, and a white-label sales page.",
    amount: 2700,
    returnPath: "/digital-agency-freedom/success",
  },
} as const;

type CourseKey = keyof typeof COURSES;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { course, email, testMode, attribution } = await req.json().catch(() => ({}));
    const config = COURSES[course as CourseKey];
    if (!config) {
      return new Response(JSON.stringify({ error: "Invalid course." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error(testMode ? "STRIPE_TEST_SECRET_KEY is not set" : "STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const normalizedEmail =
      typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;

    // Resolve (or create once) the price behind this course.
    let priceId: string;
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
    if (normalizedEmail) {
      const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://saassuite.ai";
    const returnUrl = new URL(`${origin}${config.returnPath}`);
    returnUrl.searchParams.set("confirmed", "true");
    if (normalizedEmail) returnUrl.searchParams.set("email", normalizedEmail);

    const attributionMeta: Record<string, string> = {};
    if (attribution && typeof attribution === "object") {
      for (const [k, v] of Object.entries(attribution as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) attributionMeta[k] = v.slice(0, 480);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded",
      redirect_on_completion: "if_required",
      return_url: returnUrl.toString(),
      allow_promotion_codes: true,
      metadata: {
        product: "course",
        course: String(course),
        email: normalizedEmail ?? "",
        ...attributionMeta,
      },
    });

    await recordCheckoutSession({
      stripeCheckoutSessionId: session.id,
      email: normalizedEmail,
      plan: String(course),
      billingInterval: "one_time",
      flow: "course",
      surface: config.returnPath,
      page: config.returnPath,
      button: "Checkout",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : config.amount,
      currency: session.currency || "usd",
      status: "open",
    });

    console.log(
      `[CREATE-COURSE-CHECKOUT] course=${course} price=${priceId} email=${normalizedEmail ?? "n/a"} session=${session.id}`,
    );

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret, sessionId: session.id, priceId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-COURSE-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
