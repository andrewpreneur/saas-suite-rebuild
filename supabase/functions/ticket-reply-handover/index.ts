import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { allowPlatformNotification, readPlatformSupportExclusion } from "../_shared/platformSupportExcluded.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same endpoint as the human handover text notifications
const HANDOVER_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9";
const PLATFORM_OWNER_EMAIL = "andrew@dna-media.net";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { reply_id } = await req.json().catch(() => ({}));
    if (!reply_id || typeof reply_id !== "string") return json({ error: "reply_id required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only trust what's in the database, not the caller.
    const { data: reply } = await supabase
      .from("support_ticket_replies")
      .select("id, ticket_id, sender_role, sender_name, sender_email, body, created_at")
      .eq("id", reply_id)
      .maybeSingle();
    if (!reply || reply.sender_role !== "customer") return json({ ok: true, skipped: "not a customer reply" });

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, agency_id, customer_name, customer_email, issue_category")
      .eq("id", reply.ticket_id)
      .maybeSingle();
    if (!ticket) return json({ ok: true, skipped: "ticket not found" });

    // Account-level "Customer Replies" webhook (any agency).
    let customerWebhookStatus: number | null = null;
    try {
      const id = String(ticket.agency_id || "").replace(/NO$/i, "");
      const { data: acct } = await supabase
        .from("saas_suite_users")
        .select("email, agency_name, customer_replies_webhook_url")
        .or(`agency_id.eq.${id},agency_id_basic.eq.${id},agency_id_advanced.eq.${id},agency_id_elite.eq.${id}`)
        .not("customer_replies_webhook_url", "is", null)
        .limit(1)
        .maybeSingle();
      const hook = String(acct?.customer_replies_webhook_url || "").trim();
      if (/^https:\/\//i.test(hook)) {
        const r = await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            event_type: "customer_reply",
            agency_id: ticket.agency_id,
            agency_name: acct?.agency_name ?? null,
            account_owner_email: acct?.email ?? null,
            customer_name: reply.sender_name || ticket.customer_name || null,
            customer_email: reply.sender_email || ticket.customer_email || null,
            customer_reply: reply.body || "",
            ticket_number: ticket.ticket_number,
            ticket_id: ticket.id,
            issue_category: ticket.issue_category ?? null,
            replied_at: reply.created_at,
          }),
        });
        customerWebhookStatus = r.status;
      }
    } catch (e) {
      console.error("customer replies webhook failed:", e);
    }

    const { data: ownerRow } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .ilike("email", PLATFORM_OWNER_EMAIL)
      .maybeSingle();
    const ours = [ownerRow?.agency_id, ownerRow?.agency_id_basic, ownerRow?.agency_id_advanced, ownerRow?.agency_id_elite]
      .filter(Boolean).map(String);
    if (!ours.includes(String(ticket.agency_id))) return json({ ok: true, customer_webhook_status: customerWebhookStatus, skipped: "not a SaaSSuite hub ticket" });

    // The account customer_replies webhook above is the agency's own hook and already ran.
    // This LeadConnector ping is platform-only and fails closed.
    const exclusion = await readPlatformSupportExclusion(supabase, String(ticket.agency_id || ""));
    if (!allowPlatformNotification(exclusion)) {
      return json({ ok: true, customer_webhook_status: customerWebhookStatus, skipped: "platform support excluded" });
    }

    const name = reply.sender_name || ticket.customer_name || "Customer";
    const email = reply.sender_email || ticket.customer_email || "";
    const snippet = String(reply.body || "").slice(0, 300);

    const payload = {
      user_name: name,
      account_email: email,
      owner_email: "support@saassuite.ai",
      account_name: "SaaSSuite",
      agency_name: "SaaSSuite",
      plan: "Internal",
      agency_id: ticket.agency_id,
      customer_identifier: email || name,
      last_message: `Ticket #${ticket.ticket_number} reply: ${snippet}`,
      reason: `Customer replied to ticket #${ticket.ticket_number}`,
      ticket_reply: true,
      ticket_number: ticket.ticket_number,
      ticket_id: ticket.id,
      attempt: 1,
      minutes_waiting: 0,
      handover_requested_at: reply.created_at,
      timestamp: new Date().toISOString(),
    };

    const resp = await fetch(HANDOVER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) console.error("handover webhook failed", resp.status, await resp.text());
    return json({ ok: true, sent: resp.ok, webhook_status: resp.status });
  } catch (e) {
    console.error("ticket-reply-handover error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
