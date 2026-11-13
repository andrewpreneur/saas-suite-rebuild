import { useEffect, useState } from "react";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { WebinarStatsSection } from "./WebinarStats";
import { PageSection, type Stats } from "./OneFeatureStats";

const STORE_KEY = "ss_webinar_stats_pw";

// One private stats page: webinar funnel, one-feature training funnels, MRR, customers, spend.
const FunnelStats = () => {
  const [password, setPassword] = useState(() => sessionStorage.getItem(STORE_KEY) ?? "");
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem(STORE_KEY));
  const [training, setTraining] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadTraining = async (pw: string, d: number) => {
    const { data } = await supabase.functions.invoke("one-feature-stats", { body: { password: pw, days: d } });
    if (data?.pages) setTraining(data as Stats);
    return !!data?.pages;
  };

  const unlock = async () => {
    setLoading(true); setError("");
    const ok = await loadTraining(password.trim(), days);
    setLoading(false);
    if (!ok) { setError("Wrong password or the stats could not be loaded."); return; }
    sessionStorage.setItem(STORE_KEY, password.trim());
    setUnlocked(true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (unlocked) void loadTraining(password, days); }, [unlocked]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <PageSEO title="Funnel Stats" description="Private funnel stats" path="/funnel-stats" noindex />
      <div className="mx-auto max-w-7xl space-y-10">
        <h1 className="text-3xl font-extrabold text-foreground">Funnel Stats</h1>
        {!unlocked ? (
          <form className="max-w-sm space-y-3" onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
            <Input type="password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading || !password.trim()}>{loading ? "Loading..." : "View stats"}</Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </form>
        ) : (
          <>
            <WebinarStatsSection password={password} extraCustomers={training?.trial_signups ?? 0} />
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-2xl font-bold text-foreground">One-Feature Training Funnels</h2>
                {[1, 7, 30, 90].map((d) => (
                  <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => { setDays(d); void loadTraining(password, d); }}>{d === 1 ? "Today" : `${d}d`}</Button>
                ))}
                {training && <span className="text-sm text-muted-foreground">Free trial signups: <strong className="text-foreground">{training.trial_signups}</strong></span>}
              </div>
              {training ? (<><PageSection n="3" d={training.pages["3"]} /><PageSection n="4" d={training.pages["4"]} /></>) : <p className="text-sm text-muted-foreground">Loading...</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default FunnelStats;
