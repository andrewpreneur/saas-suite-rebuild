import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import {
  mayCreateChatTicket,
  mayCreateManualTicket,
  chatTranscript,
  manualTicketRequest,
  resolvedChatIdentifier,
  ticketInsertFields,
  ticketConfirmationText,
  manualTicketUpdateMessage,
} from "./contract.ts";
import { sendTicketUpdate, chatTicketUpdateMessage } from "../_shared/ticket-update.ts";
import { ghlEmailClaims } from "../_shared/ghl-email-claim.ts";
import { ghlEmailDedupeKey, postGhlEmailEvent } from "../_shared/ghl-email-webhook.ts";

const ChatTicketSchema = z.object({
  request_id: z.string().uuid(),
  agency_id: z.string().trim().min(1).max(255),
  user_identifier: z.string().trim().min(1).max(320).optional(),
  customer_name: z.string().trim().min(1).max(255),
  customer_email: z.string().trim().toLowerCase().email().max(320),
  issue_category: z.string().trim().min(1).max(80),
  request_text: z.string().trim().min(1).max(20000),
  attachment_urls: z.array(z.string().url().startsWith("https://")).max(10).default([]),
  source: z.literal("agency_manual").optional(),
}).superRefine((value, ctx) => {
  if (value.source !== "agency_manual" && !value.user_identifier) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["user_identifier"], message: "Required" });
  }
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...corsHeaders, "Content-Type": "application/json"}});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
  if (req.method !== "POST") return json({error: "Method not allowed"}, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({error: "Support service unavailable"}, 503);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({error: "Sign in required"}, 401);
  const caller = createClient(url, anon, {global: {headers: {Authorization: authorization}}});
  const {data: auth, error: authError} = await caller.auth.getUser();
  if (authError || !auth.user?.email) return json({error: "Sign in required"}, 401);
  const email = auth.user.email.trim().toLowerCase();
  const db = createClient(url, service);
  try {
    const parsed = ChatTicketSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({error: "Check customer details and ticket description", details: parsed.error.flatten()}, 400);
    const b = parsed.data;
    const manual = manualTicketRequest(b.source);
    const identifier = resolvedChatIdentifier({
      source: b.source,
      userIdentifier: b.user_identifier,
      customerEmail: b.customer_email,
    });
    if (!identifier) return json({error: "Check customer details and ticket description"}, 400);
    const [agency, chat, ticketPermission] = await Promise.all([
      caller.rpc("can_access_agency", {p_agency_id: b.agency_id}),
      caller.rpc("support_can_see_chat", {p_agency_id: b.agency_id, p_user_identifier: identifier}),
      caller.rpc("support_can_edit_ticket", {p_agency_id: b.agency_id, p_assigned_to: email}),
    ]);
    if (manual) {
      if (!mayCreateManualTicket(agency.data, ticketPermission.data)) return json({error: "You need access to this agency and permission to create tickets"}, 403);
    } else if (!mayCreateChatTicket(agency.data, chat.data, ticketPermission.data)) {
      return json({error: "You need access to this chat and permission to create tickets"}, 403);
    }
    const {data: existing, error: existingError} = await db.from("support_tickets").select("*").eq("id", b.request_id).maybeSingle();
    if (existingError) throw existingError;
    if (existing && (existing.agency_id !== b.agency_id || existing.source_chat_identifier !== identifier || existing.assigned_by !== email)) return json({error: "Ticket request does not match"}, 409);
    let ticket = existing;
    if (!ticket) {
      let transcript = "";
      // Queue tickets skip chat history when this person cannot see that conversation.
      if (!manual || chat.data === true) {
        const readAll = async (table: string, columns: string) => {
          const all: any[] = [];
          for (let offset = 0; ; offset += 1000) {
            const {data, error} = await db.from(table).select(columns).eq("agency_id", b.agency_id)
              .ilike("user_identifier", identifier.replace(/[\\%_]/g, "\\$&")).order("created_at").order("id").range(offset, offset + 999);
            if (error) throw error;
            all.push(...(data || []));
            if (!data || data.length < 1000) return all;
          }
        };
        const [ai, team] = await Promise.all([
          readAll("ai_chat_messages", "id,content,role,created_at"),
          readAll("agency_owner_messages", "id,content,created_at"),
        ]);
        if (!ai.length && !team.length) {
          if (!manual) return json({error: "No conversation found for this customer"}, 404);
        } else {
          transcript = chatTranscript([...ai, ...team.map(m => ({...m, role: "agency_owner"}))]);
        }
      }
      const fields = ticketInsertFields({
        manual,
        requestText: b.request_text,
        transcript,
        identifier,
        attachmentUrls: b.attachment_urls,
        assignedEmail: email,
        assignedAt: new Date().toISOString(),
      });
      const {data, error} = await db.from("support_tickets").insert({
        id: b.request_id, agency_id: b.agency_id, customer_name: b.customer_name, customer_email: b.customer_email,
        issue_category: b.issue_category, ...fields,
      }).select("*").single();
      if (error?.code === "23505") {
        const result = await db.from("support_tickets").select("*").eq("id", b.request_id).single();
        if (result.error) throw result.error;
        ticket = result.data;
        if (ticket.agency_id !== b.agency_id || ticket.source_chat_identifier !== identifier || ticket.assigned_by !== email) return json({error: "Ticket request does not match"}, 409);
      } else if (error) throw error;
      else {
        ticket = data;
        const message = manual ? manualTicketUpdateMessage(ticket) : chatTicketUpdateMessage(ticket);
        const update = sendTicketUpdate(db, ticket, message, {responderEmail: email}).catch(e => console.error("Ticket update error", e));
        // @ts-ignore EdgeRuntime exists in edge functions
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(update); else await update;
      }
    }
    const ticketSubject = `Your support ticket #${ticket.ticket_number} has been created`;
    const emailed = await postGhlEmailEvent("ticket_confirmation", {
      email: ticket.customer_email,
      full_name: ticket.customer_name,
      ticket_number: ticket.ticket_number,
      ticket_subject: ticketSubject,
      ticket_url: "https://saassuite.ai/support",
      issue_category: ticket.issue_category,
      ticket_message: ticketConfirmationText(ticket, manual),
    }, {
      source: "create-ticket-from-chat",
      dedupeKey: ghlEmailDedupeKey("ticket_confirmation", String(ticket.id ?? "")),
      claims: ghlEmailClaims(db),
    });
    if (emailed.status !== "sent" && emailed.status !== "duplicate") {
      const email_error = emailed.status === "missing_url"
        ? "Email service unavailable"
        : emailed.status === "overlap"
          ? "Email is already being sent. Retry in a few minutes if it does not arrive."
          : "Email could not be sent. Retry to send it without creating another ticket.";
      return json({success: true, ticket_number: ticket.ticket_number, email_sent: false, email_error});
    }
    return json({success: true, ticket_number: ticket.ticket_number, email_sent: true});
  } catch (error) {
    console.error("Chat ticket failed", error);
    return json({error: "Unable to create the ticket. Please retry."}, 500);
  }
});