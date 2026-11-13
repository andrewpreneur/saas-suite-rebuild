import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

const PaymentGraceBanner = () => {
  const { email, approval } = useUser();
  const [graceUntil, setGraceUntil] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!email || approval === "NO") {
      setGraceUntil(null);
      return;
    }
    const normalized = email.trim().toLowerCase();
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("payment_grace_until")
        .ilike("email", normalized)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data as { payment_grace_until: string | null } | null)?.payment_grace_until;
      if (raw) {
        const d = new Date(raw);
        setGraceUntil(d.getTime() > Date.now() ? d : null);
      } else {
        setGraceUntil(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, approval]);

  if (!graceUntil) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((graceUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const formatted = graceUntil.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="sticky top-0 z-40 w-full border-b border-yellow-300 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100 dark:border-yellow-700">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          <strong className="font-semibold">Your last payment failed.</strong>{" "}
          Please update your card by <strong>{formatted}</strong> ({daysLeft} day
          {daysLeft === 1 ? "" : "s"} left) to keep your account active.
        </div>
      </div>
    </div>
  );
};

export default PaymentGraceBanner;