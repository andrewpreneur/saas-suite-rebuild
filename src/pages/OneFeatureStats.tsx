import { useState } from "react";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Step = { label: string; count: number; pct_of_visitors: number; pct_of_previous: number; dropoff: number };
export type PageData = {
  visitors: number; video: number; avg_seconds: number; median_seconds: number; yes: number; no: number;
  plans: Record<string, number>; next: Record<string, number>; next_any: number; checkout: number; funnel: Step[];
  optins?: number; optin_rate?: number; with_ghl?: number; without_ghl?: number; saved_plans?: Record<string, number>;
};
export type Stats = { days: number; generated_at: string; trial_signups: number; pages: Record<"3" | "4", PageData> };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "0%");
const time = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1 text-3xl font-extrabold text-foreground">{value}</p>
    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const Bar = ({ label, n, total }: { label: string; n: number; total: number }) => (
  <div>
    <div className="flex justify-between text-sm"><span className="text-foreground">{label}</span><span className="font-semibold text-foreground">{n} · {pct(n, total)}</span></div>
    <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: pct(n, total) }} /></div>
  </div>
);

function Funnel({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.label}>
          {i > 0 && <p className="mb-1 text-xs text-destructive">↓ {s.dropoff} dropped off ({pct(s.dropoff, steps[i - 1].count)} of previous step)</p>}
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-foreground">{i + 1}. {s.label}</span>
              <span className="text-lg font-extrabold text-foreground">{s.count}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${s.pct_of_visitors}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">{s.pct_of_visitors}% of visitors{i > 0 && ` · ${s.pct_of_previous}% of previous step`}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSection({ n, d }: { n: "3" | "4"; d: PageData }) {
  const planTotal = Object.values(d.plans).reduce((a, b) => a + b, 0) + d.no;
  return (
    <Card>
      <CardHeader><CardTitle>Page {n} {n === "3" ? "(quiz first)" : "(bonus opt-in first)"}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Visitors" value={d.visitors} />
          <Tile label="Clicked the video" value={pct(d.video, d.visitors)} sub={`${d.video} people · tracked from Oct 11`} />
          <Tile label="Avg time on page" value={time(d.avg_seconds)} sub={`Typical (median): ${time(d.median_seconds)}`} />
          <Tile label="Clicked to next page" value={pct(d.next_any, d.visitors)} sub={`${d.next_any} people`} />
        </div>
        {n === "4" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Opt-ins" value={d.optins ?? 0} sub={`${d.optin_rate ?? 0}% of visitors`} />
            <Tile label="Have GHL" value={d.with_ghl ?? 0} sub={pct(d.with_ghl ?? 0, d.optins ?? 0) + " of opt-ins"} />
            <Tile label="No GHL" value={d.without_ghl ?? 0} sub={pct(d.without_ghl ?? 0, d.optins ?? 0) + " of opt-ins"} />
            <Tile label="Opened checkout" value={d.checkout} />
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <div><h3 className="mb-3 font-bold text-foreground">Step by step</h3><Funnel steps={d.funnel} /></div>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-bold text-foreground">Do you have GHL?</h3>
              <Bar label="Yes" n={d.yes} total={d.yes + d.no} />
              <Bar label="No" n={d.no} total={d.yes + d.no} />
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-foreground">Which plan / path</h3>
              <Bar label="No GHL account" n={d.no} total={planTotal} />
              {(["97", "297", "497"] as const).map((p) => <Bar key={p} label={`$${p} plan`} n={d.plans[p] ?? 0} total={planTotal} />)}
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-foreground">Next-page buttons clicked</h3>
              {Object.entries(d.next).map(([l, c]) => <Bar key={l} label={l.startsWith("Sign up for SaaSSuite") ? "SaaSSuite free trial ($497 people)" : l} n={c} total={d.next_any} />)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const OneFeatureStats = () => {
  const [password, setPassword] = useState("");
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (pw: string, d: number) => {
    setLoading(true); setError("");
    const { data, error: err } = await supabase.functions.invoke("one-feature-stats", { body: { password: pw, days: d } });
    setLoading(false);
    if (err || !data?.pages) { setError("Wrong password or the stats could not be loaded."); return; }
    setStats(data as Stats);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <PageSEO title="One-Feature Training Stats" description="Private stats" path="/onefeature-stats" noindex />
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-extrabold text-foreground">One-Feature Training: Pages 3 & 4</h1>
        {!stats ? (
          <form className="max-w-sm space-y-3" onSubmit={(e) => { e.preventDefault(); void load(password.trim(), days); }}>
            <Input type="password" placeholder="Password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading || !password.trim()}>{loading ? "Loading..." : "View stats"}</Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 7, 30, 90].map((d) => (
                <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => { setDays(d); void load(password.trim(), d); }}>{d === 1 ? "Today" : `Last ${d} days`}</Button>
              ))}
              <span className="text-sm text-muted-foreground">Free trial signups from these pages: <strong className="text-foreground">{stats.trial_signups}</strong></span>
            </div>
            <PageSection n="3" d={stats.pages["3"]} />
            <PageSection n="4" d={stats.pages["4"]} />
            <p className="text-xs text-muted-foreground">Counts are unique visitors (one per browser visit). Test sign-ups are excluded from opt-ins.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OneFeatureStats;
