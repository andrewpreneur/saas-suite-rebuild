// Support alerts for tickets and chats. Called by database triggers; only trusts IDs and
// re-reads everything from the database.
//  - Internal alerts webhook (same one as human handovers): new tickets, customer ticket
//    replies, new messages on assigned chats, and assignments. Uses the handover payload
//    shape plus recipient fields so the automation notifies the assignee (or the agency
//    owner by default when the agency handles support itself), not SaaS Suite.
//  - "You've been assigned" webhook: only when someone is assigned to a ticket or chat.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { findOwnerByAgency, resolvePerson } from "../_shared/support-context.ts";
import { isAiAutoOpenedHandoverTicket, notifyGlobalHandoverFromEnv } from "../_shared/globalHandoverWebhook.ts";
import { agencyAssigneeWebhookSends, platformLeadConnectorDecision, readPlatformSupportExclusion } from "../_shared/platformSupportExcluded.ts";
import { isPublicSupportTicket, supportTicketAlertNeedsOwner } from "../_shared/publicSupportTicket.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const INTERNAL_ALERTS_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9";
const ASSIGNED_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/OE1sYR1a8htFn9xA3l81/webhook-trigger/ce94557d-dfbf-45d2-861f-96b6d12cfb47";
const SAASSUITE_SUPPORT = { name: "SaaSSuite", email: "team@yoursoftwareonboarding.com", phone: null as string | null };
const CHAT_THROTTLE_MIN = 10;
const EXCLUDED_AGENCY_IDS = ["a743d34996b944f4bc91beb15ab6c11b", "test-rpc", "test-rls"];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function post(url: string, payload: unknown) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.status;
  } catch (e) {
    return String(e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { event, data } = await req.json().catch(() => ({}));
    const allowed = ["ticket_created", "ticket_assigned", "ticket_message", "chat_assigned", "chat_message"];
    if (!allowed.includes(event)) return json({ error: "bad event" }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const isTicket = event.startsWith("ticket");
    const isAssignment = event === "ticket_assigned" || event === "chat_assigned";

    let agencyId = "";
    let assignedEmail: string | null = null;
    let assignedBy: string | null = null;
    let customerEmail = "";
    let customerName = "";
    let lastMessage = "";
    let ticket: any = null;

    if (isTicket) {
      const { data: t } = await supabase.from("support_tickets").select("*").eq("id", data?.ticket_id).maybeSingle();
      if (!t) return json({ ok: true, skipped: "ticket not found" });
      ticket = t;
      agencyId = t.agency_id;
      assignedEmail = t.assigned_to;
      assignedBy = t.assigned_by ?? null;
      customerEmail = t.customer_email;
      customerName = t.customer_name;
      lastMessage = t.request_text;
      if (event === "ticket_message" && data?.reply_id) {
        const { data: r } = await supabase.from("support_ticket_replies").select("body").eq("id", data.reply_id).maybeSingle();
        if (r?.body) lastMessage = r.body;
      }
    } else {
      agencyId = String(data?.agency_id || "");
      customerEmail = String(data?.user_identifier || "");
      const { data: a } = await supabase
        .from("support_chat_assignments")
        .select("assigned_to_email, assigned_by")
        .eq("agency_id", agencyId)
        .ilike("user_identifier", customerEmail)
        .maybeSingle();
      assignedEmail = a?.assigned_to_email ?? null;
      assignedBy = a?.assigned_by ?? null;
      const { data: up } = await supabase.from("user_progress").select("name").ilike("email", customerEmail).limit(1).maybeSingle();
      customerName = (up as any)?.name || customerEmail;
      if (data?.message_id) {
        const { data: m } = await supabase.from("ai_chat_messages").select("content").eq("id", data.message_id).maybeSingle();
        lastMessage = m?.content ?? "";
      }
    }
    if (EXCLUDED_AGENCY_IDS.includes(agencyId)) return json({ ok: true, skipped: "test agency" });

    // AI opened this ticket because nobody was available to take the chat.
    // Extra global webhook for every agency. The LeadConnector alert below is unchanged.
    if (event === "ticket_created" && isAiAutoOpenedHandoverTicket(ticket?.request_text)) {
      try {
        await notifyGlobalHandoverFromEnv({
          event: "ticket_auto_opened",
          agencyId,
          customerEmail,
          customerName,
          userIdentifier: customerEmail,
          ticketNumber: ticket?.ticket_number ?? null,
          lastCustomerMessage: ticket?.request_text || lastMessage,
          timestamp: ticket?.created_at,
        }, supabase);
      } catch (handoverError) {
        console.error("global handover webhook failed", handoverError);
      }
    }

    const { data: ownerFull } = await supabase
      .from("saas_suite_users")
      .select("plan, human_chat_mode, support_email_alerts")
      .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
      .limit(1)
      .maybeSingle();
    const owner = await findOwnerByAgency(supabase, agencyId);
    // Public form tickets have no agency account. Still send the SaaS Suite
    // new-ticket alert (the same managed-support path) instead of skipping.
    const publicSupport = isTicket && isPublicSupportTicket(ticket);
    if (!owner && supportTicketAlertNeedsOwner(isTicket ? ticket : null)) {
      return json({ ok: true, skipped: "no owner" });
    }
    const ownerEmail = owner ? String(owner.email).toLowerCase() : SAASSUITE_SUPPORT.email;
    const mode: string = publicSupport ? "managed" : ((ownerFull as any)?.human_chat_mode || "self");
    const accountName = owner?.agency_name || owner?.full_name || (publicSupport ? "Public support" : ownerEmail);
    const agencyName = owner?.agency_name || (publicSupport ? "Public support" : "Not set");
    const accountOwnerName = owner?.full_name ?? (publicSupport ? SAASSUITE_SUPPORT.name : null);
    const accountOwnerPhone = owner?.bonuses_phone ?? null;
    const assignee = await resolvePerson(supabase, ownerEmail, assignedEmail);

    // Unassigned + chat messages: only assigned chats (or owners who want all chats) get message alerts.
    if (event === "chat_message" && !assignee && !owner.notify_all_chats) return json({ ok: true, skipped: "unassigned chat message" });

    // Who should be notified: the assignee; otherwise the owner (agency handles it) or SaaS Suite (we handle it).
    // "We Handle & Respond" (managed): SaaSSuite is always the assigned party.
    let notifyTarget: "assignee" | "owner_default" | "saassuite";
    let recipient: { name: string | null; email: string; phone: string | null; role: string };
    if (mode === "managed") {
      notifyTarget = "saassuite";
      recipient = { ...SAASSUITE_SUPPORT, role: "saassuite" };
    } else if (assignee) {
      notifyTarget = "assignee";
      recipient = { name: assignee.name, email: assignee.email, phone: assignee.phone, role: assignee.email === ownerEmail ? "owner" : "admin" };
    } else {
      notifyTarget = "owner_default";
      recipient = { name: owner.full_name, email: ownerEmail, phone: owner.bonuses_phone, role: "owner" };
    }
    const effAssignee = notifyTarget === "saassuite"
      ? SAASSUITE_SUPPORT
      : assignee ?? { name: owner.full_name, email: ownerEmail, phone: owner.bonuses_phone };

    const recipientNotifyEnabled =
      recipient.role === "admin"
        ? !!(isTicket ? assignee?.admin?.notify_assigned_tickets : assignee?.admin?.notify_assigned_chats)
        : recipient.role === "owner"
          ? (isTicket ? !!(owner.notify_all_tickets || owner.notify_assigned_tickets) : !!owner.notify_all_chats) || notifyTarget === "owner_default"
          : true;

    if (event === "chat_message") {
      const cutoff = new Date(Date.now() - CHAT_THROTTLE_MIN * 60000).toISOString();
      const key = `${customerEmail.toLowerCase()}::${recipient.email}`;
      const { data: th } = await supabase.from("team_reply_webhook_throttle").select("id, last_sent_at")
        .eq("source", "assignee_chat").eq("agency_id", agencyId).eq("identifier", key).maybeSingle();
      if (th?.last_sent_at && th.last_sent_at > cutoff) return json({ ok: true, skipped: "throttled" });
      if (th) await supabase.from("team_reply_webhook_throttle").update({ last_sent_at: new Date().toISOString() }).eq("id", th.id);
      else await supabase.from("team_reply_webhook_throttle").insert({ source: "assignee_chat", agency_id: agencyId, identifier: key, last_sent_at: new Date().toISOString() });
    }

    const who = effAssignee?.name || effAssignee?.email || "Unassigned";
    const reason = {
      ticket_created: `New support ticket #${ticket?.ticket_number}`,
      ticket_assigned: `Ticket #${ticket?.ticket_number} assigned to ${who}`,
      ticket_message: `Customer replied to ticket #${ticket?.ticket_number}`,
      chat_assigned: `Chat with ${customerName} assigned to ${who}`,
      chat_message: `New chat message from ${customerName}`,
    }[event as string];
    const now = new Date().toISOString();
    const assignedByPerson = await resolvePerson(supabase, ownerEmail, assignedBy);

    // Same base shape as the human handover payload, plus recipient/assignee fields.
    const internalPayload = {
      user_name: customerName,
      account_email: ownerEmail,
      owner_email: ownerEmail,
      account_name: accountName,
      agency_name: agencyName,
      plan: (ownerFull as any)?.plan || (publicSupport ? "Public" : "Unknown"),
      agency_id: agencyId,
      customer_identifier: customerEmail,
      last_message: String(lastMessage || "").slice(0, 500),
      reason,
      attempt: 1,
      minutes_waiting: 0,
      reminder: false,
      handover_requested_at: now,
      timestamp: now,
      // Added fields
      notification_type: "support_alert",
      event_type: event,
      is_ticket: isTicket,
      ticket_reply: event === "ticket_message",
      ticket_number: ticket?.ticket_number ?? null,
      ticket_id: ticket?.id ?? null,
      ticket_category: ticket?.issue_category ?? null,
      ticket_source: ticket?.source ?? null,
      contact_name: customerName,
      contact_email: customerEmail,
      human_chat_mode: mode,
      handled_by: mode === "managed" ? "saassuite" : "agency",
      notify_target: notifyTarget,
      assigned_default: notifyTarget === "owner_default",
      recipient_role: recipient.role,
      recipient_name: recipient.name,
      recipient_email: recipient.email,
      recipient_phone: recipient.phone,
      recipient_notify_enabled: recipientNotifyEnabled,
      assigned_to_name: effAssignee?.name ?? null,
      assigned_to_email: effAssignee?.email ?? null,
      assigned_to_phone: effAssignee?.phone ?? null,
      account_owner_name: accountOwnerName,
      account_owner_email: ownerEmail,
      account_owner_phone: accountOwnerPhone,
      login_url: "https://saassuite.ai/app/support",
    };
    // Per-person email channel preference (Support → Notifications tab). Missing key = on.
    const alertKey = {
      ticket_created: assignedEmail ? "alert_assigned_ticket" : "alert_new_unassigned_tickets",
      ticket_assigned: "alert_assigned_ticket",
      ticket_message: "alert_assigned_updates",
      chat_assigned: "alert_assigned_chat",
      chat_message: assignedEmail ? "alert_assigned_updates" : "alert_new_unassigned_chats",
    }[event as string];
    let emailPrefs: any = (ownerFull as any)?.support_email_alerts;
    if (recipient.role === "admin") {
      const { data: ap } = await supabase.from("account_admins").select("support_email_alerts")
        .ilike("admin_email", recipient.email).ilike("owner_email", ownerEmail).limit(1).maybeSingle();
      emailPrefs = (ap as any)?.support_email_alerts;
    }
    const emailOn = recipient.role === "saassuite" ? true : alertKey ? (emailPrefs?.[alertKey] !== false) : true;

    const results: Record<string, unknown> = {};
    // Agencies that handle support themselves ("self") only get their own
    // configured webhooks — never SaaS Suite's internal alert webhook.
    // Excluded owners also skip that platform ping (fail closed if the lookup errors).
    // The assignee webhook below is the agency's own alert and does not use this list.
    const isPlatform = ownerEmail === "andrew@dna-media.net";
    const exclusion = mode === "managed" || isPlatform
      ? await readPlatformSupportExclusion(supabase, agencyId)
      : "allowed" as const;
    const internalDecision = platformLeadConnectorDecision({
      exclusion,
      mode,
      ownerIsPlatformAccount: isPlatform,
      emailAlertsOn: emailOn,
    });
    if (internalDecision === "skip-self-managed") {
      results.internal = "skipped: agency handles its own support";
    } else if (internalDecision === "skip-excluded") {
      results.internal = "skipped: platform support excluded";
    } else if (internalDecision === "skip-email-off") {
      results.internal = "skipped: email alerts off for " + alertKey;
    } else {
      results.internal = await post(INTERNAL_ALERTS_WEBHOOK_URL, internalPayload);
    }

    if (agencyAssigneeWebhookSends(isAssignment, !!assignee) && assignee) {
      const assignedPayload = {
        notification_type: "assigned",
        event_type: event,
        item_type: isTicket ? "ticket" : "chat",
        title: isTicket ? `You've been assigned to ticket #${ticket?.ticket_number}` : `You've been assigned to a chat with ${customerName}`,
        contact_name: customerName,
        contact_email: customerEmail,
        assignee_name: assignee.name,
        assignee_email: assignee.email,
        assignee_phone: assignee.phone,
        assigned_by_name: assignedByPerson?.name ?? null,
        assigned_by_email: assignedByPerson?.email ?? null,
        self_assigned: !!assignedByPerson && assignedByPerson.email === assignee.email,
        ticket_number: ticket?.ticket_number ?? null,
        ticket_id: ticket?.id ?? null,
        ticket_category: ticket?.issue_category ?? null,
        last_message: String(lastMessage || "").slice(0, 500),
        account_name: accountName,
        agency_id: agencyId,
        account_owner_name: accountOwnerName,
        account_owner_email: ownerEmail,
        account_owner_phone: accountOwnerPhone,
        login_url: "https://saassuite.ai/app/support",
        timestamp: now,
      };
      results.assigned = await post(ASSIGNED_WEBHOOK_URL, assignedPayload);
    }

    console.log("[notify-support-assignee]", event, agencyId, JSON.stringify(results));
    return json({ ok: true, results });
  } catch (e) {
    console.error("notify-support-assignee error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
