/** Identity stored on the reply the API itself inserts and returns. */
export const API_TICKET_REPLY_SENDER = "api";

/** Same window the handler used before this was split out for tests. */
export const TEAM_REPLY_DEDUP_MS = 10 * 60 * 1000;

export type TeamReplyInsert = {
  ticket_id: string;
  sender_role: "admin";
  sender_name: string;
  sender_email: string;
  body: string;
};

export function teamReplySenderEmail(senderEmail: string | null | undefined): string {
  const value = senderEmail?.trim().slice(0, 320) ?? "";
  return value || API_TICKET_REPLY_SENDER;
}

export function teamReplyInsert(
  ticketId: string,
  message: string,
  senderName: string,
  senderEmail: string | null | undefined,
): TeamReplyInsert {
  return {
    ticket_id: ticketId,
    sender_role: "admin",
    sender_name: senderName,
    sender_email: teamReplySenderEmail(senderEmail),
    body: message,
  };
}

/**
 * Oldest first. When two rows share created_at, id decides the order so the
 * latest row is the same one every time.
 */
export function compareCreatedAtThenId(
  a: { created_at: string | Date; id?: string | null },
  b: { created_at: string | Date; id?: string | null },
): number {
  const byTime = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (byTime) return byTime;
  const aId = a.id ?? "";
  const bId = b.id ?? "";
  if (aId < bId) return -1;
  if (aId > bId) return 1;
  return 0;
}

type TicketRef = { id: string; ticket_number: number };

export type TicketReplyResult =
  | { ok: true; deduped: true; ticket_number: number }
  | { ok: true; reply_id: string; ticket_number: number; email_notification_sent: boolean };

/**
 * Writes one team reply, stamps the ticket, then sends one customer email.
 * The admin_response update also fires log_ticket_team_response. That trigger
 * must not insert a second row for the reply this function just wrote.
 */
export async function recordTicketReply(opts: {
  ticket: TicketRef;
  message: string;
  senderName: string;
  senderEmail: string | null;
  status: string | null;
  notify: boolean;
  now?: Date;
  findRecentDuplicate: (ticketId: string, message: string, sinceIso: string) => Promise<string | null>;
  insertReply: (row: TeamReplyInsert) => Promise<string>;
  updateTicket: (ticketId: string, patch: Record<string, unknown>) => Promise<void>;
  sendCustomerEmail: (message: string, responderName: string) => Promise<boolean>;
}): Promise<TicketReplyResult> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - TEAM_REPLY_DEDUP_MS).toISOString();
  const duplicateId = await opts.findRecentDuplicate(opts.ticket.id, opts.message, since);
  if (duplicateId) return { ok: true, deduped: true, ticket_number: opts.ticket.ticket_number };

  const senderEmail = teamReplySenderEmail(opts.senderEmail);
  const replyId = await opts.insertReply(teamReplyInsert(opts.ticket.id, opts.message, opts.senderName, senderEmail));
  await opts.updateTicket(opts.ticket.id, {
    admin_response: opts.message,
    responded_at: now.toISOString(),
    responded_by: senderEmail,
    responded_by_name: opts.senderName,
    status: opts.status ?? "responded",
  });

  let email_notification_sent = false;
  if (opts.notify) {
    try {
      email_notification_sent = await opts.sendCustomerEmail(opts.message, opts.senderName);
    } catch {
      email_notification_sent = false;
    }
  }
  return {
    ok: true,
    reply_id: replyId,
    ticket_number: opts.ticket.ticket_number,
    email_notification_sent,
  };
}
