import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { syncAgencySupportWallet } from "../_shared/agency-support.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId, fallbackEmail } = await req.json().catch(() => ({}));
    if (!sessionId) throw new Error("Missing sessionId");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status !== "complete" && session.payment_status !== "paid") {
      return new Response(JSON.stringify({ ok: false, error: "Session not complete" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email =
      (session.customer_details?.email ||
        session.customer_email ||
        (session.metadata?.email as string | undefined) ||
        fallbackEmail ||
        "")
        .toString()
        .trim()
        .toLowerCase();

    const customerId = typeof session.customer === "string" ? session.customer : "";
    const result = await syncAgencySupportWallet(stripe, customerId, email);

    return new Response(
      JSON.stringify({ ok: true, email: result?.email ?? email, wallet: result?.seats ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[NOTIFY-AGENCY-SUPPORT-PURCHASE] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
