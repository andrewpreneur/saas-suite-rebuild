import { supabase } from "@/integrations/supabase/client";

const SEND_TIMEOUT_MS = 8000;

export type SupportReply = {
  id: string;
  agencyId: string;
  userIdentifier: string;
  content: string;
};

export async function saveSupportReply(reply: SupportReply): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const { error } = await supabase
      .from("agency_owner_messages")
      .upsert(
        {
          id: reply.id,
          agency_id: reply.agencyId,
          user_identifier: reply.userIdentifier.trim().toLowerCase(),
          content: reply.content,
          sender_type: "agency_owner",
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .abortSignal(controller.signal);

    if (error) throw error;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Supabase did not respond within 8 seconds. Send is ready to retry safely.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function queueReplyNotification(reply: Omit<SupportReply, "id">): void {
  void supabase.functions
    .invoke("notify-team-reply", {
      body: {
        agency_id: reply.agencyId,
        user_identifier: reply.userIdentifier,
        our_message: reply.content,
      },
      timeout: 10000,
    })
    .catch((error) => console.error("notify-team-reply failed:", error));
}