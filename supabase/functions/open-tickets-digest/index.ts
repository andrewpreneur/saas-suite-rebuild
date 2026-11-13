import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isAgencyIdExcluded, loadExcludedAgencyIds } from "../_shared/platformSupportExcluded.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same endpoint used by the human handover notifications
const HANDOVER_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9";

// Demo/test agencies that should never count toward the digest
const EXCLUDED_AGENCY_IDS = [
  "a743d34996b944f4bc91beb15ab6c11b",
  "test-rpc",
  "test-rls",
];

// Only tickets newer than this are considered actionable
const STALE_AFTER_DAYS = 14;

// Whose hubs count as "ours" for the digest
const PLATFORM_OWNER_EMAIL = "andrew@dna-media.net";

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
      console.error("open-tickets-digest exclusion check failed", exclusionError);
      return new Response(JSON.stringify({ ok: true, sent: false, skipped: "exclusion_check_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - STALE_AFTER_DAYS * 86400_000).toISOString();

    // Only tickets inside SaaSSuite's OWN hubs are ours to answer. Tickets raised
    // inside a customer's own portal belong to that agency owner, not to us.
    const { data: ownerRow } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .ilike("email", PLATFORM_OWNER_EMAIL)
      .maybeSingle();

    const ourAgencyIds = Array.from(
      new Set(
        [
          ownerRow?.agency_id,
          ownerRow?.agency_id_basic,
          ownerRow?.agency_id_advanced,
          ownerRow?.agency_id_elite,
        ].filter(Boolean) as string[],
      ),
    );

    if (ourAgencyIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, open_tickets: 0, sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error } = await supabase
      .from("support_tickets")
      .select("id, agency_id, responded_at, admin_response")
      .eq("status", "open")
      .in("agency_id", ourAgencyIds)
      .or(`created_at.gte.${since},updated_at.gte.${since}`);

    if (error) throw error;

    // Latest customer follow-up per ticket — a reply after our last response
    // means the ticket is waiting on us again.
    const ticketIds = (rows || []).map((t) => t.id);
    const lastCustomerReply = new Map<string, string>();
    if (ticketIds.length) {
      const { data: replies } = await supabase
        .from("support_ticket_replies")
        .select("ticket_id, created_at")
        .eq("sender_role", "customer")
        .in("ticket_id", ticketIds);
      for (const r of replies || []) {
        const prev = lastCustomerReply.get(r.ticket_id);
        if (!prev || r.created_at > prev) lastCustomerReply.set(r.ticket_id, r.created_at);
      }
    }

    let followUpCount = 0;
    const actionable = (rows || []).filter((t) => {
      if (EXCLUDED_AGENCY_IDS.includes(String(t.agency_id))) return false;
      if (isAgencyIdExcluded(t.agency_id, excluded)) return false;
      const unanswered =
        !t.responded_at && !(t.admin_response && String(t.admin_response).trim().length > 0);
      if (unanswered) return true;
      const lr = lastCustomerReply.get(t.id);
      if (lr && (!t.responded_at || new Date(lr) > new Date(t.responded_at))) {
        followUpCount++;
        return true;
      }
      return false;
    });

    const openCount = actionable.length;

    // Human-handover chat sessions that nobody has replied to yet
    const { data: threadRows } = await supabase
      .from("chat_threads")
      .select(
        "id, agency_id, user_identifier, handover_requested_at, handover_resolved_at, last_owner_message_at",
      )
      .not("handover_requested_at", "is", null)
      .is("handover_resolved_at", null)
      .gte("handover_requested_at", since)
      .order("handover_requested_at", { ascending: true })
      .limit(200);

    // Only chats SaaS Suite answers: our own hub plus "We Handle & Respond" agencies.
    const { data: managedRows } = await supabase.from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite").eq("human_chat_mode", "managed");
    const ours = new Set<string>([...ourAgencyIds, ...(managedRows || []).flatMap((r: any) =>
      [r.agency_id, r.agency_id_basic, r.agency_id_advanced, r.agency_id_elite].filter(Boolean).map(String))]);
    const pendingHandovers = (threadRows || []).filter((t: any) => {
      if (EXCLUDED_AGENCY_IDS.includes(String(t.agency_id))) return false;
      if (isAgencyIdExcluded(t.agency_id, excluded)) return false;
      if (!ours.has(String(t.agency_id))) return false;
      if (!t.last_owner_message_at) return true;
      return (
        new Date(t.last_owner_message_at).getTime() <
        new Date(t.handover_requested_at).getTime()
      );
    });

    const handoverList = Array.from(
      new Set(
        pendingHandovers
          .map((t: any) => String(t.user_identifier || "").trim())
          .filter((v) => v.length > 0),
      ),
    );
    const handoverCount = pendingHandovers.length;

    // Never ping when there is nothing to action
    if (openCount === 0 && handoverCount === 0) {
      return new Response(
        JSON.stringify({ ok: true, open_tickets: 0, pending_handovers: 0, sent: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parts: string[] = [];
    if (openCount > 0) {
      parts.push(`${openCount} open support ticket${openCount === 1 ? "" : "s"}`);
    }
    if (handoverCount > 0) {
      parts.push(
        `${handoverCount} human-requested chat${handoverCount === 1 ? "" : "s"} waiting: ${handoverList.join(", ")}`,
      );
    }
    const summary = parts.join(" | ");

    const payload = {
      user_name: "SaaSSuite Support Digest",
      account_email: "support@saassuite.ai",
      owner_email: "support@saassuite.ai",
      account_name: "SaaSSuite",
      agency_name: "SaaSSuite",
      plan: "Internal",
      agency_id: "digest",
      customer_identifier: "open-tickets-digest",
      last_message: summary,
      reason: `Scheduled digest: ${summary}`,
      attempt: 1,
      minutes_waiting: 0,
      reminder: true,
      digest: true,
      open_tickets: openCount,
      pending_handovers: handoverCount,
      handover_users: handoverList.join(", "),
      handover_users_list: handoverList,
      handover_requested_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
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
      console.error("open tickets digest webhook failed:", err);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        open_tickets: openCount,
        pending_handovers: handoverCount,
        handover_users: handoverList,
        sent: true,
        webhook_status: status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("open-tickets-digest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
