import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isAgencyIdExcluded, loadExcludedAgencyIds } from "../_shared/platformSupportExcluded.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HANDOVER_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9";

// Re-ping cadence and cap
const REPING_INTERVAL_MINUTES = 5;
const MAX_NOTIFICATIONS = 288; // ~24h at 5min cadence — safety cap

// Demo/test agencies that should never trigger handover webhooks
const EXCLUDED_AGENCY_IDS = ["a743d34996b944f4bc91beb15ab6c11b"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let excluded: Set<string>;
    try {
      excluded = await loadExcludedAgencyIds(supabase);
    } catch (exclusionError) {
      // Fail closed: do not ping Andrew if we cannot prove an agency is allowed.
      console.error("handover-repeat-ping exclusion check failed", exclusionError);
      return new Response(JSON.stringify({ ok: true, notified: 0, skipped: "exclusion_check_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoff = new Date(Date.now() - REPING_INTERVAL_MINUTES * 60 * 1000).toISOString();

    // Find pending handovers past the re-ping cooldown. Fetch extra rows so an
    // excluded agency cannot fill the batch and hide someone else's reminder.
    const { data: threads, error } = await supabase
      .from("chat_threads")
      .select(
        "agency_id, user_identifier, handover_requested_at, last_handover_notified_at, handover_notification_count, last_user_message_at",
      )
      .is("handover_resolved_at", null)
      .not("handover_requested_at", "is", null)
      .or(`last_handover_notified_at.is.null,last_handover_notified_at.lt.${cutoff}`)
      .limit(200);

    if (error) throw error;

    const results: any[] = [];

    for (const t of threads || []) {
      if (results.length >= 50) break;
      if ((t.handover_notification_count ?? 0) >= MAX_NOTIFICATIONS) continue;
      if (EXCLUDED_AGENCY_IDS.includes(t.agency_id)) continue;
      if (isAgencyIdExcluded(t.agency_id, excluded)) continue;

      // Look up owner + agency context
      const { data: owner } = await supabase
        .from("saas_suite_users")
        .select("email, plan, agency_name, full_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
        .or(
          `agency_id.eq.${t.agency_id},agency_id_basic.eq.${t.agency_id},agency_id_advanced.eq.${t.agency_id},agency_id_elite.eq.${t.agency_id}`,
        )
        .maybeSingle();

      // Grab the most recent user message for context
      const { data: lastMsg } = await supabase
        .from("ai_chat_messages")
        .select("content, created_at")
        .eq("agency_id", t.agency_id)
        .ilike("user_identifier", t.user_identifier)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const attemptNumber = (t.handover_notification_count ?? 0) + 1;
      const minutesWaiting = Math.round(
        (Date.now() - new Date(t.handover_requested_at as string).getTime()) / 60000,
      );

      const { data: ctx } = await supabase.rpc("get_support_alert_context", {
        p_agency_id: t.agency_id,
        p_user_identifier: t.user_identifier,
      });
      const c: any = ctx || {};

      // Agency-managed support teams handle their own follow-up cadence.
      // Only SaaSSuite-managed accounts receive automated handover reminders.
      if (c.human_chat_mode !== "managed") continue;

      const recipient = c.notify_target === "saassuite"
        ? { name: "SaaSSuite", email: "team@yoursoftwareonboarding.com", phone: null }
        : { name: c.assigned_to_name ?? null, email: c.assigned_to_email ?? null, phone: c.assigned_to_phone ?? null };

      const payload = {
        user_name: t.user_identifier,
        account_email: owner?.email ?? null,
        owner_email: owner?.email ?? null,
        account_name: owner?.agency_name || owner?.full_name || owner?.email || t.agency_id,
        agency_name: owner?.agency_name || "Not set",
        plan: owner?.plan || "Unknown",
        agency_id: t.agency_id,
        customer_identifier: t.user_identifier,
        last_message: lastMsg?.content ?? "(no user message on file)",
        reason: `Reminder: human handover still unresolved after ${minutesWaiting} minute${minutesWaiting === 1 ? "" : "s"} (attempt #${attemptNumber}).`,
        attempt: attemptNumber,
        minutes_waiting: minutesWaiting,
        reminder: true,
        handover_requested_at: t.handover_requested_at,
        timestamp: new Date().toISOString(),
        // Added fields (same as the support_alert payload)
        notification_type: "support_alert",
        event_type: "chat_handover",
        is_ticket: false,
        contact_name: t.user_identifier,
        contact_email: t.user_identifier,
        human_chat_mode: c.human_chat_mode ?? "self",
        handled_by: c.handled_by ?? "agency",
        notify_target: c.notify_target ?? null,
        assigned_default: !!c.assigned_default,
        recipient_role: c.notify_target === "saassuite" ? "saassuite" : (c.assigned_to_email === c.account_owner_email ? "owner" : "admin"),
        recipient_name: recipient.name,
        recipient_email: recipient.email,
        recipient_phone: recipient.phone,
        assigned_to_name: c.assigned_to_name ?? null,
        assigned_to_email: c.assigned_to_email ?? null,
        assigned_to_phone: c.assigned_to_phone ?? null,
        account_owner_name: c.account_owner_name ?? owner?.full_name ?? null,
        account_owner_email: c.account_owner_email ?? owner?.email ?? null,
        account_owner_phone: c.account_owner_phone ?? null,
        login_url: "https://saassuite.ai/app/support",
      };

      let status: number | null = null;
      try {
        const resp = await fetch(HANDOVER_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        status = resp.status;
      } catch (err) {
        console.error("handover reminder webhook failed:", err);
      }

      await supabase
        .from("chat_threads")
        .update({
          last_handover_notified_at: new Date().toISOString(),
          handover_notification_count: attemptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", t.agency_id)
        .eq("user_identifier", t.user_identifier);

      results.push({
        agency_id: t.agency_id,
        user_identifier: t.user_identifier,
        attempt: attemptNumber,
        webhook_status: status,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, notified: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("handover-repeat-ping error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});