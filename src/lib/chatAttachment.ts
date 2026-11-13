import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ticket-response-attachments";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Uploads an image attachment for a live chat reply and returns a long-lived
 * signed URL. Reuses the ticket attachment bucket so policies stay in one place.
 */
export async function uploadChatAttachment(scope: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image attachments are supported.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is over 8MB. Please resize and try again.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeScope = (scope || "chat").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const path = `chat/${safeScope}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !data?.signedUrl) throw signErr || new Error("Failed to sign URL");
  return data.signedUrl;
}
