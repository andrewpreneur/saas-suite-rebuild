import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  EMAIL_MATCH_STATUSES,
  inboundRejectionLog,
  readInboundPayload,
  scalarText as str,
} from "./payload.ts";

// Inbound webhook: an agency's automation (e.g. email reply parser) POSTs a
// customer's reply here and it is added to the matching support ticket.
// URL: /functions/v1/inbound-ticket-reply/{agency_id}?key={inbound_reply_key}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("inbound-ticket-reply");
  const agencyFromUrl = str(parts[idx + 1] ?? url.searchParams.get("agency_id"), 120)?.toLowerCase() ?? null;
  const keyFromRequest = str(url.searchParams.get("key") ?? req.headers.get("x-webhook-key"), 120);

  // `secret` is used only to redact the webhook key if it ever appears in the reason. It is not logged.
  const reject = (status: 400 | 401 | 404, error: string, agencyForLog?: string | null, secret?: string | null) => {
    console.warn("inbound-ticket-reply rejected", inboundRejectionLog(status, error, agencyForLog ?? agencyFromUrl, secret ?? keyFromRequest));
    return json({ error }, status);
  };

  let p: Record<string, unknown> = {};
  try {
    const t = await req.text();
    if (t.trim()) {
      const parsed = JSON.parse(t);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reject(400, "Body must be a JSON object");
      p = parsed;
    }
  } catch {
    return reject(400, "Body must be JSON");
  }

  const agencyId = str(parts[idx + 1] ?? url.searchParams.get("agency_id") ?? p.agency_id, 120)?.toLowerCase();
  const key = str(url.searchParams.get("key") ?? req.headers.get("x-webhook-key") ?? p.key, 120);
  if (!agencyId || !/^[a-z0-9-]+$/.test(agencyId)) return reject(400, "agency_id missing in URL", agencyId, key);
  if (!key) return reject(401, "key missing", agencyId);

  const inbound = readInboundPayload(p);
  const email = inbound.email;
  const name = inbound.name;
  const body = inbound.body;
  const ticketId = inbound.ticketId;
  const ticketNumRaw = inbound.ticketNumber;
  if (!body) {
    return reject(400, "customer_reply must contain the customer's actual message text. Map the message text/body field, not the whole message object or [object Object].", agencyId, key);
  }
  if (!email && !ticketNumRaw && !ticketId) return reject(400, "Provide ticket_number or customer_email", agencyId, key);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Webhook temporarily unavailable" }, 503);
  const sb = createClient(supabaseUrl, serviceKey);
  const { data: acct } = await sb
    .from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, inbound_reply_key")
    .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
    .limit(1)
    .maybeSingle();
  if (!acct || acct.inbound_reply_key !== key) return reject(401, "Invalid agency or key", agencyId, key);
  const ids = [acct.agency_id, acct.agency_id_basic, acct.agency_id_advanced, acct.agency_id_elite]
    .filter(Boolean).flatMap((i: string) => [i, `${i}NO`]);

  let q = sb.from("support_tickets")
    .select("id, ticket_number, customer_name, customer_email, status")
    .in("agency_id", ids);
  const numericTicket = ticketNumRaw && /^\d+$/.test(ticketNumRaw) ? ticketNumRaw : null;
  if (ticketId) q = q.eq("id", ticketId);
  else if (numericTicket) q = q.eq("ticket_number", Number(numericTicket));
  else if (email) q = q.ilike("customer_email", email).in("status", [...EMAIL_MATCH_STATUSES]);
  else return reject(400, "Provide a valid ticket_number or customer_email", agencyId, key);
  // A ticket number or id is exact. Email-only replies use the customer's latest
  // ticket across all supported statuses, including tickets that must reopen.
  const ordered = ticketId || numericTicket
    ? q.order("created_at", { ascending: false })
    : q.order("updated_at", { ascending: false });
  const { data: tickets } = await ordered.limit(1);
  const ticket = tickets?.[0];
  if (!ticket) return reject(404, "Ticket not found for this agency", agencyId, key);

  // Ignore exact retries within 10 minutes.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dup } = await sb.from("support_ticket_replies").select("id")
    .eq("ticket_id", ticket.id).eq("sender_role", "customer").eq("body", body).gte("created_at", since).limit(1);
  if (dup?.length) return json({ ok: true, deduped: true, ticket_number: ticket.ticket_number });

  const { data: row, error } = await sb.from("support_ticket_replies").insert({
    ticket_id: ticket.id,
    sender_role: "customer",
    sender_name: name || ticket.customer_name,
    sender_email: email || ticket.customer_email,
    body,
  }).select("id").single();
  if (error) {
    console.error("insert reply failed", error);
    return json({ error: "Could not save reply" }, 500);
  }
  if (["closed", "resolved"].includes(String(ticket.status || "").toLowerCase())) {
    await sb.from("support_tickets").update({ status: "open" }).eq("id", ticket.id);
  }
  return json({ ok: true, reply_id: row.id, ticket_id: ticket.id, ticket_number: ticket.ticket_number });
});
