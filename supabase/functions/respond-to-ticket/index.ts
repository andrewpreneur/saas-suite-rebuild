import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isPlatformAdminEmail, serviceClient, json, corsHeaders } from "../_shared/admin-auth.ts";
import { findOwnerByAgency, resolvePerson, supportExtraFields } from "../_shared/support-context.ts";
import { ticketReplyHint, ticketUpdateSubject } from "../_shared/ticket-reply-match.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { supportBrandName, debrandSupportText } from "../_shared/ticket-update.ts";

// Reuse the human-handover webhook (same one notify-team-reply uses).
// The payload is flagged with source: "ticket_response" so the receiving
// automation sends a ticket-specific email (not a support-chat reply).
const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/OE1sYR1a8htFn9xA3l81/webhook-trigger/91894004-d606-43c3-9a70-3711dcfeba40";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: allow the platform admin OR the agency owner who owns the ticket.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);
  const token = authHeader.slice("Bearer ".length);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user?.email) return json({ error: "Invalid session" }, 401);
  const callerEmail = userData.user.email.toLowerCase();
  const isAdmin = isPlatformAdminEmail(callerEmail);

  try {
    const { ticket_id, response_text, attachment_url } = await req.json();
    if (!ticket_id || !response_text?.trim()) {
      return json({ error: "ticket_id and response_text required" }, 400);
    }

    const supabase = serviceClient();
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .maybeSingle();
    if (tErr || !ticket) return json({ error: "Ticket not found" }, 404);

    if (!isAdmin) {
      // Caller must be the owner of this ticket's agency or an accepted team admin
      // with edit access (checked by RLS-aware helpers under the caller's session).
      const { data: canAccess } = await userClient.rpc("can_access_agency", { p_agency_id: ticket.agency_id });
      const { data: canEdit } = await userClient.rpc("support_can_edit_ticket", {
        p_agency_id: ticket.agency_id,
        p_assigned_to: ticket.assigned_to,
      });
      if (!canAccess || canEdit === false) {
        return json({ error: "Not authorized for this ticket" }, 403);
      }
    }

    const owner = await findOwnerByAgency(supabase, ticket.agency_id);
    const responder = await resolvePerson(supabase, owner?.email ?? null, callerEmail);
    const brand = supportBrandName(owner);
    const responderName = responder?.name || (isAdmin ? (brand === "our" ? "Support" : `${brand} Support`) : callerEmail);

    // Save the response FIRST so the UI can return instantly, then do the slow
    // AI polish + email webhook in the background.
    const { error: uErr } = await supabase
      .from("support_tickets")
      .update({
        admin_response: response_text.trim(),
        admin_response_attachment_url: attachment_url || null,
        responded_at: new Date().toISOString(),
        responded_by: callerEmail,
        responded_by_name: responderName,
        status: "responded",
      })
      .eq("id", ticket_id);
    if (uErr) {
      console.error("Ticket update failed:", uErr);
      return json({ error: "Failed to save response" }, 500);
    }

    const deliver = async () => {
      // Ask AI to polish the response into a friendly email body.
      // If an image is attached we send it multimodally so the AI can reference it.
      let emailBody = response_text.trim();
      if (LOVABLE_API_KEY) {
        try {
          const userContent: any[] = [
            {
              type: "text",
              text: `Customer name: ${ticket.customer_name}\nTicket #${ticket.ticket_number} — ${ticket.issue_category}\nOriginal request: ${ticket.request_text}\n\nAdmin's response note:\n${response_text.trim()}${attachment_url ? "\n\nAn image is attached with this response — reference it naturally in the email if relevant (e.g. \"see the attached screenshot\")." : ""}`,
            },
          ];
          if (attachment_url) {
            userContent.push({ type: "image_url", image_url: { url: attachment_url } });
          }
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    `You are a friendly support agent for ${brand === "our" ? "the support team" : brand}. Never mention SaaSSuite or SaaS Suite. Rewrite the admin's note into a warm, concise TICKET UPDATE email to the customer. Keep the core message intact. Reference their ticket number. Do not invent facts. End the message with this exact instruction on its own line before the sign-off: 'To view the full response, log in to your portal, open Support, and scroll down to Tickets.' Sign off as '${brand === "our" ? "The Support Team" : `The ${brand} Support Team`}'. Return only the email body in plain text (no subject line).`,
                },
                { role: "user", content: userContent },
              ],
            }),
          });
          if (aiRes.ok) {
            const j = await aiRes.json();
            const txt = j?.choices?.[0]?.message?.content;
            if (typeof txt === "string" && txt.trim().length > 0) emailBody = txt.trim();
            emailBody = debrandSupportText(emailBody, brand);
          } else {
            console.warn("AI polish failed:", aiRes.status, await aiRes.text());
          }
        } catch (e) {
          console.warn("AI polish error:", e);
        }
      }

      const subject = ticketUpdateSubject(ticket.ticket_number);

      // Mirror the notify-team-reply payload shape so the same LC automation
      // can route it, but clearly flag it as a ticket response rather than a
      // live-chat handover reply.
      let extra: Record<string, unknown> = {};
      try {
        extra = await supportExtraFields(supabase, ticket.agency_id, {
          ticketAssignedTo: ticket.assigned_to,
          responderEmail: callerEmail,
        });
        extra.responder_name = responderName;
      } catch (e) {
        console.warn("extra fields failed:", e);
      }
      try {
        let targetUrl = WEBHOOK_URL;
        if (owner?.email) {
          const { data: ou } = await supabase.from("saas_suite_users")
            .select("customer_updates_webhook_url").ilike("email", owner.email).limit(1).maybeSingle();
          const cu = String((ou as any)?.customer_updates_webhook_url || "").trim();
          if (/^https:\/\//i.test(cu)) targetUrl = cu;
        }
        const webhookRes = await fetch(targetUrl, {
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
            our_message: emailBody,
            attachment_url: attachment_url || null,
            instructions:
              "This is a SUPPORT TICKET RESPONSE (not a live chat reply). Email the customer their ticket update and tell them to log in to their portal, open Support, and scroll down to Tickets to view the full response. If attachment_url is set, embed or link that image in the outgoing email.",
            agency_brand_name: brand === "our" ? null : brand,
            conversation_summary_week: "",
            conversation_summary_all_time: "",
            timestamp: new Date().toISOString(),
            ...extra,
            subject,
            ticket_number: ticket.ticket_number,
            reply_hint: ticketReplyHint(ticket.ticket_number),
          }),
        });
        await logCustomerMessage({
          userEmail: ticket.customer_email,
          channel: "webhook",
          templateKey: "ticket_response",
          subject,
          provider: "ghl",
          status: webhookRes.ok ? "sent" : "failed",
          source: "respond-to-ticket",
          detail: webhookRes.ok ? null : `http_${webhookRes.status}`,
        });
        if (!webhookRes.ok) {
          console.error("Email webhook failed:", webhookRes.status, await webhookRes.text());
        }
      } catch (e) {
        console.error("Email webhook error:", e);
        await logCustomerMessage({
          userEmail: ticket.customer_email,
          channel: "webhook",
          templateKey: "ticket_response",
          subject,
          provider: "ghl",
          status: "failed",
          source: "respond-to-ticket",
          detail: "request_failed",
        });
      }
    };

    // Fire-and-forget so the caller isn't blocked by AI + webhook latency.
    // @ts-ignore EdgeRuntime is available in Supabase edge functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(deliver());
    } else {
      deliver();
    }

    return json({ success: true, queued: true });
  } catch (e) {
    console.error("respond-to-ticket error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});