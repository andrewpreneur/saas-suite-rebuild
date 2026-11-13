import { supabase } from "@/integrations/supabase/client";

/**
 * True installation status.
 *
 * Historically this only looked at `install_confirmed_at`, which is set when the
 * user clicks "I've installed it" inside the guide. Plenty of accounts finish the
 * install (menu link ID saved + CSS/JS live) without ever clicking that button, so
 * they kept seeing the "you still need to install" banner. We now also treat a
 * saved menu link ID on ANY of the account's agency IDs as proof of install.
 */
export const checkInstallStatus = async (email: string): Promise<boolean> => {
  const clean = email.trim().toLowerCase();
  if (!clean) return false;

  // Single source of truth (server side): confirmation click, a saved menu link
  // ID / menu config, or real client activity on any of the account's hubs.
  const { data, error } = await supabase.rpc("is_hub_installed", { user_email: clean });
  if (error) {
    console.error("is_hub_installed failed:", error);
    return true; // never nag on a lookup failure
  }

  const installed = Boolean(data);
  if (installed) {
    // Persist so every other surface agrees and the banner never comes back.
    await supabase.rpc("record_install_confirmed", { user_email: clean });
  }

  return installed;
};
