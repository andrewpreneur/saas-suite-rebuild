import { supabase } from "@/integrations/supabase/client";

/**
 * Sign out so the browser is guaranteed to be signed out afterwards.
 * A failed server sign-out (network/edge error) leaves supabase-js's local
 * session in place, which silently signed people back in on the next page.
 */
export async function hardSignOut() {
  try { await supabase.auth.signOut(); } catch { /* fall through */ }
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* fall through */ }
  try {
    for (const store of [localStorage, sessionStorage]) {
      Object.keys(store)
        .filter((k) => k.startsWith("sb-") && k.includes("auth-token"))
        .forEach((k) => store.removeItem(k));
    }
    ["selectedAccountEmail", "isImpersonating", "impersonatedBy"].forEach((k) => sessionStorage.removeItem(k));
  } catch { /* private mode */ }
}
