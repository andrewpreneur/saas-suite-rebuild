import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same LeadConnector inbound webhook used for human handovers (texts Andrew).
const ALERT_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { message_id } = await req.json().catch(() => ({ message_id: null }));
    if (!message_id || typeof message_id !== "string") {
      return new Response(JSON.stringify({ error: "message_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msg, error } = await supabase
      .from("agency_support_messages")
      .select("id, client_email, agency_id, sender_role, sender_name, body, created_at")
      .eq("id", message_id)
      .maybeSingle();
    if (error) throw error;
    if (!msg) {
      return new Response(JSON.stringify({ ok: false, reason: "message not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.sender_role !== "client") {
      return new Response(JSON.stringify({ ok: true, skipped: "not a customer message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Who owns this agency-support seat?
    const { data: seat } = await supabase
      .from("agency_support_clients")
      .select("owner_email, client_name")
      .ilike("client_email", msg.client_email)
      .maybeSingle();

    const ownerEmail = (seat?.owner_email || msg.client_email).toLowerCase();
    const { data: owner } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, agency_name, plan")
      .ilike("email", ownerEmail)
      .maybeSingle();

    // How long has this message been sitting unanswered by us?
    const { count: repReplies } = await supabase
      .from("agency_support_messages")
      .select("id", { count: "exact", head: true })
      .ilike("client_email", msg.client_email)
      .neq("sender_role", "client")
      .gt("created_at", msg.created_at);

    const payload = {
      event_type: "agency_support_message",
      source: "agency_support",
      user_name: msg.sender_name || seat?.client_name || msg.client_email,
      customer_identifier: msg.client_email,
      client_email: msg.client_email,
      account_email: owner?.email ?? ownerEmail,
      owner_email: owner?.email ?? ownerEmail,
      account_name: owner?.agency_name || owner?.full_name || owner?.email || msg.agency_id || ownerEmail,
      agency_name: owner?.agency_name || "Not set",
      agency_id: msg.agency_id || "Not set",
      plan: owner?.plan || "Unknown",
      last_message: msg.body,
      reason: `New agency support message from ${msg.sender_name || msg.client_email}`,
      already_answered: (repReplies ?? 0) > 0,
      message_id: msg.id,
      created_at: msg.created_at,
      timestamp: new Date().toISOString(),
    };

    let status: number | null = null;
    try {
      const resp = await fetch(ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      status = resp.status;
    } catch (e) {
      console.error("[AGENCY-SUPPORT-NOTIFY] webhook failed", e);
    }

    // Best-effort Slack ping so it also lands in the support channel.
    try {
      await supabase.functions.invoke("slack-auto-notify", {
        body: {
          event: "agency_support_message",
          text: `New agency support message from ${payload.user_name} (${msg.client_email}) — ${msg.body.slice(0, 300)}`,
        },
      });
    } catch (_) { /* optional */ }

    console.log(
      `[AGENCY-SUPPORT-NOTIFY] alerted client=${msg.client_email} agency=${msg.agency_id} status=${status}`,
    );

    return new Response(JSON.stringify({ ok: true, webhook_status: status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-agency-support-message error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
