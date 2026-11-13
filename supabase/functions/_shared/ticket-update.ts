import { findOwnerByAgency, supportExtraFields } from "./support-context.ts";
import { ticketReplyHint, ticketUpdateSubject } from "./ticket-reply-match.ts";
import { logCustomerMessage } from "./journey-log.ts";

const DEFAULT_WEBHOOK =
  "https://services.leadconnectorhq.com/hooks/OE1sYR1a8htFn9xA3l81/webhook-trigger/91894004-d606-43c3-9a70-3711dcfeba40";

/** Fires the same customer "ticket update" email webhook used by respond-to-ticket. */
/** Customer-facing support text must only name the agency, never SaaSSuite. */
export function supportBrandName(owner: any): string {
  const n = String(owner?.agency_name || "").trim();
  return n && !/saas\s*suite/i.test(n) ? n : "our";
}
export function debrandSupportText(text: string, brand: string): string {
  const b = brand === "our" ? "" : brand;
  return String(text || "")
    .replace(/the\s+saas\s*suite\s+support\s+team/gi, b ? `The ${b} Support Team` : "The Support Team")
    .replace(/saas\s*suite\s+support/gi, b ? `${b} Support` : "Support")
    .replace(/log in to saas\s*suite/gi, "log in to your portal")
    .replace(/saas\s*suite/gi, b || "our team");
}

export async function sendTicketUpdate(
  supabase: any,
  ticket: any,
  message: string,
  opts: { responderEmail?: string | null; responderName?: string | null; attachmentUrl?: string | null } = {},
) {
  let extra: Record<string, unknown> = {};
  try {
    extra = await supportExtraFields(supabase, ticket.agency_id, {
      ticketAssignedTo: ticket.assigned_to,
      responderEmail: opts.responderEmail ?? ticket.assigned_to,
    });
    if (opts.responderName) extra.responder_name = opts.responderName;
  } catch (e) {
    console.warn("extra fields failed:", e);
  }
  let targetUrl = DEFAULT_WEBHOOK;
  const owner = await findOwnerByAgency(supabase, ticket.agency_id).catch(() => null);
  const brand = supportBrandName(owner);
  message = debrandSupportText(message, brand);
  if (owner?.email) {
    const { data: ou } = await supabase.from("saas_suite_users")
      .select("customer_updates_webhook_url").ilike("email", owner.email).limit(1).maybeSingle();
    const cu = String((ou as any)?.customer_updates_webhook_url || "").trim();
    if (/^https:\/\//i.test(cu)) targetUrl = cu;
  }
  const res = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "ticket_response",
      is_ticket: true,
      customer_email: ticket.customer_email,
      customer_name: ticket.customer_name,
      agency_owner_email: ticket.customer_email,
      agency_id: ticket.agency_id,
      issue_category: ticket.issue_category,
      their_last_message: ticket.request_text,
      our_message: message,
      attachment_url: opts.attachmentUrl || null,
      instructions:
        "This is a SUPPORT TICKET RESPONSE (not a live chat reply). Email the customer their ticket update and tell them to log in to their portal, open Support, and scroll down to Tickets to view the full response. If attachment_url is set, embed or link that image in the outgoing email.",
      agency_brand_name: brand === "our" ? null : brand,
      instructions_note: "Never mention SaaSSuite; only use the agency's name.",
      conversation_summary_week: "",
      conversation_summary_all_time: "",
      timestamp: new Date().toISOString(),
      ...extra,
      subject: ticketUpdateSubject(ticket.ticket_number),
      ticket_number: ticket.ticket_number,
      reply_hint: ticketReplyHint(ticket.ticket_number),
    }),
  });
  if (!res.ok) console.error("Ticket update webhook failed:", res.status, await res.text());
  await logCustomerMessage({
    userEmail: ticket.customer_email,
    channel: "webhook",
    templateKey: "ticket_update",
    subject: ticketUpdateSubject(ticket.ticket_number),
    provider: "ghl",
    status: res.ok ? "sent" : "failed",
    source: "ticket-update",
    detail: res.ok ? null : `http_${res.status}`,
  });
  return res.ok;
}

export const chatTicketUpdateMessage = (t: any) =>
  `Hi ${t.customer_name},\n\nWe've opened support ticket #${t.ticket_number} (${t.issue_category}) from your recent chat so our team can follow up properly. We'll update you here as soon as we have progress.\n\nTo view the full response, log in to your portal, open Support, and scroll down to Tickets.\n\nThe Support Team`;
