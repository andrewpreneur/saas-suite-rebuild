import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo/test agencies that should never trigger a reminder
const EXCLUDED_AGENCY_IDS = ["a743d34996b944f4bc91beb15ab6c11b", "test-rpc", "test-rls"];

// Tickets older than this are considered stale and are skipped
const STALE_AFTER_DAYS = 30;

// Never send more than one summary per agency per this window
const MIN_HOURS_BETWEEN_SUMMARIES = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = Date.now();
    const since = new Date(now - STALE_AFTER_DAYS * 86400_000).toISOString();
    const reminderCutoff = new Date(now - MIN_HOURS_BETWEEN_SUMMARIES * 3600_000).toISOString();

    // 1. All agencies that have a support webhook configured
    const { data: agencies, error: agencyError } = await supabase
      .from("saas_suite_users")
      .select(
        "email, agency_name, plan, support_webhook_url, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite",
      )
      .not("support_webhook_url", "is", null);

    if (agencyError) throw agencyError;

    // 2. All open tickets in the active window
    const { data: tickets, error: ticketError } = await supabase
      .from("support_tickets")
      .select(
        "id, ticket_number, agency_id, customer_name, customer_email, issue_category, request_text, status, created_at, responded_at, admin_response, last_reminder_at",
      )
      .eq("status", "open")
      .gte("created_at", since);

    if (ticketError) throw ticketError;

    const actionable = (tickets || []).filter(
      (t) =>
        !EXCLUDED_AGENCY_IDS.includes(String(t.agency_id)) &&
        !t.responded_at &&
        !(t.admin_response && String(t.admin_response).trim().length > 0),
    );

    const results: Array<Record<string, unknown>> = [];

    for (const agency of agencies || []) {
      const webhookUrl = String(agency.support_webhook_url || "").trim();
      if (!webhookUrl.startsWith("http")) continue;

      const ids = [
        agency.agency_id,
        agency.agency_id_basic,
        agency.agency_id_advanced,
        agency.agency_id_elite,
      ].filter(Boolean).map(String);
      if (ids.length === 0) continue;

      const mine = actionable.filter((t) => ids.includes(String(t.agency_id)));
      if (mine.length === 0) continue;

      // Once-per-day guard: skip if every open ticket was already summarized recently
      const alreadySummarized = mine.every(
        (t) => t.last_reminder_at && String(t.last_reminder_at) > reminderCutoff,
      );
      if (alreadySummarized) {
        results.push({ agency: agency.email, open_tickets: mine.length, sent: false, reason: "already_summarized" });
        continue;
      }

      mine.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

      const oldest = mine[0];
      const oldestAgeHours = Math.floor(
        (now - new Date(String(oldest.created_at)).getTime()) / 3600_000,
      );

      const payload = {
        event_type: "open_tickets_summary",
        summary: true,
        reminder: true,
        agency_id: ids[0],
        agency_name: agency.agency_name ?? "",
        owner_email: agency.email,
        plan: agency.plan ?? "",
        open_ticket_count: mine.length,
        oldest_ticket_number: oldest.ticket_number,
        oldest_ticket_age_hours: oldestAgeHours,
        message:
          `${mine.length} support ticket${mine.length === 1 ? "" : "s"} still waiting for a reply. ` +
          `Oldest is #${oldest.ticket_number} (${oldestAgeHours}h old).`,
        tickets: mine.map((t) => ({
          id: t.id,
          ticket_number: t.ticket_number,
          customer_name: t.customer_name,
          customer_email: t.customer_email,
          issue_category: t.issue_category,
          request_text: t.request_text,
          created_at: t.created_at,
        })),
        timestamp: new Date().toISOString(),
      };

      let status: number | null = null;
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        status = resp.status;
      } catch (err) {
        console.error(`summary webhook failed for ${agency.email}:`, err);
      }

      if (status && status >= 200 && status < 400) {
        await supabase
          .from("support_tickets")
          .update({ last_reminder_at: new Date().toISOString() })
          .in("id", mine.map((t) => t.id));
      }

      results.push({
        agency: agency.email,
        open_tickets: mine.length,
        sent: status !== null,
        webhook_status: status,
      });
    }

    console.log(
      `ticket-open-reminders: ${results.filter((r) => r.sent).length} summary pings sent across ${results.length} agencies`,
    );

    return new Response(JSON.stringify({ ok: true, agencies: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ticket-open-reminders error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
