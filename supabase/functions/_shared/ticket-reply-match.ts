/** Stable subject token so an emailed reply can be matched back to the ticket. */
export function ticketUpdateSubject(ticketNumber: number | string): string {
  return `Update on your support ticket [#${ticketNumber}]`;
}

/** Tells the sending workflow to keep the token in the subject customers reply to. */
export function ticketReplyHint(ticketNumber: number | string): string {
  return `Reply to this email and keep [#${ticketNumber}] in the subject so your message is added to this ticket.`;
}
