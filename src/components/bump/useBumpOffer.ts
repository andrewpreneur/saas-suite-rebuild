import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BumpOffer {
  code: string;
  percentOff: number;
  expiresAt: string;
  plan: "basic" | "advanced";
  monthly: number;
  discounted: number;
}

/** Generates (or reuses) a 24-hour, email-locked 40% off Stripe promo code. */
export const useBumpOffer = (
  email: string | null | undefined,
  plan: "basic" | "advanced",
  enabled = true,
  testMode = false,
) => {
  const [offer, setOffer] = useState<BumpOffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return;
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("create-bump-offer", {
      body: { email: normalized, plan, testMode },
    });
    if (fnError || data?.error) {
      setError(fnError?.message || data?.error || "Could not create your discount");
    } else {
      setOffer(data as BumpOffer);
    }
    setLoading(false);
  }, [email, plan, testMode]);

  useEffect(() => {
    if (enabled) void generate();
  }, [enabled, generate]);

  return { offer, loading, error, regenerate: generate };
};

/** Live "23h 59m 12s" style countdown for an ISO expiry. */
export const useCountdown = (expiresAt?: string | null) => {
  const [label, setLabel] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setLabel("");
      setExpired(false);
      return;
    }
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("Expired");
        setExpired(true);
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setLabel(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
      setExpired(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { label, expired };
};