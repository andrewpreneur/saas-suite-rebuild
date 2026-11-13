import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ticket-response-attachments";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function uploadTicketAttachment(ticketId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image attachments are supported.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is over 8MB. Please resize and try again.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;

  // Private bucket — sign for 10 years so the URL stored on the ticket keeps rendering.
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !data?.signedUrl) throw signErr || new Error("Failed to sign URL");
  return data.signedUrl;
}