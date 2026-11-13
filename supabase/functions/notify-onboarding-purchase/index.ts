import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { logCustomerMessage, recordCheckoutSession } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/29b9a498-af9e-4513-a042-f5573818b500";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId, fallbackEmail } = await req.json();
    if (!sessionId) throw new Error("Missing sessionId");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return new Response(
        JSON.stringify({ ok: false, error: "Session not paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawEmail =
      session.customer_details?.email ??
      session.customer_email ??
      fallbackEmail ??
      session.metadata?.email ??
      "";
    const email = String(rawEmail).trim().toLowerCase();
    if (!email) throw new Error("Could not resolve customer email");

    await recordCheckoutSession({
      stripeCheckoutSessionId: sessionId,
      email,
      plan: "onboarding_call",
      billingInterval: "one_time",
      flow: "onboarding_call",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
      currency: session.currency || "usd",
      status: "completed",
    });

    const qty = Math.max(
      1,
      Number(session.metadata?.quantity) ||
        (session.line_items?.data?.[0]?.quantity ?? 1) ||
        1,
    );
    const amountPaid =
      typeof session.amount_total === "number" ? session.amount_total / 100 : 60 * qty;
    const name = session.customer_details?.name ?? "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Idempotency: use Stripe session id as marker
    const { data: existing } = await admin
      .from("saas_suite_users")
      .select("email, onboarding_call_wallet, last_onboarding_session_id")
      .ilike("email", email)
      .maybeSingle();

    if (existing && (existing as any).last_onboarding_session_id === sessionId) {
      return new Response(
        JSON.stringify({
          ok: true,
          email,
          wallet: (existing as any).onboarding_call_wallet,
          duplicate: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: rpcData, error: rpcError } = await admin.rpc("add_onboarding_calls", {
      _email: email,
      _amount: qty,
    });
    if (rpcError) throw rpcError;

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const newWallet = row?.onboarding_call_wallet ?? null;

    // Best-effort: record the session id so duplicate notifies are idempotent.
    // Column is optional — ignore failures (e.g. column not present).
    try {
      await admin
        .from("saas_suite_users")
        .update({ last_onboarding_session_id: sessionId } as any)
        .ilike("email", email);
    } catch (_) {
      /* noop */
    }

    // Fire GHL webhook
    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "onboarding_purchase",
          email,
          name,
          quantity: qty,
          amount_paid: amountPaid,
          currency: (session.currency || "usd").toUpperCase(),
          wallet_balance: newWallet,
          stripe_session_id: sessionId,
        }),
      });
      await logCustomerMessage({
        userEmail: email,
        channel: "webhook",
        templateKey: "onboarding_purchase",
        provider: "ghl",
        status: resp.ok ? "sent" : "failed",
        source: "notify-onboarding-purchase",
        detail: resp.ok ? null : `http_${resp.status}`,
      });
      if (!resp.ok) {
        console.error(
          `[NOTIFY-ONBOARDING-PURCHASE] GHL webhook failed: ${resp.status} ${await resp.text()}`,
        );
      }
    } catch (e) {
      console.error("[NOTIFY-ONBOARDING-PURCHASE] GHL webhook error:", e);
      await logCustomerMessage({
        userEmail: email,
        channel: "webhook",
        templateKey: "onboarding_purchase",
        provider: "ghl",
        status: "failed",
        source: "notify-onboarding-purchase",
        detail: "request_failed",
      });
    }

    console.log(
      `[NOTIFY-ONBOARDING-PURCHASE] email=${email} +${qty} wallet=${newWallet} session=${sessionId}`,
    );

    return new Response(
      JSON.stringify({ ok: true, email, quantity: qty, wallet: newWallet }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[NOTIFY-ONBOARDING-PURCHASE] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});