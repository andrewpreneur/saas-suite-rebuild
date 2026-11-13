import { ticketListPreviewText, type TicketPreviewSource } from "@/lib/ticketListPreview";

/** Muted 1–2 line description under or beside a ticket title. Omitted when empty. */
export function TicketListPreview({
  ticket,
  className = "text-sm text-muted-foreground line-clamp-2 break-words [overflow-wrap:anywhere]",
}: {
  ticket: TicketPreviewSource;
  className?: string;
}) {
  const text = ticketListPreviewText(ticket);
  if (!text) return null;
  return (
    <p data-ticket-preview="" className={className} title={text}>
      {text}
    </p>
  );
}
