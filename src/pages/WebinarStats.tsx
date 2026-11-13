import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, TrendingUp, Users, Eye, MousePointer, DollarSign, ShoppingCart, Mail, BarChart3, Megaphone, Target, Percent, Wallet } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const formatInt = (n: number) => new Intl.NumberFormat("en-US").format(n);

// The webinar went live Friday 2:00 AM Central (Sep 18, 2026).
const WENT_LIVE_AT = new Date("2026-09-18T02:00:00-05:00").getTime();

function formatLiveDuration(ms: number): string {
  if (ms < 0) return "not live yet";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m live`;
  if (hours > 0) return `${hours}h ${minutes}m live`;
  return `${minutes}m live`;
}

function TimeLiveBadge() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <Badge variant="outline" className="gap-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {formatLiveDuration(now - WENT_LIVE_AT)}
    </Badge>
  );
}

type Block = {
  pageviews: number;
  unique_sessions: number;
  unique_visitors: number;
  clicks: number;
  video_plays: number;
  register_clicks: number;
  median_seconds_on_page: number;
  deep_scroll_75_sessions: number;
  bounce_rate_pct: number;
  top_clicks: { value: string; count: number }[];
};

type PurchaseMonth = {
  month: string;
  count: number;
  collected: number;
  mrr: number;
};

type AllTime = {
  pageviews: number;
  unique_visitors: number;
  unique_sessions: number;
  registrants: number;
  attendees?: number;
  purchases: number;
  recorded_purchases: number;
  collected_revenue: number;
  unmatched_purchases?: number;
  unmatched_collected_revenue?: number;
  mrr: number;

  plan_mrr: number;
  purchases_by_month: PurchaseMonth[];
  capped: boolean;
};


type AdAgg = {
  days: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  registrations: number;
  purchases: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  cpa: number;
  roas: number;
  profit: number;
};

type AdEntity = {
  level: string;
  name: string;
  campaign_name: string | null;
  adset_name: string | null;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
};

type Ads = {
  has_data: boolean;
  live?: {
    ad_sets: number;
    spend: number;
    leads: number;
    clicks: number;
    impressions: number;
    cpl: number;
    ctr: number;
    retired_spend: number;
  } | null;
  last_push: { date: string; source: string; notes: string | null; updated_at: string } | null;
  sources: string[];
  window: AdAgg;
  all_time: AdAgg;
  daily: { date: string; spend: number; clicks: number; leads: number; purchases: number; revenue: number; roas: number; ctr: number }[];
  campaigns: AdEntity[];
  ad_sets: AdEntity[];
  creatives: AdEntity[];
};

type Stats = {
  generated_at: string;
  window_days: number;
  ads?: Ads | null;
  totals: Record<string, number>;
  by_path: Record<string, Block>;
  timeline: Record<string, string | number>[];
  traffic: Record<string, { value: string; count: number }[]>;
  counting?: { campaign_start: string | null; window_start: string; facebook_only: boolean; excludes_test_registrations: boolean } | null;
  funnel_users: { count: number; paid: number; estimated_revenue: number };
  all_time: AllTime;
};



const STORE_KEY = "ss_webinar_stats_pw";
const PATHS = ["/webinar", "/special", "/webinar-confirmation", "/watch-saassuite-webinar"];

const toneStyles: Record<string, { iconBg: string; icon: string; border: string }> = {
  money: {
    iconBg: "bg-success/12",
    icon: "text-success",
    border: "border-success/20",
  },
  people: {
    iconBg: "bg-primary/10",
    icon: "text-primary",
    border: "border-primary/15",
  },
  fire: {
    iconBg: "bg-offer/12",
    icon: "text-offer",
    border: "border-offer/20",
  },
  heart: {
    iconBg: "bg-heart/12",
    icon: "text-heart",
    border: "border-heart/20",
  },
  purple: {
    iconBg: "bg-ring/10",
    icon: "text-ring",
    border: "border-ring/15",
  },
  blue: {
    iconBg: "bg-sidebar-primary/10",
    icon: "text-sidebar-primary",
    border: "border-sidebar-primary/15",
  },
};

const MetricCard = ({
  label,
  value,
  icon: Icon,
  tone = "people",
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: keyof typeof toneStyles;
  sub?: string;
}) => {
  const t = toneStyles[tone];
  return (
    <Card className={`overflow-hidden border ${t.border} hover:shadow-card transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`shrink-0 rounded-lg ${t.iconBg} p-2.5`}>
            <Icon className={`h-5 w-5 ${t.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">{children}</h2>
);

export const TESTING_SHARE = 0.8;

export const WebinarStatsSection = ({ password: givenPassword, extraCustomers = 0 }: { password?: string; extraCustomers?: number }) => {
  const [password, setPassword] = useState(givenPassword ?? "");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pw: string, windowDays: number) => {
    setLoading(true);
    setError(null);
    // The stats function is heavy and can fail on a cold start, so retry before giving up.
    let res: unknown = null;
    let failed = true;
    for (let attempt = 0; attempt < 3 && failed; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      const out = await supabase.functions.invoke("webinar-stats", { body: { password: pw, days: windowDays } });
      res = out.data;
      failed = !!out.error || !!(res as { error?: string })?.error || !(res as Stats | null)?.totals;
      if ((res as { error?: string })?.error === "Unauthorized") break;
    }
    setLoading(false);
    if (failed) {
      setError("The webinar stats could not be loaded.");
      if (!givenPassword) sessionStorage.removeItem(STORE_KEY);
      return;
    }
    sessionStorage.setItem(STORE_KEY, pw);
    setData(res as Stats);
  }, [givenPassword]);

  useEffect(() => {
    const saved = givenPassword || sessionStorage.getItem(STORE_KEY);
    if (saved) {
      setPassword(saved);
      load(saved, 30);
    }
  }, [load, givenPassword]);

  if (!data && givenPassword) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {error ?? "Loading webinar stats..."}
        {error && !loading && (
          <Button size="sm" variant="outline" onClick={() => load(givenPassword, days)}>Try again</Button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <PageSEO title="Webinar Stats" description="Internal webinar funnel stats." path="/webinar-stats" noindex />
        <main className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Webinar Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  load(password.trim(), days);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="pw">Password</Label>
                  <Input
                    id="pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !password.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "View stats"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const t = data.totals;
  const a: AllTime =
    data.all_time ?? {
      pageviews: 0,
      unique_visitors: 0,
      unique_sessions: 0,
      registrants: 0,
      purchases: 0,
      recorded_purchases: 0,
      collected_revenue: 0,
      mrr: 0,
      plan_mrr: 0,
      purchases_by_month: [],
      capped: false,
    };

  const ads = data.ads ?? null;
  const maxDay = Math.max(
    1,
    ...data.timeline.map((d) => PATHS.reduce((s, p) => s + (Number(d[p]) || 0), 0)),
  );

  return (
    <>
      <PageSEO title="Webinar Stats" description="Internal webinar funnel stats." path="/webinar-stats" noindex />
      <main className="min-h-screen bg-background p-4 md:p-8 space-y-8 mobile-type">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Webinar &amp; Special Funnel</h1>
            <div className="mt-2"><TimeLiveBadge /></div>
            <p className="text-sm text-muted-foreground mt-1">
              Last {data.window_days} days · updated {new Date(data.generated_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {[7, 30, 90, 365].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "default" : "outline"}
                onClick={() => {
                  setDays(d);
                  load(password, d);
                }}
                disabled={loading}
              >
                {d}d
              </Button>
            ))}
          </div>
        </header>

        {/* Overview: MRR, customers, spend and the 80/20 testing split */}
        {(() => {
          const spend = ads?.window.spend ?? 0;
          const allSpend = ads?.all_time.spend ?? 0;
          return (
            <section className="space-y-3">
              <SectionTitle><DollarSign className="h-5 w-5 text-success" /> Overview</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Estimated MRR" value={`${currency(a.mrr)}/mo`} icon={TrendingUp} tone="money" sub={`plan-based ${currency(a.plan_mrr)}/mo`} />
                <MetricCard label="Customers" value={formatInt(a.purchases + extraCustomers)} icon={Users} tone="people" sub={`${formatInt(a.purchases)} webinar sales · ${formatInt(extraCustomers)} training trials`} />
                <MetricCard label={`Ad spend (${data.window_days}d)`} value={currency(spend)} icon={Wallet} tone="fire" sub={`all time ${currency(allSpend)}`} />
                <MetricCard label="Revenue collected" value={currency(a.collected_revenue)} icon={DollarSign} tone="money" sub={allSpend ? `${(a.collected_revenue / allSpend).toFixed(2)}x ROAS` : undefined} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label={`Testing budget (${TESTING_SHARE * 100}%)`} value={currency(spend * TESTING_SHARE)} icon={Target} tone="purple" sub={`all time ${currency(allSpend * TESTING_SHARE)}`} />
                <MetricCard label={`Scaling budget (${Math.round((1 - TESTING_SHARE) * 100)}%)`} value={currency(spend * (1 - TESTING_SHARE))} icon={TrendingUp} tone="blue" sub={`all time ${currency(allSpend * (1 - TESTING_SHARE))}`} />
              </div>
            </section>
          );
        })()}


        {/* Window stats — forward-looking data only */}
        <section className="space-y-3">
          <SectionTitle>
            <BarChart3 className="h-5 w-5 text-primary" /> Last {data.window_days} days
          </SectionTitle>
          <p className="text-xs text-muted-foreground">
            Facebook traffic only{data.counting?.campaign_start ? `, from ${data.counting.campaign_start} onwards (first day of ad spend)` : ""}. Internal test
            registrations are excluded.
          </p>

          {/* The two numbers that actually matter */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-heart/25 bg-gradient-to-br from-heart/10 to-background">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-heart">
                  <Mail className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Registrations</span>
                </div>
                <p className="text-3xl md:text-4xl font-bold mt-2">{formatInt(t.registrants)}</p>
                <p className="text-xs text-muted-foreground mt-1">all time {formatInt(data.all_time.registrants)}</p>
              </CardContent>
            </Card>
            <Card className="border-success/25 bg-gradient-to-br from-success/10 to-background">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-success">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Attended</span>
                </div>
                <p className="text-3xl md:text-4xl font-bold mt-2">{formatInt(t.attendees || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.registrants ? `${Math.round(((t.attendees || 0) / t.registrants) * 100)}% show-up rate` : "no registrations yet"}
                  {t.missed ? ` · ${formatInt(t.missed)} missed` : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Replay viewers" value={formatInt(t.replay_viewers || 0)} icon={Eye} tone="blue" />
            <MetricCard label="Offer clicks" value={formatInt(t.offer_clicks || 0)} icon={MousePointer} tone="fire" />
            <MetricCard label="Needs follow-up" value={formatInt(t.needs_followup || 0)} icon={Users} tone="people" />
            <MetricCard label="Funnel purchases" value={formatInt(t.purchases || 0)} icon={ShoppingCart} tone="money" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="Webinar views" value={formatInt(t.webinar_pageviews)} icon={Eye} tone="blue" />
            <MetricCard label="Webinar visitors" value={formatInt(t.webinar_visitors)} icon={Users} tone="people" />
            <MetricCard label="Special views" value={formatInt(t.special_pageviews)} icon={Eye} tone="blue" />
            <MetricCard label="Special visitors" value={formatInt(t.special_visitors)} icon={Users} tone="people" />
            <MetricCard label="Register clicks" value={formatInt(t.register_clicks)} icon={MousePointer} tone="fire" />
          </div>

        </section>

        {/* Ad spend (pushed in via the ads API) */}
        <section className="space-y-3">
          <SectionTitle>
            <Megaphone className="h-5 w-5 text-offer" /> Ad performance
            {ads?.last_push && (
              <Badge variant="secondary" className="ml-1 font-normal">
                last push {ads.last_push.date} · {ads.last_push.source}
              </Badge>
            )}
          </SectionTitle>

          {!ads?.has_data ? (
            <Card className="border-dashed">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No ad data pushed yet. POST your spend, campaigns, ad sets and creatives to the
                <span className="font-mono"> webinar-ads-api </span> endpoint and it shows up here.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-offer/25 bg-gradient-to-br from-offer/10 to-background col-span-2 md:col-span-1">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-offer">
                      <Wallet className="h-5 w-5" />
                      <span className="text-sm font-semibold uppercase tracking-wide">Ad spend</span>
                    </div>
                    <p className="text-3xl font-bold mt-2">{currency(ads.window.spend)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      all time {currency(ads.all_time.spend)} · {ads.window.days} day{ads.window.days === 1 ? "" : "s"} reported
                    </p>
                  </CardContent>
                </Card>
                <MetricCard
                  label="Recorded revenue"
                  value={currency(a.collected_revenue)}
                  icon={DollarSign}
                  tone="money"
                  sub={`${formatInt(a.purchases)} recorded sale${a.purchases === 1 ? "" : "s"} · ${currency(a.mrr)}/mo`}
                />
                <MetricCard
                  label="ROAS"
                  value={
                    ads.all_time.spend
                      ? `${(a.collected_revenue / ads.all_time.spend).toFixed(2)}x`
                      : "—"
                  }
                  icon={Target}
                  tone="fire"
                  sub={`${currency(a.collected_revenue)} back on ${currency(ads.all_time.spend)} spent`}
                />
                <MetricCard
                  label="Cost per lead (live sets)"
                  value={ads.live?.cpl ? `$${ads.live.cpl}` : "—"}
                  icon={TrendingUp}
                  tone="purple"
                  sub={
                    ads.live
                      ? `${currency(ads.live.spend)} on ${ads.live.ad_sets} live set${ads.live.ad_sets === 1 ? "" : "s"} · blended $${ads.window.cpl}`
                      : undefined
                  }
                />
              </div>

              {!!ads.live?.retired_spend && (
                <p className="text-xs text-muted-foreground">
                  Blended cost per lead includes {currency(ads.live.retired_spend)} spent by retired ad sets in this window. The live-sets number reflects the
                  current configuration.
                </p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <MetricCard label="Impressions" value={formatInt(ads.window.impressions)} icon={Eye} tone="blue" />
                <MetricCard label="Clicks" value={formatInt(ads.window.clicks)} icon={MousePointer} tone="purple" />
                <MetricCard label="CTR" value={`${ads.window.ctr}%`} icon={Percent} tone="blue" />
                <MetricCard label="CPC" value={`$${ads.window.cpc}`} icon={DollarSign} tone="people" />
                <MetricCard label="Leads" value={formatInt(ads.window.leads)} icon={Mail} tone="heart" sub={ads.window.cpl ? `$${ads.window.cpl} / lead` : undefined} />
                <MetricCard label="Purchases" value={formatInt(ads.window.purchases)} icon={ShoppingCart} tone="fire" sub={ads.window.cpa ? `$${ads.window.cpa} / sale` : undefined} />
              </div>

              {ads.daily.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Daily spend vs. recorded revenue</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Spend</th>
                          <th className="py-2 pr-4">Revenue</th>
                          <th className="py-2 pr-4">ROAS</th>
                          <th className="py-2 pr-4">Clicks</th>
                          <th className="py-2 pr-4">CTR</th>
                          <th className="py-2 pr-4">Leads</th>
                          <th className="py-2">Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ads.daily.map((d) => (
                          <tr key={d.date} className="border-t">
                            <td className="py-2 pr-4">{d.date}</td>
                            <td className="py-2 pr-4">{currency(d.spend)}</td>
                            <td className="py-2 pr-4">{currency(d.revenue)}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={d.roas >= 1 ? "default" : "secondary"}>{d.roas}x</Badge>
                            </td>
                            <td className="py-2 pr-4">{formatInt(d.clicks)}</td>
                            <td className="py-2 pr-4">{d.ctr}%</td>
                            <td className="py-2 pr-4">{formatInt(d.leads)}</td>
                            <td className="py-2">{formatInt(d.purchases)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {([
                ["Campaigns", ads.campaigns],
                ["Ad sets", ads.ad_sets],
                ["Creatives", ads.creatives],
              ] as [string, AdEntity[]][])
                .filter(([, list]) => list.length > 0)
                .map(([title, list]) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle className="text-base">{title} ({list.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[680px]">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-4">Name</th>
                            <th className="py-2 pr-4">Spend</th>
                            <th className="py-2 pr-4">Revenue</th>
                            <th className="py-2 pr-4">ROAS</th>
                            <th className="py-2 pr-4">CTR</th>
                            <th className="py-2 pr-4">CPC</th>
                            <th className="py-2 pr-4">Leads</th>
                            <th className="py-2">Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r) => (
                            <tr key={`${r.level}-${r.name}`} className="border-t">
                              <td className="py-2 pr-4 max-w-[260px]">
                                <div className="truncate font-medium">{r.name}</div>
                                {(r.campaign_name || r.adset_name) && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {[r.campaign_name, r.adset_name].filter(Boolean).join(" · ")}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 pr-4">{currency(r.spend)}</td>
                              <td className="py-2 pr-4">{currency(r.revenue)}</td>
                              <td className="py-2 pr-4">
                                <Badge variant={r.roas >= 1 ? "default" : "secondary"}>{r.roas}x</Badge>
                              </td>
                              <td className="py-2 pr-4">{r.ctr}%</td>
                              <td className="py-2 pr-4">${r.cpc}</td>
                              <td className="py-2 pr-4">{formatInt(r.leads)}</td>
                              <td className="py-2">{formatInt(r.purchases)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                ))}
            </>
          )}
        </section>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily pageviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] h-40 md:h-48">
              {data.timeline.map((d) => {
                const total = PATHS.reduce((s, p) => s + (Number(d[p]) || 0), 0);
                return (
                  <div
                    key={String(d.date)}
                    className="flex-1 bg-primary/70 hover:bg-primary rounded-t transition-colors"
                    style={{ height: `${(total / maxDay) * 100}%`, minHeight: total ? 2 : 0 }}
                    title={`${d.date}: ${total} views (webinar ${d["/webinar"]}, special ${d["/special"]})`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{String(data.timeline[0]?.date ?? "")}</span>
              <span>{String(data.timeline[data.timeline.length - 1]?.date ?? "")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Per-page cards */}
        <section className="space-y-3">
          <SectionTitle>Per-page breakdown</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {PATHS.map((p) => {
              const b = data.by_path[p];
              if (!b) return null;
              return (
                <Card key={p}>
                  <CardHeader>
                    <CardTitle className="text-base font-mono">{p}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-muted/50">Pageviews: <strong>{formatInt(b.pageviews)}</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Visitors: <strong>{formatInt(b.unique_visitors)}</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Sessions: <strong>{formatInt(b.unique_sessions)}</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Clicks: <strong>{formatInt(b.clicks)}</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Register clicks: <strong>{formatInt(b.register_clicks)}</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Video plays: <strong>{formatInt(b.video_plays)}</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Median time: <strong>{b.median_seconds_on_page}s</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50">Bounce: <strong>{b.bounce_rate_pct}%</strong></div>
                      <div className="p-2 rounded-lg bg-muted/50 col-span-2">Scrolled 75%+: <strong>{formatInt(b.deep_scroll_75_sessions)}</strong></div>
                    </div>
                    {b.top_clicks.length > 0 && (
                      <div>
                        <div className="text-xs uppercase text-muted-foreground mb-1">Top clicks</div>
                        <ul className="space-y-1">
                          {b.top_clicks.map((c) => (
                            <li key={c.value} className="flex justify-between gap-2">
                              <span className="truncate">{c.value}</span>
                              <Badge variant="secondary">{c.count}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Traffic */}
        <section className="space-y-3">
          <SectionTitle>Traffic sources</SectionTitle>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(data.traffic).map(([key, list]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-base capitalize">{key}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {list.length === 0 ? (
                    <p className="text-muted-foreground">None captured</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((r) => (
                        <li key={r.value} className="flex justify-between gap-2">
                          <span className="truncate">{r.value}</span>
                          <Badge variant="secondary">{r.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* All-time totals — kept separate from the rolling window above */}
        <section className="space-y-3">
          <SectionTitle>
            <TrendingUp className="h-5 w-5 text-success" /> All time (everything since launch)
          </SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-2">
              <Card className="border-success/25 bg-gradient-to-br from-success/10 to-background h-full">
                <CardContent className="p-4 h-full flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-success">
                    <DollarSign className="h-5 w-5" />
                    <span className="text-sm font-semibold uppercase tracking-wide">New MRR from this funnel</span>
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-bold text-foreground mt-2">{currency(a.mrr)}/mo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currency(a.collected_revenue)} from {formatInt(a.purchases)} recorded sale
                      {a.purchases === 1 ? "" : "s"} (annual plans counted as one twelfth per month)
                    </p>
                  </div>

                </CardContent>
              </Card>
            </div>
            <MetricCard
              label="All-time registrants"
              value={formatInt(a.registrants)}
              icon={Mail}
              tone="heart"
              sub={`${formatInt(a.attendees || 0)} attended`}
            />
            <MetricCard
              label="All-time pageviews"
              value={formatInt(a.pageviews)}
              icon={Eye}
              tone="blue"
              sub={a.capped ? "top 100K sampled" : undefined}
            />
          </div>

          {/* 70/30 split of the MRR above */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">70 / 30 split of MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total MRR</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{currency(a.mrr)}/mo</p>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">70% share</p>
                  <p className="text-2xl font-bold text-success mt-1">
                    {currency(+(a.mrr * 0.7).toFixed(2))}/mo
                  </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">30% share</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {currency(+(a.mrr * 0.3).toFixed(2))}/mo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {a.purchases_by_month.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recorded purchases by month</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">Month</th>
                      <th className="py-2 pr-4">Sales</th>
                      <th className="py-2 pr-4">Collected</th>
                      <th className="py-2">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.purchases_by_month.map((p) => (
                      <tr key={p.month} className="border-t">
                        <td className="py-2 pr-4">{p.month}</td>
                        <td className="py-2 pr-4">{formatInt(p.count)}</td>
                        <td className="py-2 pr-4">{currency(p.collected)}</td>
                        <td className="py-2">{currency(p.mrr)}/mo</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>
      </main>

    </>
  );
};

export default WebinarStatsSection;
