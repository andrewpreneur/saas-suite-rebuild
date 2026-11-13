import { supabase } from "@/integrations/supabase/client";

/** Attach this login to kit purchases stored under the same email. Service role writes the rows. */
export async function attachKitPurchases(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.trim().toLowerCase();
    const userId = data.user?.id;
    if (!email || !userId) return;
    await supabase.from("kit_purchases").update({ user_id: userId }).eq("email", email);
  } catch {
    // The table is applied separately. A missing table must not block login.
  }
}
