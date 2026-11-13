import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const AUTOPAY_AMOUNT_CENTS = 6000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-consume-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const expected = Deno.env.get("ONBOARDING_CONSUME_SECRET");
    if (!expected) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept the secret via either header or body.secret for GHL flexibility.
    const headerSecret = req.headers.get("x-consume-secret") || "";
    const body = await req.json().catch(() => ({}));
    const bodySecret = typeof body?.secret === "string" ? body.secret : "";
    const provided = headerSecret || bodySecret;

    if (provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Customer (the person booking the call)
    const rawCustomerEmail =
      body?.email || body?.customer_email || body?.contact_email || "";
    const customerEmail =
      typeof rawCustomerEmail === "string" && rawCustomerEmail.trim()
        ? rawCustomerEmail.trim().toLowerCase()
        : "";

    const name = typeof body?.name === "string" ? body.name.trim() : null;
    const phone = typeof body?.phone === "string" ? body.phone.trim() : null;

    if (!customerEmail && !name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing customer email and name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amount = Math.max(1, Number(body?.amount) || 1);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the agency owner: account email, team admin email, client email, then name.
    const { data: ownerRows } = await admin.rpc("find_onboarding_owner", {
      _email: customerEmail || null,
      _name: name,
    });
    const found = Array.isArray(ownerRows) ? ownerRows[0] : ownerRows;

    // Auto-pay: charge the saved card $60 per call instead of using a wallet credit.
    let chargeStatus: string | null = null;
    let paymentIntentId: string | null = null;
    if (found?.onboarding_autopay && found.stripe_customer_id && found.stripe_payment_method_id) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
        const pi = await stripe.paymentIntents.create({
          amount: AUTOPAY_AMOUNT_CENTS * amount,
          currency: "usd",
          customer: found.stripe_customer_id,
          payment_method: found.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: `Onboarding call auto-pay (${amount}) for ${customerEmail || name}`,
          metadata: { product: "onboarding_call_autopay", owner_email: found.owner_email, customer_email: customerEmail },
        });
        paymentIntentId = pi.id;
        chargeStatus = pi.status === "succeeded" ? "charged" : `charge_${pi.status}`;
      } catch (e) {
        chargeStatus = "charge_failed";
        console.error("[CONSUME-ONBOARDING-CALL] autopay charge failed:", e instanceof Error ? e.message : e);
      }
    }

    let row: any = null;
    let error: any = null;
    if (chargeStatus === "charged") {
      const { data: u } = await admin
        .from("saas_suite_users")
        .select("onboarding_call_wallet, onboarding_call_access")
        .ilike("email", found.owner_email)
        .maybeSingle();
      row = {
        agency_id: found.agency_id,
        owner_email: found.owner_email,
        owner_name: found.owner_name,
        matched_by: found.matched_by,
        new_wallet: u?.onboarding_call_wallet ?? null,
        access_enabled: u?.onboarding_call_access ?? null,
      };
    } else {
      const res = await admin.rpc("consume_onboarding_call_by_lookup", {
        _email: found?.owner_email || customerEmail || null,
        _name: found ? null : name,
        _amount: amount,
      });
      error = res.error;
      row = Array.isArray(res.data) ? res.data[0] : res.data;
      if (row && found) row.matched_by = found.matched_by;
    }
    if (error) {
      console.error("[CONSUME-ONBOARDING-CALL] RPC error:", JSON.stringify(error));
      throw new Error(error.message || JSON.stringify(error));
    }

    const matched = !!row;
    const agencyId = matched ? (row.agency_id || null) : null;
    const ownerEmail = matched ? (row.owner_email || "").toLowerCase() : null;
    const ownerName = matched ? (row.owner_name || null) : null;
    const matchedBy = matched ? row.matched_by : null;

    // Optional booking details — log even on failure for visibility
    const meeting_link =
      typeof body?.meeting_link === "string" ? body.meeting_link.trim() : null;
    const recording_link =
      typeof body?.recording_link === "string" ? body.recording_link.trim() : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
    const external_event_id =
      typeof body?.external_event_id === "string" ? body.external_event_id.trim() : null;

    const rawScheduled =
      body?.scheduled_at || body?.start_time || body?.date_time || body?.datetime || null;
    let scheduled_at: string | null = null;
    if (rawScheduled) {
      const d = new Date(rawScheduled);
      if (!isNaN(d.getTime())) scheduled_at = d.toISOString();
    }

    const hasBookingData =
      scheduled_at ||
      meeting_link ||
      recording_link ||
      name ||
      phone ||
      notes ||
      external_event_id;

    let booking: unknown = null;
    if (hasBookingData || matched) {
      const { data: inserted, error: insertErr } = await admin
        .from("onboarding_calls")
        .insert({
          agency_id: agencyId,
          owner_email: ownerEmail,
          email: customerEmail || null,
          name,
          phone,
          scheduled_at,
          meeting_link,
          recording_link,
          notes,
          external_event_id,
          charge_status: chargeStatus,
          stripe_payment_intent_id: paymentIntentId,
          consumed_at: matched ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (insertErr) {
        console.error("[CONSUME-ONBOARDING-CALL] booking insert error:", insertErr.message);
      } else {
        booking = inserted;
      }
    }

    console.log(
      `[CONSUME-ONBOARDING-CALL] matched=${matched} by=${matchedBy} agency=${agencyId} owner=${ownerEmail} customer=${customerEmail} name=${name}`,
    );

    if (!matched) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No matching user found by email or name",
          customer_email: customerEmail || null,
          customer_name: name,
          agency_id: null,
          owner_email: null,
          owner_name: null,
          matched_by: null,
          booking,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        matched_by: matchedBy,
        agency_id: agencyId,
        owner_email: ownerEmail,
        owner_name: ownerName,
        customer_email: customerEmail || null,
        customer_name: name,
        consumed: chargeStatus === "charged" ? 0 : amount,
        wallet: row.new_wallet,
        access: row.access_enabled,
        booking,
        charge_status: chargeStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object"
          ? JSON.stringify(error)
          : String(error);
    console.error("[CONSUME-ONBOARDING-CALL] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});