/** Characters kept before the list snippet is cut. CSS still clamps the line to two. */
const PREVIEW_CHARS = 180;

export interface TicketPreviewSource {
  /** Ticket description / body already loaded with the list row. */
  request_text?: string | null;
  /** First customer message, only when that text is already on the row. */
  first_customer_message?: string | null;
}

function collapse(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Short list preview. Prefer the description. If that is empty, use a customer
 * message that is already on the row. Returns null when there is nothing to show.
 */
export function ticketListPreviewText(ticket: TicketPreviewSource): string | null {
  const text = collapse(ticket.request_text) || collapse(ticket.first_customer_message);
  if (!text) return null;
  if (text.length <= PREVIEW_CHARS) return text;
  const slice = text.slice(0, PREVIEW_CHARS);
  const space = slice.lastIndexOf(" ");
  const trimmed = (space > 120 ? slice.slice(0, space) : slice).trimEnd();
  return `${trimmed}…`;
}
