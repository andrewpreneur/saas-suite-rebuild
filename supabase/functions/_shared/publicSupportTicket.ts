/** Tickets opened from the public support form. Guests have no agency account. */

export const PUBLIC_SUPPORT_AGENCY_ID = "public-support";
export const PUBLIC_SUPPORT_SOURCE = "public_support_page";

export function isPublicSupportTicket(
  ticket: { source?: string | null; agency_id?: string | null } | null | undefined,
): boolean {
  if (!ticket) return false;
  const agencyId = String(ticket.agency_id || "").replace(/NO$/i, "");
  return ticket.source === PUBLIC_SUPPORT_SOURCE || agencyId === PUBLIC_SUPPORT_AGENCY_ID;
}

/**
 * Agency tickets are skipped when notify-support-assignee cannot find an owner.
 * A public-form ticket has no owner, and the SaaS Suite alert still has to send.
 */
export function supportTicketAlertNeedsOwner(
  ticket: { source?: string | null; agency_id?: string | null } | null | undefined,
): boolean {
  return !isPublicSupportTicket(ticket);
}
