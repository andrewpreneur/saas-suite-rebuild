import { useEffect, useState } from "react";
import { Gift, Minus, ChevronUp } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KIT_BASIC_TRIAL_SOURCE, MANUAL_BASIC_TRIAL_SOURCE, kitBasicTrialEnd } from "@/lib/trialNotice";

export { MANUAL_BASIC_TRIAL_SOURCE } from "@/lib/trialNotice";

type TrialNotice = { endsAt: Date; title: string; note: string };

/** Countdown for a 30-day Basic grant. Staff trials end at cancel_access_until. Kit trials end 30 days after purchase. */
const FreeTrialBanner = () => {
  const { email } = useUser();
  const [notice, setNotice] = useState<TrialNotice | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    if (!email) { setNotice(null); return; }
    supabase
      .from("saas_suite_users")
      .select("trial_source, cancel_access_until, trial_start_date, trial_length")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as {
          trial_source: string | null;
          cancel_access_until: string | null;
          trial_start_date: string | null;
          trial_length: number | null;
        } | null;
        if (row?.trial_source === KIT_BASIC_TRIAL_SOURCE) {
          const endsAt = kitBasicTrialEnd(row.trial_start_date, row.trial_length);
          setNotice(endsAt && endsAt.getTime() > Date.now()
            ? { endsAt, title: "SaaSSuite Basic", note: "Included with the One Feature Kit" }
            : null);
          return;
        }
        if (row?.trial_source === MANUAL_BASIC_TRIAL_SOURCE && row.cancel_access_until) {
          const endsAt = new Date(row.cancel_access_until);
          setNotice(endsAt.getTime() > Date.now()
            ? { endsAt, title: "Free 30-day Basic trial", note: "" }
            : null);
          return;
        }
        setNotice(null);
      });
    return () => { cancelled = true; };
  }, [email]);

  useEffect(() => {
    if (!notice) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [notice]);

  if (!notice) return null;
  return (
    <FreeTrialNotice
      key={`${email}:${notice.endsAt.toISOString()}`}
      endsAt={notice.endsAt}
      now={now}
      accountEmail={email || ""}
      title={notice.title}
      note={notice.note}
    />
  );
};

export const FreeTrialNotice = ({ endsAt, now, accountEmail, title = "Free 30-day Basic trial", note = "" }: { endsAt: Date; now: number; accountEmail: string; title?: string; note?: string }) => {
  const storageKey = `ss_trial_minimized:${accountEmail.trim().toLowerCase()}:${endsAt.toISOString()}`;
  const [minimized, setMinimized] = useState(() => {
    try { return sessionStorage.getItem(storageKey) === "true"; } catch { return false; }
  });
  const toggleMinimized = () => {
    const next = !minimized;
    setMinimized(next);
    try { sessionStorage.setItem(storageKey, String(next)); } catch { /* Still works when storage is unavailable. */ }
  };
  const ms = Math.max(0, endsAt.getTime() - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const formatted = endsAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (minimized) {
    return (
      <aside aria-label="Free Basic trial" className="fixed bottom-24 left-4 z-40 max-w-[calc(100vw-2rem)] md:bottom-4">
        <Button variant="outline" size="sm" onClick={toggleMinimized} aria-label="Expand trial notification" aria-expanded={false} title="Expand trial notification" className="gap-2 border-primary/30 bg-card text-card-foreground shadow-lg">
          <Gift className="h-4 w-4 text-primary" />
          <span className="tabular-nums">Trial · {days}d {hours}h left</span>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside aria-label="Free Basic trial" className="fixed bottom-24 left-4 z-40 w-[260px] max-w-[calc(100vw-2rem)] rounded-lg border border-primary/30 bg-card p-4 text-card-foreground shadow-lg md:bottom-4">
      <div className="flex items-start gap-1">
      <p className="flex flex-1 items-center gap-2 text-sm font-semibold">
        <Gift className="h-4 w-4 shrink-0 text-primary" />
        {title}
      </p>
      <Button variant="ghost" size="icon-sm" onClick={toggleMinimized} aria-label="Minimize trial notification" aria-expanded={true} title="Minimize trial notification" className="-mr-2 -mt-2 shrink-0">
        <Minus className="h-4 w-4" />
      </Button>
      </div>
      <p className="mt-2 text-sm font-semibold tabular-nums text-primary">{days}d {hours}h left</p>
      <p className="mt-1 text-xs text-muted-foreground">Ends {formatted}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
      <Button asChild size="sm" className="mt-3 w-full">
        <a href="/app/billing">Keep Basic</a>
      </Button>
    </aside>
  );
};

export default FreeTrialBanner;
