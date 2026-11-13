import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes a message our team sent to a customer (agency_owner_messages row).
 * Only platform admins and the owning agency can delete, enforced by RLS.
 */
export async function deleteOwnerMessage(messageId: string): Promise<void> {
  if (!UUID_RE.test(messageId)) {
    // Optimistic local message that was never persisted with a real id — nothing to delete.
    return;
  }
  const { error } = await supabase.from("agency_owner_messages").delete().eq("id", messageId);
  if (error) throw error;
}
