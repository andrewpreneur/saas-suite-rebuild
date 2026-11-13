import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendTicketUpdate } from "../_shared/ticket-update.ts";
import { compareCreatedAtThenId, recordTicketReply } from "./ticket-reply.ts";
import { filterPlatformQueue, isAgencyIdExcluded, loadExcludedAgencyIds } from "../_shared/platformSupportExcluded.ts";

/**
 * Admin-only support API covering every agency.
 * Auth: header `x-api-key: <ADMIN_SUPPORT_API_KEY>` or `?key=` or Bearer.
 *   GET  /chats          bulk chats   (filters: last_from, ai_responded, handover, agency_id, email, days, limit, include_messages)
 *   GET  /chat           one chat     (agency_id, email)
 *   POST /chats/reply    reply as team to a chat (same flow as the admin portal)
 *   GET  /tickets        bulk tickets (filters: last_from, status, responded, agency_id, email, days, limit, include_replies)
 *   GET  /ticket         one ticket   (ticket_number | ticket_id)
 *   POST /tickets/reply  reply as team to a ticket (saves + sends ticket update email)
 *   POST /tickets/update change status / assignee
 *   POST /tickets/customer-reply  add a customer reply to any ticket
 *   GET  /copilot/chats  recent Copilot conversations (days, handover=open)
 *   GET  /copilot/chat   one Copilot conversation (email or thread_id "copilot:<email>")
 *   POST /copilot/reply  reply as team inside Copilot (email|thread_id, message)
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const str = (v: unknown, max = 500) =>
  v === null || v === undefined ? null : String(v).trim().slice(0, max) || null;
const KEY = Deno.env.get("ADMIN_SUPPORT_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SR, { auth: { persistSession: false } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const ts = (v: string | null) => (v ? new Date(v).getTime() : 0);

function lastFromChat(t: any): "customer" | "ai" | "team" | null {
  const m = [
    ["customer", ts(t.last_user_message_at)],
    ["ai", ts(t.last_assistant_message_at)],
    ["team", ts(t.last_owner_message_at)],
  ].sort((a: any, b: any) => b[1] - a[1])[0] as [any, number];
  return m[1] ? m[0] : null;
}

async function chatMessages(agencyId: string, ident: string, limit = 100) {
  const [ai, team] = await Promise.all([
    sb.from("ai_chat_messages").select("role, content, created_at").eq("agency_id", agencyId)
      .ilike("user_identifier", ident).order("created_at", { ascending: false }).limit(limit),
    sb.from("agency_owner_messages").select("sender_name, content, created_at").eq("agency_id", agencyId)
      .ilike("user_identifier", ident).order("created_at", { ascending: false }).limit(limit),
  ]);
  return [
    ...(ai.data ?? []).map((m: any) => ({ from: m.role === "user" ? "customer" : "ai", content: m.content, created_at: m.created_at })),
    ...(team.data ?? []).map((m: any) => ({ from: "team", sender_name: m.sender_name, content: m.content, created_at: m.created_at })),
  ].sort((a, b) => ts(a.created_at) - ts(b.created_at)).slice(-limit);
}

const copilotFrom = (m: any) =>
  m.role === "user" ? "customer" : Array.isArray(m.actions) && m.actions.some((a: any) => a?.tool === "admin_reply") ? "team" : "ai";
const copilotEmail = (v: unknown) => {
  const e = String(v ?? "").trim().toLowerCase().replace(/^copilot:/, "");
  return /^[^\s@]+@[^\s@]+$/.test(e) && e.length <= 320 ? e : null;
};
async function copilotHidden(email: string, hidden: (id: string | null | undefined) => boolean) {
  const { data } = await sb.from("saas_suite_users").select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite").ilike("email", email).limit(1).maybeSingle();
  return !!data && [data.agency_id, data.agency_id_basic, data.agency_id_advanced, data.agency_id_elite].some((id) => id && hidden(id));
}

function shapeChat(t: any) {
  return {
    thread_id: t.id,
    agency_id: t.agency_id,
    customer: t.user_identifier,
    last_from: lastFromChat(t),
    ai_responded: !!t.last_assistant_message_at,
    team_responded: !!t.last_owner_message_at,
    handover_open: !!t.handover_requested_at && !t.handover_resolved_at,
    handover_requested_at: t.handover_requested_at,
    category: t.category,
    assigned_to_email: t.assigned_to_email,
    message_count: t.message_count,
    last_customer_message_at: t.last_user_message_at,
    last_ai_message_at: t.last_assistant_message_at,
    last_team_message_at: t.last_owner_message_at,
    updated_at: t.updated_at,
  };
}

async function listChats(u: URLSearchParams, excluded: Set<string>) {
  const days = Math.min(365, Math.max(1, Number(u.get("days")) || 30));
  const limit = Math.min(500, Math.max(1, Number(u.get("limit")) || 100));
  const ag = str(u.get("agency_id"), 120);
  if (ag && isAgencyIdExcluded(ag, excluded)) return { count: 0, chats: [] };
  let q = sb.from("chat_threads").select("*")
    .gte("updated_at", new Date(Date.now() - days * 864e5).toISOString())
    .order("updated_at", { ascending: false }).limit(2000);
  if (ag) q = q.eq("agency_id", ag);
  const em = str(u.get("email"), 320);
  if (em) q = q.ilike("user_identifier", em);
  if (u.get("handover") === "open") q = q.not("handover_requested_at", "is", null).is("handover_resolved_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = filterPlatformQueue((data ?? []).map(shapeChat), excluded);
  const lf = u.get("last_from");
  if (lf) rows = rows.filter((r) => lf.split(",").includes(String(r.last_from)));
  const ar = u.get("ai_responded");
  if (ar === "true" || ar === "false") rows = rows.filter((r) => r.ai_responded === (ar === "true"));
  const tr = u.get("team_responded");
  if (tr === "true" || tr === "false") rows = rows.filter((r) => r.team_responded === (tr === "true"));
  rows = rows.slice(0, limit);
  if (u.get("include_messages") === "true") {
    for (const r of rows as any[]) r.messages = await chatMessages(r.agency_id, r.customer, 30);
  }
  return { count: rows.length, chats: rows };
}

async function ticketReplies(ids: string[]) {
  if (!ids.length) return {} as Record<string, any[]>;
  const { data } = await sb.from("support_ticket_replies")
    .select("id, ticket_id, sender_role, sender_name, sender_email, body, created_at")
    .in("ticket_id", ids).order("created_at", { ascending: true }).order("id", { ascending: true });
  const by: Record<string, any[]> = {};
  for (const r of data ?? []) (by[r.ticket_id] ||= []).push(r);
  return by;
}

function shapeTicket(t: any, replies: any[], include: boolean) {
  const events = [
    { from: "customer", at: t.created_at, id: "" },
    ...(t.responded_at ? [{ from: "team", at: t.responded_at, id: "" }] : []),
    ...replies.map((r) => ({
      from: r.sender_role === "customer" ? "customer" : "team",
      at: r.created_at,
      id: String(r.id || ""),
    })),
  ].sort((a, b) => compareCreatedAtThenId({ created_at: a.at, id: a.id }, { created_at: b.at, id: b.id }));
  const latest = events[events.length - 1];
  const publicReplies = replies.map((row: any) => {
    const { id, ...rest } = row;
    void id;
    return rest;
  });
  return {
    ticket_id: t.id,
    ticket_number: t.ticket_number,
    agency_id: t.agency_id,
    customer_name: t.customer_name,
    customer_email: t.customer_email,
    category: t.issue_category,
    status: t.status,
    request_text: t.request_text,
    last_from: latest?.from ?? "customer",
    last_activity_at: latest?.at ?? t.created_at,
    responded: !!t.responded_at || replies.some((r) => r.sender_role !== "customer"),
    latest_team_response: t.admin_response,
    assigned_to: t.assigned_to,
    source_chat: t.source_chat_identifier,
    created_at: t.created_at,
    reply_count: replies.length,
    ...(include ? { replies: publicReplies } : {}),
  };
}

async function listTickets(u: URLSearchParams, excluded: Set<string>) {
  const days = Math.min(365, Math.max(1, Number(u.get("days")) || 30));
  const limit = Math.min(500, Math.max(1, Number(u.get("limit")) || 100));
  const ag = str(u.get("agency_id"), 120);
  if (ag && isAgencyIdExcluded(ag, excluded)) return { count: 0, tickets: [] };
  let q = sb.from("support_tickets").select("*")
    .gte("updated_at", new Date(Date.now() - days * 864e5).toISOString())
    .order("updated_at", { ascending: false }).limit(1000);
  if (ag) q = q.eq("agency_id", ag);
  const em = str(u.get("email"), 320);
  if (em) q = q.ilike("customer_email", em);
  const st = u.get("status");
  if (st) q = q.in("status", st.split(","));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = filterPlatformQueue(data ?? [], excluded);
  const by = await ticketReplies(rows.map((r: any) => r.id));
  let out = rows.map((t: any) => shapeTicket(t, by[t.id] ?? [], u.get("include_replies") === "true"));
  const lf = u.get("last_from");
  if (lf) out = out.filter((r) => lf.split(",").includes(r.last_from));
  const rp = u.get("responded");
  if (rp === "true" || rp === "false") out = out.filter((r) => r.responded === (rp === "true"));
  out = out.slice(0, limit);
  return { count: out.length, tickets: out };
}

async function findTicket(p: Record<string, unknown>) {
  const id = str(p.ticket_id, 60);
  const num = str(p.ticket_number, 20)?.replace(/^#/, "");
  let q = sb.from("support_tickets").select("*");
  if (id) q = q.eq("id", id);
  else if (num && /^\d+$/.test(num)) q = q.eq("ticket_number", Number(num));
  else return null;
  const { data } = await q.limit(1).maybeSingle();
  return data;
}

async function readBody(req: Request) {
  const t = await req.text();
  return t.trim() ? JSON.parse(t) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!KEY) return json({ error: "ADMIN_SUPPORT_API_KEY is not configured" }, 500);
  const url = new URL(req.url);
  const provided = req.headers.get("x-api-key") || url.searchParams.get("key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || !safeEqual(provided, KEY)) return json({ error: "Unauthorized" }, 401);
  const route = "/" + url.pathname.replace(/^.*admin-support-api\/?/, "").replace(/^\/+|\/+$/g, "");
  const u = url.searchParams;

  try {
    let excluded: Set<string>;
    try {
      excluded = await loadExcludedAgencyIds(sb);
    } catch (exclusionError) {
      console.error("admin-support-api exclusion check failed", exclusionError);
      return json({ error: "platform support exclusion list unavailable" }, 503);
    }
    const hidden = (agencyId: string | null | undefined) => isAgencyIdExcluded(agencyId, excluded);
    let p: Record<string, any> = {};
    if (req.method === "POST") {
      try { p = await readBody(req); } catch { return json({ error: "Body must be JSON" }, 400); }
    }
    switch (`${req.method} ${route}`) {
      case "GET /chats": return json(await listChats(u, excluded));
      case "GET /chat": {
        const ag = str(u.get("agency_id"), 120), em = str(u.get("email"), 320);
        if (!ag || !em) return json({ error: "agency_id and email required" }, 400);
        if (hidden(ag)) return json({ chat: null, messages: [] });
        const { data: t } = await sb.from("chat_threads").select("*").eq("agency_id", ag).ilike("user_identifier", em).maybeSingle();
        return json({ chat: t ? shapeChat(t) : null, messages: await chatMessages(ag, em, 200) });
      }
      case "POST /chats/reply": {
        const ag = str(p.agency_id, 120), em = str(p.customer_email ?? p.email, 320)?.toLowerCase();
        const msg = str(p.message, 10000);
        if (!ag || !em || !msg) return json({ error: "agency_id, customer_email and message required" }, 400);
        if (hidden(ag)) return json({ error: "Not in the platform support queue" }, 404);
        const since = new Date(Date.now() - 10 * 60e3).toISOString();
        const { data: dup } = await sb.from("agency_owner_messages").select("id").eq("agency_id", ag)
          .eq("user_identifier", em).eq("content", msg).gte("created_at", since).limit(1);
        if (dup?.length) return json({ ok: true, deduped: true });
        const { data: row, error } = await sb.from("agency_owner_messages").insert({
          agency_id: ag, user_identifier: em, content: msg, sender_type: "agency_owner",
          sender_name: str(p.sender_name, 200) ?? "SaaS Suite", sender_email: str(p.sender_email, 320),
        }).select("id").single();
        if (error) return json({ error: error.message }, 500);
        let notified = false;
        if (p.notify !== false) {
          const r = await fetch(`${SB_URL}/functions/v1/notify-team-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SR}`, apikey: SR },
            body: JSON.stringify({ agency_id: ag, user_identifier: em, our_message: msg }),
          }).catch(() => null);
          notified = !!r?.ok;
        }
        return json({ ok: true, message_id: row.id, email_notification_sent: notified });
      }
      // Copilot (agency-owner AI) conversations. The handover webhook sends
      // thread_id "copilot:<owner email>"; use these to read and answer them.
      case "GET /copilot/chats": {
        const days = Math.min(30, Math.max(1, Number(u.get("days")) || 2));
        const { data, error } = await sb.from("copilot_chat_messages").select("owner_email, role, content, actions, created_at")
          .gte("created_at", new Date(Date.now() - days * 864e5).toISOString()).order("created_at", { ascending: false }).limit(2000);
        if (error) return json({ error: error.message }, 500);
        const by = new Map<string, any>();
        for (const m of data ?? []) {
          const e = String(m.owner_email).toLowerCase();
          const row = by.get(e) ?? { owner_email: e, thread_id: `copilot:${e}`, last_message_at: m.created_at, last_from: copilotFrom(m), last_message: String(m.content).slice(0, 300), handover: false };
          if (/\[\[widget:human_help\]\]/.test(m.content || "")) row.handover = true;
          by.set(e, row);
        }
        let rows = [...by.values()];
        if (u.get("handover") === "open") rows = rows.filter((r) => r.handover && r.last_from !== "team");
        const visible = [];
        for (const r of rows) if (!(await copilotHidden(r.owner_email, hidden))) visible.push(r);
        return json({ count: visible.length, chats: visible });
      }
      case "GET /copilot/chat": {
        const em = copilotEmail(u.get("email") ?? u.get("thread_id"));
        if (!em) return json({ error: "email or thread_id required" }, 400);
        if (await copilotHidden(em, hidden)) return json({ owner_email: em, messages: [] });
        const { data } = await sb.from("copilot_chat_messages").select("role, content, actions, created_at")
          .eq("owner_email", em).order("created_at", { ascending: false }).limit(Math.min(200, Number(u.get("limit")) || 60));
        return json({ owner_email: em, thread_id: `copilot:${em}`, messages: (data ?? []).reverse().map((m: any) => ({ from: copilotFrom(m), content: m.content, created_at: m.created_at })) });
      }
      case "POST /copilot/reply": {
        const em = copilotEmail(p.email ?? p.owner_email ?? p.thread_id);
        const msg = str(p.message, 10000);
        if (!em || !msg) return json({ error: "email (or thread_id) and message required" }, 400);
        if (await copilotHidden(em, hidden)) return json({ error: "Not in the platform support queue" }, 404);
        const since = new Date(Date.now() - 10 * 60e3).toISOString();
        const { data: dup } = await sb.from("copilot_chat_messages").select("id").eq("owner_email", em).eq("content", msg).gte("created_at", since).limit(1);
        if (dup?.length) return json({ ok: true, deduped: true });
        const { data: row, error } = await sb.from("copilot_chat_messages").insert({
          owner_email: em, role: "assistant", content: msg,
          actions: [{ tool: "admin_reply", args: {}, message: `Reply from ${str(p.sender_name, 200) ?? "SaaS Suite"}` }],
        }).select("id").single();
        if (error) return json({ error: error.message }, 500);
        let notified = false;
        if (p.notify !== false) {
          const r = await fetch(`${SB_URL}/functions/v1/notify-team-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SR}`, apikey: SR },
            body: JSON.stringify({ source: "copilot", owner_email: em, our_message: msg }),
          }).catch(() => null);
          notified = !!r?.ok;
        }
        return json({ ok: true, message_id: row.id, email_notification_sent: notified });
      }
      case "GET /tickets": return json(await listTickets(u, excluded));
      case "GET /ticket": {
        const t = await findTicket({ ticket_id: u.get("ticket_id"), ticket_number: u.get("ticket_number") });
        if (!t || hidden(t.agency_id)) return json({ error: "Ticket not found" }, 404);
        const by = await ticketReplies([t.id]);
        return json({ ticket: shapeTicket(t, by[t.id] ?? [], true) });
      }
      case "POST /tickets/reply": {
        const t = await findTicket(p);
        const msg = str(p.message, 10000);
        if (!t || hidden(t.agency_id)) return json({ error: "Ticket not found (send ticket_number or ticket_id)" }, 404);
        if (!msg) return json({ error: "message required" }, 400);
        const name = str(p.sender_name, 200) ?? "SaaS Suite";
        const result = await recordTicketReply({
          ticket: { id: t.id, ticket_number: t.ticket_number },
          message: msg,
          senderName: name,
          senderEmail: str(p.sender_email, 320),
          status: str(p.status, 40),
          notify: p.notify !== false,
          findRecentDuplicate: async (ticketId, message, sinceIso) => {
            const { data: dup } = await sb.from("support_ticket_replies").select("id").eq("ticket_id", ticketId)
              .neq("sender_role", "customer").eq("body", message).gte("created_at", sinceIso)
              .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
            return dup?.[0]?.id ?? null;
          },
          insertReply: async (row) => {
            const { data, error } = await sb.from("support_ticket_replies").insert(row).select("id").single();
            if (error) throw new Error(error.message);
            return data.id as string;
          },
          updateTicket: async (ticketId, patch) => {
            await sb.from("support_tickets").update(patch).eq("id", ticketId);
          },
          sendCustomerEmail: (message, responderName) => sendTicketUpdate(sb, t, message, { responderName }),
        });
        return json(result);
      }
      case "POST /tickets/customer-reply": {
        const t = await findTicket(p);
        const msg = str(p.customer_reply ?? p.message, 10000);
        if (!t || hidden(t.agency_id)) return json({ error: "Ticket not found" }, 404);
        if (!msg) return json({ error: "customer_reply required" }, 400);
        const { data: row, error } = await sb.from("support_ticket_replies").insert({
          ticket_id: t.id, sender_role: "customer",
          sender_name: str(p.customer_name, 200) ?? t.customer_name,
          sender_email: str(p.customer_email, 320) ?? t.customer_email, body: msg,
        }).select("id").single();
        if (error) return json({ error: error.message }, 500);
        if (["closed", "resolved"].includes(String(t.status).toLowerCase())) {
          await sb.from("support_tickets").update({ status: "open" }).eq("id", t.id);
        }
        return json({ ok: true, reply_id: row.id, ticket_number: t.ticket_number });
      }
      case "POST /tickets/update": {
        const t = await findTicket(p);
        if (!t || hidden(t.agency_id)) return json({ error: "Ticket not found" }, 404);
        const patch: Record<string, unknown> = {};
        if (p.status) patch.status = str(p.status, 40);
        if (p.assigned_to !== undefined) {
          patch.assigned_to = str(p.assigned_to, 320)?.toLowerCase() ?? null;
          patch.assigned_at = new Date().toISOString();
          patch.assigned_by = "admin-support-api";
        }
        if (!Object.keys(patch).length) return json({ error: "Send status and/or assigned_to" }, 400);
        const { error } = await sb.from("support_tickets").update(patch).eq("id", t.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, ticket_number: t.ticket_number, updated: patch });
      }
      default:
        return json({ error: `Unknown route ${req.method} ${route}` }, 404);
    }
  } catch (e) {
    console.error("admin-support-api", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
