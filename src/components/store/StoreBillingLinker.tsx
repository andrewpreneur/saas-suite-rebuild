import { useEffect, useRef } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/utils/nativeApp";

/**
 * In the phone apps, people can subscribe before they have an account.
 * As soon as they sign up or log in, this links that store purchase to their
 * account (RevenueCat moves the anonymous purchase onto their email) and
 * updates their plan.
 */
const StoreBillingLinker = () => {
  const { actualEmail, refetchUserData } = useUser();
  const linkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isNativeApp() || !actualEmail) return;
    const email = actualEmail.trim().toLowerCase();
    if (linkedFor.current === email) return;
    linkedFor.current = email;

    (async () => {
      const { initStoreBilling } = await import("@/lib/revenuecat");
      const ok = await initStoreBilling(email);
      if (!ok) return;
      let linked = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
        const { data, error } = await supabase.functions.invoke("sync-store-subscription");
        const ids = (data as any)?.activeProductIds;
        if (!error && Array.isArray(ids) && ids.length > 0) { linked = true; break; }
      }
      if (linked) {
        try { localStorage.removeItem("ss_pending_store_purchase"); } catch { /* ignore */ }
      }
      await refetchUserData();
    })().catch((e) => console.error("[StoreBillingLinker]", e));
  }, [actualEmail, refetchUserData]);

  return null;
};

export default StoreBillingLinker;
