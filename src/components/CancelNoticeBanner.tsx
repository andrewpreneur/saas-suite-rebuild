import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { shouldShowCancellationNotice } from "@/lib/trialNotice";

const STRIPE_PORTAL = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";

/** Yellow notice for canceled accounts that keep full access until their paid period ends. */
const CancelNoticeBanner = () => {
  const { email, approval } = useUser();
  const [until, setUntil] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!email || approval === "NO") {
      setUntil(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("cancel_access_until, trial_source")
        .ilike("email", email.trim().toLowerCase())
        .maybeSingle();
      if (cancelled) return;
      const row = data as { cancel_access_until?: string | null; trial_source?: string | null } | null;
      if (!shouldShowCancellationNotice(row?.trial_source)) {
        setUntil(null);
        return;
      }
      const raw = row?.cancel_access_until;
      const d = raw ? new Date(raw) : null;
      setUntil(d && d.getTime() > Date.now() ? d : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [email, approval]);

  if (!until) return null;

  const daysLeft = Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86400000));
  const formatted = until.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="sticky top-0 z-40 w-full border-b border-yellow-300 bg-yellow-100 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-100">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <Clock className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          <strong className="font-semibold">Your subscription was canceled.</strong> You keep full access
          until <strong>{formatted}</strong> ({daysLeft} day{daysLeft === 1 ? "" : "s"} left), then your
          account moves to Starter.
        </div>
        <button
          className="shrink-0 font-semibold underline"
          onClick={() => (window.location.href = STRIPE_PORTAL)}
        >
          Keep my plan
        </button>
      </div>
    </div>
  );
};

export default CancelNoticeBanner;
