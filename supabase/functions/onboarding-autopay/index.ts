// Manage "Auto-Pay Upon Booking" for onboarding calls: save a card via Stripe setup, confirm, or disable.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { recordCheckoutSession } from "../_shared/journey-log.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);
    const token = auth.slice(7);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u.user?.email) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const ownerEmail = String(body?.owner_email || u.user.email).trim().toLowerCase();
    if (!["setup", "confirm", "disable"].includes(action)) return json({ error: "Invalid action" }, 400);
    const { data: allowed } = await userClient.rpc("can_access_owner_email", { p_owner_email: ownerEmail });
    if (!allowed) return json({ error: "Not allowed" }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    if (action === "disable") {
      await admin.from("saas_suite_users").update({ onboarding_autopay: false }).ilike("email", ownerEmail);
      return json({ ok: true, autopay: false });
    }

    if (action === "setup") {
      if (body?.consent !== true) return json({ error: "Consent required" }, 400);
      const list = await stripe.customers.list({ email: ownerEmail, limit: 1 });
      const customer = list.data[0] ?? (await stripe.customers.create({ email: ownerEmail }));
      const origin = req.headers.get("origin") || "https://saassuite.ai";
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        customer: customer.id,
        currency: "usd",
        payment_method_types: ["card"],
        success_url: `${origin}/app/onboarding-calls?autopaySetup={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/app/onboarding-calls`,
        metadata: { product: "onboarding_autopay", owner_email: ownerEmail },
      });
      await recordCheckoutSession({
        stripeCheckoutSessionId: session.id,
        email: ownerEmail,
        plan: "onboarding_autopay",
        billingInterval: "one_time",
        flow: "autopay",
        surface: "/app/onboarding-calls Auto-Pay",
        page: "/app/onboarding-calls",
        button: "Save card",
        amountCents: 0,
        currency: "usd",
        status: "open",
      });
      return json({ url: session.url });
    }

    // confirm
    const sessionId = String(body?.session_id || "");
    if (!sessionId.startsWith("cs_")) return json({ error: "session_id required" }, 400);
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });
    if (session.metadata?.owner_email !== ownerEmail) return json({ error: "Session mismatch" }, 403);
    const si = session.setup_intent as any;
    if (!si || si.status !== "succeeded" || !si.payment_method) return json({ error: "Card not saved yet" }, 400);
    const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method.id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    await stripe.customers.update(customerId!, { invoice_settings: { default_payment_method: pm } });
    const { error } = await admin
      .from("saas_suite_users")
      .update({
        onboarding_autopay: true,
        onboarding_autopay_consent_at: new Date().toISOString(),
        onboarding_stripe_customer_id: customerId,
        onboarding_stripe_payment_method_id: pm,
      })
      .ilike("email", ownerEmail);
    if (error) throw error;
    return json({ ok: true, autopay: true });
  } catch (e) {
    console.error("onboarding-autopay error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
