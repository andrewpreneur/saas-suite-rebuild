import { useEffect, useState } from "react";
import { Clock, Gift, Minus, ChevronUp } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ChromeDock, dockCardClass } from "@/components/premium/entry/chrome";
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

  const urgent = days < 3;
  const left = `${days}d ${hours}h left`;

  if (minimized) {
    return (
      <ChromeDock>
        <aside aria-label="Free Basic trial" className="pointer-events-auto self-end md:self-auto">
          <Button variant="outline" size="sm" onClick={toggleMinimized} aria-label="Expand trial notification" aria-expanded={false} title="Expand trial notification" className="gap-2 rounded-full bg-card shadow-popover">
            <Gift className="text-brand" aria-hidden="true" />
            <span className="tabular-nums">Trial · {left}</span>
            <ChevronUp className="rotate-180 text-muted-foreground md:rotate-0" aria-hidden="true" />
          </Button>
        </aside>
      </ChromeDock>
    );
  }

  return (
    <ChromeDock>
      <aside aria-label="Free Basic trial" className={dockCardClass}>
        <div className="flex items-center gap-3 md:items-start">
          <span className="px-icon-chip hidden shrink-0 md:inline-grid">
            <Gift className="size-5" aria-hidden="true" />
          </span>
          <Gift className="size-4 shrink-0 text-brand md:hidden" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-semibold text-foreground">{title}</p>
            <p className="text-caption font-normal tabular-nums text-muted-foreground md:hidden">{left}</p>
            <p className="mt-0.5 hidden text-caption font-normal text-muted-foreground md:block">Ends {formatted}</p>
            {note ? <p className="hidden text-caption font-normal text-muted-foreground md:block">{note}</p> : null}
          </div>
          <Button asChild size="sm" className="shrink-0 md:hidden">
            <a href="/app/billing">Keep Basic</a>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={toggleMinimized} aria-label="Minimize trial notification" aria-expanded={true} title="Minimize trial notification" className="-mr-1 shrink-0 text-muted-foreground md:-mr-2 md:-mt-2">
            <Minus aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-3 hidden items-center justify-between gap-3 md:flex">
          <Tag tone={urgent ? "warning" : "brand"} className="tabular-nums">
            <Clock aria-hidden="true" />
            {left}
          </Tag>
          <Button asChild size="sm">
            <a href="/app/billing">Keep Basic</a>
          </Button>
        </div>
      </aside>
    </ChromeDock>
  );
};

export default FreeTrialBanner;
