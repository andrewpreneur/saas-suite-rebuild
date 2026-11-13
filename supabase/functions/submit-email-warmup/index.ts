import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCustomerMessage } from "../_shared/journey-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8b1d0a0f-0d9e-4466-8c23-0245bddf9f3d";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userResp } = await userClient.auth.getUser();
    const callerEmail = userResp?.user?.email?.trim().toLowerCase();
    if (!callerEmail) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const agency_name = String(body.agency_name || "").trim();
    const sender_name = String(body.sender_name || "").trim();
    const sender_email = String(body.sender_email || "").trim();
    const profile_image_link = String(body.profile_image_link || "").trim();

    if (!agency_name || !sender_name || !sender_email || !profile_image_link) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Decrement credit atomically; throws NO_CREDITS if balance is 0
    const { data: newBalance, error: rpcErr } = await admin.rpc(
      "consume_email_warmup_credit",
      { p_email: callerEmail },
    );
    if (rpcErr) {
      const msg = String(rpcErr.message || "");
      const noCredits = msg.includes("NO_CREDITS");
      return new Response(
        JSON.stringify({ error: noCredits ? "No warmup credits remaining" : msg }),
        {
          status: noCredits ? 402 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: inserted, error: insErr } = await admin
      .from("email_warmup_requests")
      .insert({
        user_email: callerEmail,
        agency_name,
        sender_name,
        sender_email,
        profile_image_link,
        status: "sent",
      })
      .select()
      .single();

    if (insErr) {
      console.error("insert error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire LeadConnector webhook (don't fail request on webhook failure)
    try {
      const warmupRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "email_warmup_request",
          user_email: callerEmail,
          agency_name,
          sender_name,
          sender_email,
          profile_image_link,
          request_id: inserted?.id,
          credits_remaining: newBalance,
          submitted_at: new Date().toISOString(),
        }),
      });
      await logCustomerMessage({
        userEmail: callerEmail,
        channel: "webhook",
        templateKey: "email_warmup_request",
        provider: "ghl",
        status: warmupRes.ok ? "sent" : "failed",
        source: "submit-email-warmup",
        detail: warmupRes.ok ? null : `http_${warmupRes.status}`,
      });
    } catch (whErr) {
      console.error("webhook error", whErr);
      await logCustomerMessage({
        userEmail: callerEmail,
        channel: "webhook",
        templateKey: "email_warmup_request",
        provider: "ghl",
        status: "failed",
        source: "submit-email-warmup",
        detail: "request_failed",
      });
    }

    return new Response(
      JSON.stringify({ success: true, credits_remaining: newBalance, request: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});