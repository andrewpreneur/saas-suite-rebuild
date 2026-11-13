import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareCreatedAtThenId } from "../../../supabase/functions/admin-support-api/ticket-reply";
import {
  OPEN_CONVERSATION_POLL_MS,
  applyTicketReply,
  mergeTicketReplies,
  withLatestTicketResponse,
  type TicketReply,
} from "@/lib/adminSupportRealtime";

interface Props {
  ticketId: string;
  /** Latest team response saved on the ticket (legacy field). Its attachment is shown on the matching reply. */
  latestResponse?: string | null;
  latestResponseAt?: string | null;
  latestResponseAttachmentUrl?: string | null;
  /** Realtime INSERT/UPDATE for this ticket. Null until a row arrives. */
  liveReply?: Record<string, unknown> | null;
}

/**
 * Staff view of the full ticket conversation after the original request:
 * customer follow-ups and team responses, oldest first.
 */
export default function TicketRepliesThread({
  ticketId,
  latestResponse,
  latestResponseAt,
  latestResponseAttachmentUrl,
  liveReply,
}: Props) {
  const [replies, setReplies] = useState<TicketReply[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase.rpc as any)("get_ticket_replies_for_staff", {
        p_ticket_id: ticketId,
      });
      if (error) console.error("ticket replies load failed:", error);
      if (!cancelled) setReplies((prev) => mergeTicketReplies(prev, (data as TicketReply[]) || []));
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, OPEN_CONVERSATION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ticketId]);

  useEffect(() => {
    if (!liveReply) return;
    setReplies((prev) => applyTicketReply(prev, liveReply, ticketId));
  }, [liveReply, ticketId]);

  const items = withLatestTicketResponse(replies, latestResponse, latestResponseAt).sort(
    compareCreatedAtThenId,
  );
  const trimmed = latestResponse?.trim();

  if (!items.length) return null;

  const lastTeamIdx = trimmed
    ? items.map((r) => r.sender_role !== "customer" && r.body.trim() === trimmed).lastIndexOf(true)
    : -1;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Conversation ({items.length})</div>
      {items.map((r, i) => {
        const isCustomer = r.sender_role === "customer";
        return (
          <div
            key={r.id}
            className={`rounded-lg border p-3 text-sm ${
              isCustomer ? "bg-accent/40 border-accent" : "border-primary/30 bg-primary/5"
            }`}
          >
            <div className="text-xs font-medium mb-1 text-primary">
              {isCustomer
                ? r.sender_name || r.sender_email || "Customer"
                : r.sender_name || "SaaS Suite"}
              {" · "}
              {new Date(r.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap">{r.body}</div>
            {i === lastTeamIdx && latestResponseAttachmentUrl && (
              <a
                href={latestResponseAttachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block"
              >
                <img
                  src={latestResponseAttachmentUrl}
                  alt="Response attachment"
                  className="max-h-48 rounded border"
                />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
