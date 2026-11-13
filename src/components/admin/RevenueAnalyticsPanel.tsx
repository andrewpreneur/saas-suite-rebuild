import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Download, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { renderMessageContent } from "@/lib/renderChatContent";

type Signals = Record<string, number | boolean>;

interface CustomerRow {
  segment: "churned" | "active";
  email: string | null;
  name: string | null;
  appPlan: string | null;
  stripePlan: string;
  products: string[];
  status: string;
  ltv: number;
  ltvSaas: number;
  ltvOther: number;
  mrr: number;
  payments: number;
  paymentsSaas: number;
  startedAt: string | null;
  endedAt: string | null;
  tenureDays: number;
  tenureMonths: number;
  hasAccount: boolean;
  approval: string | null;
  agencyId: string | null;
  hubUsers: number;
  clientUsers: number;
  activitySessions: number;
  lastActivityAt: string | null;
  signals: Signals;
}

interface AffiliateRow {
  segment: "affiliate_free";
  email: string;
  name: string | null;
  appPlan: string | null;
  approval: string | null;
  isAffiliateFlag: boolean;
  imputedMonthlyValue: number;
  imputedLtv: number;
  createdAt: string | null;
  tenureDays: number;
  tenureMonths: number;
  activeAccount: boolean;
  signals: Signals;
}

interface TimelineRow {
  month: string;
  newCustomers: number;
  churnedCustomers: number;
  activeStart: number;
  activeEnd: number;
  churnRate: number;
  churnRateOfStart: number;
  netRevenue: number;
  grossRevenue: number;
  refunds: number;
  charges: number;
  netRevenueSaas: number;
  grossRevenueSaas: number;
  refundsSaas: number;
  chargesSaas: number;
  newMrr: number;
  churnedLtv: number;
  churnedTenureMonths: number;
  arpu: number;
  arpuSaas: number;
}

interface CohortRow {
  month: string;
  size: number;
  stillActive: number;
  churned: number;
  churnRate: number;
  avgLtv: number;
  medianLtv: number;
  avgTenureMonths: number;
  m1Retention: number;
  m3Retention: number;
  m6Retention: number;
  newMrr: number;
}

interface MonthRevenueRow {
  month: string;
  gross: number;
  refunds: number;
  net: number;
  charges: number;
  grossSaas: number;
  refundsSaas: number;
  netSaas: number;
  chargesSaas: number;
}

interface Payload {
  generatedAt: string;
  affiliateImputedValue: number;
  summary: Record<string, number>;
  predictors: { signal: string; kind: "bool" | "num"; retained: number; churned: number; delta: number; unit: string }[];
  planBreakdown: Record<string, any>[];
  tenureBuckets: { label: string; churned: number; active: number }[];
  monthlyRevenue: MonthRevenueRow[];
  affiliateSignals: { signal: string; payingActive: number; payingChurned: number; affiliates: number }[];
  timeline: TimelineRow[];
  cohorts: CohortRow[];
  hubUserBuckets: { label: string; churned: number; active: number; churnRate: number; avgLtv: number }[];
  signalDefs: { key: string; label: string; kind: "bool" | "num" }[];
  customers: CustomerRow[];
  neverCharged: CustomerRow[];
  affiliates: AffiliateRow[];
}


const money = (n: number) =>
  `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const flat = rows.map((r) => {
    const out: Record<string, any> = {};
    Object.entries(r).forEach(([k, v]) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        Object.entries(v).forEach(([k2, v2]) => (out[`${k}_${k2}`] = v2));
      } else out[k] = Array.isArray(v) ? v.join(" | ") : v;
    });
    return out;
  });
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...flat.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const PRESET_QUESTIONS = [
  "What separates our churned customers from the ones who stay? Rank the biggest predictors.",
  "What is our real LTV and how long do people stay before cancelling?",
  "Compare Starter vs Basic vs Advanced — retention, LTV and behaviour.",
  "How do the free affiliate accounts compare to paying customers? Is their value higher?",
  "Given this data, what 3 changes would cut churn the most?",
  "How has churn changed month over month? Which months were worst and best, and what changed?",
  "Compare the newest signup cohorts against last year's — is retention and LTV improving?",
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const avgOf = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const medianOf = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return round1(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2);
};
const pctOf = (part: number, total: number) => (total ? round1((part / total) * 100) : 0);
const monthOf = (iso: string | null) => (iso ? iso.slice(0, 7) : null);
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(mo) - 1]} ${y.slice(2)}`;
};

const RANGE_PRESETS = [
  { key: "all", label: "All time", months: 0 },
  { key: "12", label: "Last 12 mo", months: 12 },
  { key: "6", label: "Last 6 mo", months: 6 },
  { key: "3", label: "Last 3 mo", months: 3 },
  { key: "1", label: "This month", months: 1 },
  { key: "ytd", label: "YTD", months: -1 },
] as const;

const num = (v: unknown) => Number(v ?? 0);

/**
 * Churn-vs-active comparisons. Each row answers "how many churned customers had
 * this, vs how many active ones" — the biggest gaps float to the top.
 */
const CONDITIONS: { label: string; group: string; test: (s: Signals) => boolean }[] = [
  { label: "We have the menu link installed", group: "Install", test: (s) => !!s.menu_link_installed },
  { label: "No menu link installed", group: "Install", test: (s) => !s.menu_link_installed },
  { label: "Dynamic install / CSS delivery on", group: "Install", test: (s) => !!s.dynamic_installation },
  { label: "Branding pushed to their SaaSSuite", group: "Branding", test: (s) => !!s.branding_pushed },
  { label: "Brand colors customised", group: "Branding", test: (s) => !!s.brand_colors_set },
  { label: "Bought the branding tool", group: "Branding", test: (s) => !!s.branding_tool_access },
  { label: "0 users on their agency id (nobody logged in)", group: "Customers", test: (s) => num(s.hub_users) === 0 },
  { label: "1 or fewer users on their agency id", group: "Customers", test: (s) => num(s.hub_users) <= 1 },
  { label: "Exactly 1 user (only them)", group: "Customers", test: (s) => num(s.hub_users) === 1 },
  { label: "2+ users (they have customers)", group: "Customers", test: (s) => num(s.hub_users) > 1 },
  { label: "5+ users on their agency id", group: "Customers", test: (s) => num(s.hub_users) >= 5 },
  { label: "A hub user active in the last 30d", group: "Customers", test: (s) => num(s.active_hub_users_30d) > 0 },
  { label: "Completed initial questions", group: "Onboarding", test: (s) => !!s.initial_questions_completed },
  { label: "Completed onboarding", group: "Onboarding", test: (s) => !!s.onboarding_completed },
  { label: "Set an agency name", group: "Onboarding", test: (s) => !!s.has_agency_name },
  { label: "Watched ≥1 video", group: "Engagement", test: (s) => num(s.videos_watched_count) >= 1 },
  { label: "Watched ≥3 videos", group: "Engagement", test: (s) => num(s.videos_watched_count) >= 3 },
  { label: "Used AI chat", group: "Engagement", test: (s) => !!s.used_ai },
  { label: "Opened a support ticket", group: "Engagement", test: (s) => !!s.opened_ticket },
  { label: "Has a tracked activity session", group: "Engagement", test: (s) => num(s.session_count) > 0 },
  { label: "3+ tracked activity sessions", group: "Engagement", test: (s) => num(s.session_count) >= 3 },
  { label: "Logged in only once", group: "Logins", test: (s) => num(s.login_count) <= 1 },
  { label: "Logged in ≥2 times", group: "Logins", test: (s) => num(s.login_count) >= 2 },
  { label: "Logged in ≥5 times", group: "Logins", test: (s) => num(s.login_count) >= 5 },
  { label: "Logged in ≥10 times", group: "Logins", test: (s) => num(s.login_count) >= 10 },
  { label: "Inactive 30+ days", group: "Logins", test: (s) => num(s.days_to_last_login) >= 30 },
  { label: "Client hub enabled", group: "Features", test: (s) => !!s.client_hub_enabled },
  { label: "Knowledge base enabled", group: "Features", test: (s) => !!s.knowledge_base_enabled },
  { label: "Support ticketing enabled", group: "Features", test: (s) => !!s.support_ticketing_enabled },
  { label: "Custom domain live", group: "Features", test: (s) => !!s.custom_domain_live },
  { label: "Had a failed payment", group: "Billing", test: (s) => num(s.payment_failure_count) > 0 },
];

const HUB_BUCKETS = [
  { label: "0 — nobody logged in", min: 0, max: 0 },
  { label: "1 — just them", min: 1, max: 1 },
  { label: "2-5 — they have customers", min: 2, max: 5 },
  { label: "6+ — real usage", min: 6, max: 1e9 },
];

export default function RevenueAnalyticsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"all" | "active" | "churned">("all");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [scope, setScope] = useState<"summary" | "full">("summary");
  const [preset, setPreset] = useState<string>("all");
  const [saasOnly, setSaasOnly] = useState(true);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("revenue-analytics", {
        body: { action: "metrics" },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as Payload);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load Stripe analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allMonths = useMemo(() => data?.timeline.map((t) => t.month) ?? [], [data]);

  // Presets drive the from/to month pickers; picking months manually switches to "custom".
  useEffect(() => {
    if (!allMonths.length || preset === "custom") return;
    const last = allMonths[allMonths.length - 1];
    const p = RANGE_PRESETS.find((x) => x.key === preset);
    if (!p || p.key === "all") {
      setFrom(allMonths[0]);
      setTo(last);
      return;
    }
    if (p.key === "ytd") {
      setFrom(`${last.slice(0, 4)}-01`);
      setTo(last);
      return;
    }
    const idx = Math.max(0, allMonths.length - p.months);
    setFrom(allMonths[idx]);
    setTo(last);
  }, [allMonths, preset]);

  const rangeFrom = from || allMonths[0] || "";
  const rangeTo = to || allMonths[allMonths.length - 1] || "";
  const inRange = useCallback((m: string | null) => !!m && (!rangeFrom || m >= rangeFrom) && (!rangeTo || m <= rangeTo), [rangeFrom, rangeTo]);

  /**
   * Everything below is recomputed for the selected months so churn, LTV and
   * predictors can be compared period over period (e.g. before vs after a
   * feature launch or campaign).
   */
  const view = useMemo(() => {
    if (!data) return null;

    // "SaaSSuite only" swaps every money figure over to the SaaSSuite-attributed
    // variant so revenue from unrelated products stops polluting the numbers.
    const timeline = data.timeline
      .filter((t) => inRange(t.month))
      .map((t) =>
        saasOnly
          ? {
              ...t,
              netRevenue: t.netRevenueSaas,
              grossRevenue: t.grossRevenueSaas,
              refunds: t.refundsSaas,
              charges: t.chargesSaas,
              arpu: t.arpuSaas,
            }
          : t,
      );
    const monthlyRevenue = data.monthlyRevenue
      .filter((m) => inRange(m.month))
      .map((m) =>
        saasOnly ? { ...m, gross: m.grossSaas, refunds: m.refundsSaas, net: m.netSaas, charges: m.chargesSaas } : m,
      );

    const scoped = data.customers.map((c) => (saasOnly ? { ...c, ltv: c.ltvSaas, payments: c.paymentsSaas } : c));
    const cohortsRaw = data.cohorts.filter((c) => inRange(c.month));

    // Customers whose subscription overlapped the window.
    const overlap = scoped.filter((c) => {
      const st = monthOf(c.startedAt);
      const en = c.segment === "churned" ? monthOf(c.endedAt) : null;
      if (st && rangeTo && st > rangeTo) return false;
      if (en && rangeFrom && en < rangeFrom) return false;
      return true;
    });
    const startedIn = scoped.filter((c) => inRange(monthOf(c.startedAt)));
    const churnedIn = scoped.filter((c) => c.segment === "churned" && inRange(monthOf(c.endedAt)));
    const activeNow = overlap.filter((c) => c.segment === "active");
    const churnedOverlap = overlap.filter((c) => c.segment === "churned");

    const cohorts = cohortsRaw.map((co) => {
      const rows = scoped.filter((r) => monthOf(r.startedAt) === co.month);
      return { ...co, avgLtv: avgOf(rows.map((r) => r.ltv)), medianLtv: medianOf(rows.map((r) => r.ltv)) };
    });

    const netRevenue = Math.round(monthlyRevenue.reduce((s2, m) => s2 + m.net, 0));
    const activeAtStart = timeline[0]?.activeStart ?? 0;
    const churnBase = activeAtStart + startedIn.length;

    const rate = (rows: CustomerRow[], key: string) => pctOf(rows.filter((r) => (r.signals as any)[key]).length, rows.length);
    const mean = (rows: CustomerRow[], key: string) => avgOf(rows.map((r) => Number((r.signals as any)[key] ?? 0)));

    /**
     * Head-to-head counts: how many churned vs active customers meet each
     * condition, sorted by the biggest percentage-point gap.
     */
    const signalComparison = CONDITIONS.map((cond) => {
      const churnedCount = churnedOverlap.filter((r) => cond.test(r.signals)).length;
      const activeCount = activeNow.filter((r) => cond.test(r.signals)).length;
      const churnedPct = pctOf(churnedCount, churnedOverlap.length);
      const activePct = pctOf(activeCount, activeNow.length);
      return {
        label: cond.label,
        group: cond.group,
        churnedCount,
        activeCount,
        churnedTotal: churnedOverlap.length,
        activeTotal: activeNow.length,
        churnedPct,
        activePct,
        gap: round1(churnedPct - activePct),
        // Of everyone meeting this condition, what share churned?
        churnRate: pctOf(churnedCount, churnedCount + activeCount),
      };
    }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    const hubBuckets = HUB_BUCKETS.map((b) => {
      const inB = (rows: CustomerRow[]) => rows.filter((r) => r.hubUsers >= b.min && r.hubUsers <= b.max);
      const ch = inB(churnedOverlap);
      const ac = inB(activeNow);
      return {
        label: b.label,
        churned: ch.length,
        active: ac.length,
        churnRate: pctOf(ch.length, ch.length + ac.length),
        avgLtv: avgOf([...ch, ...ac].map((r) => r.ltv)),
      };
    });

    const predictors = (data.signalDefs ?? []).map((sd) => {
      if (sd.kind === "bool") {
        const a = rate(activeNow, sd.key);
        const c = rate(churnedOverlap, sd.key);
        return { signal: sd.label, kind: sd.kind, retained: a, churned: c, delta: round1(a - c), unit: "%" };
      }
      const a = mean(activeNow, sd.key);
      const c = mean(churnedOverlap, sd.key);
      return { signal: sd.label, kind: sd.kind, retained: a, churned: c, delta: round1(a - c), unit: "avg" };
    }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

    const planBreakdown = ["STARTER", "BASIC", "ADVANCED", "OTHER"].map((plan) => {
      const rows = overlap.filter((r) => r.stripePlan === plan);
      const ch = rows.filter((r) => r.segment === "churned");
      const ac = rows.filter((r) => r.segment === "active");
      return {
        plan,
        customers: rows.length,
        active: ac.length,
        churned: ch.length,
        churnRate: pctOf(ch.length, rows.length),
        avgLtv: avgOf(rows.map((r) => r.ltv)),
        medianLtv: medianOf(rows.map((r) => r.ltv)),
        avgTenureMonths: avgOf(rows.map((r) => r.tenureMonths)),
        activeMrr: Math.round(ac.reduce((s2, r) => s2 + r.mrr, 0)),
        installRate: rate(rows, "menu_link_installed"),
        avgHubUsers: avgOf(rows.map((r) => r.hubUsers)),
        avgLogins: mean(rows, "login_count"),
      };
    }).filter((p) => p.customers > 0);

    const tenureBuckets = [
      { label: "0-30d", min: 0, max: 30 },
      { label: "31-60d", min: 31, max: 60 },
      { label: "61-90d", min: 61, max: 90 },
      { label: "91-180d", min: 91, max: 180 },
      { label: "181-365d", min: 181, max: 365 },
      { label: "365d+", min: 366, max: 1e9 },
    ].map((b) => ({
      label: b.label,
      churned: churnedOverlap.filter((r) => r.tenureDays >= b.min && r.tenureDays <= b.max).length,
      active: activeNow.filter((r) => r.tenureDays >= b.min && r.tenureDays <= b.max).length,
    }));

    const isAll = rangeFrom === allMonths[0] && rangeTo === allMonths[allMonths.length - 1];

    const summary =
      isAll && !saasOnly
        ? data.summary
        : {
            ...data.summary,
            payingCustomers: overlap.length,
            activeCustomers: activeNow.length,
            churnedCustomers: churnedIn.length,
            churnRate: pctOf(churnedIn.length, churnBase),
            activeMrr: Math.round(activeNow.reduce((s2, r) => s2 + r.mrr, 0)),
            lifetimeNetRevenue: netRevenue,
            avgLtv: avgOf(overlap.map((r) => r.ltv)),
            medianLtv: medianOf(overlap.map((r) => r.ltv)),
            trimmedAvgLtv: avgOf(overlap.map((r) => r.ltv)),
            avgLtvChurned: avgOf(churnedIn.map((r) => r.ltv)),
            avgLtvActive: avgOf(activeNow.map((r) => r.ltv)),
            avgTenureMonths: avgOf(overlap.map((r) => r.tenureMonths)),
            avgTenureMonthsChurned: avgOf(churnedIn.map((r) => r.tenureMonths)),
            medianTenureMonthsChurned: medianOf(churnedIn.map((r) => r.tenureMonths)),
            avgPaymentsChurned: avgOf(churnedIn.map((r) => r.payments)),
          };

    return {
      isAll,
      timeline,
      cohorts,
      monthlyRevenue,
      customers: overlap,
      newCustomers: startedIn.length,
      newMrr: Math.round(startedIn.reduce((s2, r) => s2 + r.mrr, 0)),
      churnedInRange: churnedIn.length,
      netRevenue,
      summary,
      predictors,
      signalComparison,
      hubBuckets,
      planBreakdown,
      tenureBuckets,
    };
  }, [data, inRange, rangeFrom, rangeTo, allMonths, saasOnly]);


  const aiContext = useMemo(() => {
    if (!data || !view) return {};
    const base = {
      generatedAt: data.generatedAt,
      dateRange: { from: rangeFrom, to: rangeTo, isAllTime: view.isAll },
      revenueScope: saasOnly ? "SaaSSuite products only" : "all Stripe products",
      affiliateImputedValue: data.affiliateImputedValue,
      summary: view.summary,
      signalComparison: view.signalComparison,
      hubUserBuckets: view.hubBuckets,
      predictors: view.predictors,
      planBreakdown: view.planBreakdown,
      tenureBuckets: view.tenureBuckets,
      monthlyRevenue: view.monthlyRevenue,
      monthlyTimeline: view.timeline,
      signupCohorts: view.cohorts,

      allTimeSummary: data.summary,
      allTimeTimeline: data.timeline,
      affiliateSignals: data.affiliateSignals,
    };
    if (scope === "summary") return base;
    return {
      ...base,
      customers: view.customers,
      affiliates: data.affiliates.slice(0, 400).map((a) => ({
        email: a.email,
        plan: a.appPlan,
        tenureMonths: a.tenureMonths,
        imputedLtv: a.imputedLtv,
        activeAccount: a.activeAccount,
        signals: a.signals,
      })),
    };
  }, [data, view, scope, rangeFrom, rangeTo, saasOnly]);

  const ask = useCallback(
    async (q: string) => {
      if (!q.trim() || !data) return;
      setAsking(true);
      setChat((c) => [...c, { role: "user", content: q }]);
      setQuestion("");
      try {
        const { data: res, error } = await supabase.functions.invoke("revenue-analytics", {
          body: { action: "ask", question: q, context: aiContext, history: chat.slice(-6) },
        });
        if (error) throw error;
        if ((res as any)?.error) throw new Error((res as any).error);
        setChat((c) => [...c, { role: "assistant", content: (res as any).content || "(no response)" }]);
      } catch (e: any) {
        toast.error(e?.message ?? "AI analysis failed");
        setChat((c) => [...c, { role: "assistant", content: `Error: ${e?.message ?? "failed"}` }]);
      } finally {
        setAsking(false);
      }
    },
    [aiContext, chat, data],
  );

  const filteredCustomers = useMemo(() => {
    if (!view) return [];
    const q = search.trim().toLowerCase();
    return view.customers
      .filter((c) => (segment === "all" ? true : c.segment === segment))
      .filter((c) => !q || `${c.email ?? ""} ${c.name ?? ""} ${c.products.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => b.ltv - a.ltv);
  }, [view, search, segment]);

  const s: Record<string, number> = (view?.summary as any) ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Revenue, Churn & LTV</h2>
          <p className="text-sm text-muted-foreground">
            Live Stripe subscription data joined with platform usage.{" "}
            {data ? `Updated ${new Date(data.generatedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={() => data && download("saassuite-subscribers.csv", toCsv(data.customers))}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
          Pulling Stripe subscriptions, charges and product history…
        </Card>
      ) : null}

      {data && view ? (
        <>
          {/* Date range — every metric, chart and table below respects this window */}
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period</span>
            {RANGE_PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? "default" : "outline"}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={saasOnly ? "default" : "outline"}
              onClick={() => setSaasOnly((v) => !v)}
              title="Exclude revenue from products unrelated to SaaSSuite"
            >
              {saasOnly ? "SaaSSuite only ✓" : "SaaSSuite only"}
            </Button>
            <div className="ml-auto flex items-center gap-2">

              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={rangeFrom}
                onChange={(e) => {
                  setPreset("custom");
                  setFrom(e.target.value);
                }}
              >
                {allMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">to</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={rangeTo}
                onChange={(e) => {
                  setPreset("custom");
                  setTo(e.target.value);
                }}
              >
                {allMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <Badge variant={view.isAll ? "secondary" : "default"}>
                {view.isAll ? "All time" : `${monthLabel(rangeFrom)} – ${monthLabel(rangeTo)}`}
              </Badge>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Net revenue in period"
              value={money(view.netRevenue)}
              hint={`${view.newCustomers} new customers · ${money(view.newMrr)} new MRR`}
            />
            <Stat
              label="Churned in period"
              value={`${view.churnedInRange}`}
              hint={`${s.churnRate}% of customers paying in the window`}
            />
            <Stat label="Active MRR" value={money(s.activeMrr)} hint={`${s.activeCustomers} paying subs live`} />
            <Stat
              label="Avg LTV"
              value={money(s.avgLtv)}
              hint={`median ${money(s.medianLtv)} · trimmed ${money(s.trimmedAvgLtv)}`}
            />
            <Stat
              label="Avg lifetime"
              value={`${s.avgTenureMonths} mo`}
              hint={`churned avg ${s.avgTenureMonthsChurned} mo · median ${s.medianTenureMonthsChurned} mo`}
            />
            <Stat
              label={view.isAll ? "Lifetime net revenue" : "Net revenue (window)"}
              value={money(s.lifetimeNetRevenue)}
              hint="charges minus refunds"
            />
            <Stat label="Churned LTV" value={money(s.avgLtvChurned)} hint={`${s.avgPaymentsChurned} payments avg`} />
            <Stat label="Active LTV so far" value={money(s.avgLtvActive)} hint="still accruing" />
            <Stat
              label="Free affiliate accounts"
              value={`${s.affiliateActiveAccounts}`}
              hint={`imputed ${money(s.affiliateImputedMrr)}/mo · avg imputed LTV ${money(s.affiliateAvgImputedLtv)}`}
            />
          </div>

          <Tabs defaultValue="revenue">
            <TabsList className="flex-wrap">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="trends">Churn over time</TabsTrigger>
              <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
              <TabsTrigger value="churn">Churn patterns</TabsTrigger>
              <TabsTrigger value="ltv">LTV & retention</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="affiliates">Affiliates ($67)</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="ai">AI analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-4 pt-4">
              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Monthly net revenue</div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={view.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: any) => money(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="net" name="Net" stroke="hsl(var(--primary))" strokeWidth={2} />
                      <Line type="monotone" dataKey="gross" name="Gross" stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Refunds</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Charges</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...view.monthlyRevenue].reverse().map((m) => (
                      <TableRow key={m.month}>
                        <TableCell>{m.month}</TableCell>
                        <TableCell>{money(m.gross)}</TableCell>
                        <TableCell>{money(m.refunds)}</TableCell>
                        <TableCell className="font-semibold">{money(m.net)}</TableCell>
                        <TableCell>{m.charges}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4 pt-4">
              <Card className="p-4">
                <div className="mb-1 text-sm font-semibold">Monthly churn rate vs customers</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Churn rate = customers who cancelled that month ÷ customers paying that month. Watch this line drop
                  after feature launches and campaigns.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={view.timeline}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" tickFormatter={monthLabel} fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" unit="%" fontSize={11} />
                      <Tooltip labelFormatter={(l: any) => monthLabel(String(l))} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="newCustomers" name="New" fill="hsl(var(--primary))" />
                      <Bar yAxisId="left" dataKey="churnedCustomers" name="Churned" fill="hsl(var(--destructive))" />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="churnRate"
                        name="Churn rate %"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Active customers &amp; net revenue by month</div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={view.timeline}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" tickFormatter={monthLabel} fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} />
                      <Tooltip labelFormatter={(l: any) => monthLabel(String(l))} />
                      <Legend />
                      <Bar yAxisId="right" dataKey="netRevenue" name="Net revenue" fill="hsl(var(--muted-foreground))" />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="activeEnd"
                        name="Active at month end"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 overflow-x-auto">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Month by month</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => download("saassuite-monthly-trend.csv", toCsv(view.timeline))}
                  >
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>New</TableHead>
                      <TableHead>Churned</TableHead>
                      <TableHead>Churn %</TableHead>
                      <TableHead>Active (end)</TableHead>
                      <TableHead>Net revenue</TableHead>
                      <TableHead>ARPU</TableHead>
                      <TableHead>New MRR</TableHead>
                      <TableHead>Avg churned LTV</TableHead>
                      <TableHead>Avg lifetime at churn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...view.timeline].reverse().map((t) => (
                      <TableRow key={t.month}>
                        <TableCell className="font-medium">{monthLabel(t.month)}</TableCell>
                        <TableCell>{t.newCustomers}</TableCell>
                        <TableCell>{t.churnedCustomers}</TableCell>
                        <TableCell>
                          <Badge variant={t.churnRate >= 10 ? "destructive" : "secondary"}>{t.churnRate}%</Badge>
                        </TableCell>
                        <TableCell>{t.activeEnd}</TableCell>
                        <TableCell className="font-semibold">{money(t.netRevenue)}</TableCell>
                        <TableCell>{money(t.arpu)}</TableCell>
                        <TableCell>{money(t.newMrr)}</TableCell>
                        <TableCell>{t.churnedCustomers ? money(t.churnedLtv) : "—"}</TableCell>
                        <TableCell>{t.churnedCustomers ? `${t.churnedTenureMonths} mo` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="cohorts" className="space-y-4 pt-4">
              <Card className="p-4">
                <div className="mb-1 text-sm font-semibold">Signup cohorts — LTV and retention by join month</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Each row is everyone who started paying in that month. If onboarding and features are improving, newer
                  cohorts should show higher month-1/3 retention and LTV than older ones.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={view.cohorts}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" tickFormatter={monthLabel} fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" unit="%" fontSize={11} />
                      <Tooltip labelFormatter={(l: any) => monthLabel(String(l))} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="avgLtv" name="Avg LTV ($)" fill="hsl(var(--primary))" />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="m1Retention"
                        name="Reached month 1 %"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="m3Retention"
                        name="Reached month 3 %"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-4 overflow-x-auto">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Cohort table</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => download("saassuite-cohorts.csv", toCsv(view.cohorts))}
                  >
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Still active</TableHead>
                      <TableHead>Churned</TableHead>
                      <TableHead>Churn %</TableHead>
                      <TableHead>Avg LTV</TableHead>
                      <TableHead>Median LTV</TableHead>
                      <TableHead>Avg lifetime</TableHead>
                      <TableHead>M1</TableHead>
                      <TableHead>M3</TableHead>
                      <TableHead>M6</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...view.cohorts].reverse().map((c) => (
                      <TableRow key={c.month}>
                        <TableCell className="font-medium">{monthLabel(c.month)}</TableCell>
                        <TableCell>{c.size}</TableCell>
                        <TableCell>{c.stillActive}</TableCell>
                        <TableCell>{c.churned}</TableCell>
                        <TableCell>{c.churnRate}%</TableCell>
                        <TableCell className="font-semibold">{money(c.avgLtv)}</TableCell>
                        <TableCell>{money(c.medianLtv)}</TableCell>
                        <TableCell>{c.avgTenureMonths} mo</TableCell>
                        <TableCell>{c.m1Retention}%</TableCell>
                        <TableCell>{c.m3Retention}%</TableCell>
                        <TableCell>{c.m6Retention}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="churn" className="space-y-4 pt-4">
              <Card className="p-4">
                <div className="mb-1 text-sm font-semibold">
                  Users on their agency id — churn by how many people actually logged in
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  0 = neither they nor any customer ever logged into their hub. 1 = only them. 2+ = they have real
                  customers onboarding.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Users on agency id</TableHead>
                      <TableHead>Churned</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Churn rate</TableHead>
                      <TableHead>Avg LTV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.hubBuckets.map((b) => (
                      <TableRow key={b.label}>
                        <TableCell className="font-medium">{b.label}</TableCell>
                        <TableCell className="text-destructive">{b.churned}</TableCell>
                        <TableCell className="text-primary">{b.active}</TableCell>
                        <TableCell>
                          <Badge variant={b.churnRate >= 50 ? "destructive" : "secondary"}>{b.churnRate}%</Badge>
                        </TableCell>
                        <TableCell>{money(b.avgLtv)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="p-4">
                <div className="mb-1 text-sm font-semibold">Churned vs active — who has what</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Counts of churned ({view.signalComparison[0]?.churnedTotal ?? 0}) and active (
                  {view.signalComparison[0]?.activeTotal ?? 0}) customers meeting each condition, sorted by the biggest
                  gap. “Churn rate” = of everyone meeting the condition, what share churned.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Condition</TableHead>
                      <TableHead>Churned</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Gap</TableHead>
                      <TableHead>Churn rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.signalComparison.map((c) => (
                      <TableRow key={c.label}>
                        <TableCell>
                          <div className="font-medium">{c.label}</div>
                          <div className="text-xs text-muted-foreground">{c.group}</div>
                        </TableCell>
                        <TableCell className="text-destructive">
                          {c.churnedCount} / {c.churnedTotal}
                          <span className="ml-1 text-xs text-muted-foreground">({c.churnedPct}%)</span>
                        </TableCell>
                        <TableCell className="text-primary">
                          {c.activeCount} / {c.activeTotal}
                          <span className="ml-1 text-xs text-muted-foreground">({c.activePct}%)</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.gap > 0 ? "destructive" : "default"}>
                            {c.gap > 0 ? "+" : ""}
                            {c.gap}pp {c.gap > 0 ? "churn" : "retain"}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.churnRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="p-4">
                <div className="mb-1 text-sm font-semibold">Raw signal averages — retained vs churned</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Percentages are share with the signal; “avg” rows are averages. Positive delta = retained customers do
                  more of it.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Signal</TableHead>
                      <TableHead>Retained</TableHead>
                      <TableHead>Churned</TableHead>
                      <TableHead>Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.predictors.map((p) => (
                      <TableRow key={p.signal}>
                        <TableCell>{p.signal}</TableCell>
                        <TableCell>{p.kind === "bool" ? `${p.retained}%` : p.retained}</TableCell>
                        <TableCell>{p.kind === "bool" ? `${p.churned}%` : p.churned}</TableCell>
                        <TableCell>
                          <Badge variant={p.delta >= 0 ? "default" : "destructive"}>
                            {p.delta > 0 ? "+" : ""}
                            {p.delta}
                            {p.kind === "bool" ? "pp" : ""}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>


            <TabsContent value="ltv" className="space-y-4 pt-4">
              <Card className="p-4">
                <div className="mb-3 text-sm font-semibold">Lifetime distribution (customers by tenure)</div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={view.tenureBuckets}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="churned" name="Churned" fill="hsl(var(--destructive))" />
                      <Bar dataKey="active" name="Active" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Median churned lifetime" value={`${s.medianTenureMonthsChurned} mo`} />
                <Stat label="Avg payments before churn" value={`${s.avgPaymentsChurned}`} />
                <Stat label="Never-charged trials" value={`${s.neverChargedTrials}`} hint="excluded from LTV" />
              </div>
            </TabsContent>

            <TabsContent value="plans" className="space-y-4 pt-4">
              <Card className="p-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Churned</TableHead>
                      <TableHead>Churn %</TableHead>
                      <TableHead>Avg LTV</TableHead>
                      <TableHead>Median LTV</TableHead>
                      <TableHead>Avg tenure</TableHead>
                      <TableHead>Active MRR</TableHead>
                      <TableHead>Menu link %</TableHead>
                      <TableHead>Avg hub users</TableHead>
                      <TableHead>Avg logins</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.planBreakdown.map((p) => (
                      <TableRow key={p.plan}>
                        <TableCell className="font-semibold">{p.plan}</TableCell>
                        <TableCell>{p.customers}</TableCell>
                        <TableCell>{p.active}</TableCell>
                        <TableCell>{p.churned}</TableCell>
                        <TableCell>{p.churnRate}%</TableCell>
                        <TableCell>{money(p.avgLtv)}</TableCell>
                        <TableCell>{money(p.medianLtv)}</TableCell>
                        <TableCell>{p.avgTenureMonths} mo</TableCell>
                        <TableCell>{money(p.activeMrr)}</TableCell>
                        <TableCell>{p.installRate}%</TableCell>
                        <TableCell>{p.avgHubUsers}</TableCell>
                        <TableCell>{p.avgLogins}</TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="affiliates" className="space-y-4 pt-4">
              <Card className="p-4">
                <div className="mb-1 text-sm font-semibold">Free affiliate accounts (no Stripe sub)</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Valued at ${data.affiliateImputedValue}/mo each — these signed up to HighLevel under us and get
                  lifetime access.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Signal</TableHead>
                      <TableHead>Paying (active)</TableHead>
                      <TableHead>Paying (churned)</TableHead>
                      <TableHead>Affiliates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.affiliateSignals.map((a) => (
                      <TableRow key={a.signal}>
                        <TableCell>{a.signal}</TableCell>
                        <TableCell>{a.payingActive}%</TableCell>
                        <TableCell>{a.payingChurned}%</TableCell>
                        <TableCell className="font-semibold">{a.affiliates}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <Card className="p-4 overflow-x-auto">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Top affiliate accounts by imputed LTV</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => download("saassuite-affiliates.csv", toCsv(data.affiliates))}
                  >
                    <Download className="mr-2 h-4 w-4" /> Export
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Tenure</TableHead>
                      <TableHead>Imputed LTV</TableHead>
                      <TableHead>Logins</TableHead>
                      <TableHead>Installed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...data.affiliates]
                      .filter((a) => a.activeAccount)
                      .sort((a, b) => b.imputedLtv - a.imputedLtv)
                      .slice(0, 100)
                      .map((a) => (
                        <TableRow key={a.email}>
                          <TableCell>{a.email}</TableCell>
                          <TableCell>{a.appPlan ?? "—"}</TableCell>
                          <TableCell>{a.approval ?? "—"}</TableCell>
                          <TableCell>{a.tenureMonths} mo</TableCell>
                          <TableCell>{money(a.imputedLtv)}</TableCell>
                          <TableCell>{String(a.signals.login_count ?? 0)}</TableCell>
                          <TableCell>{a.signals.install_confirmed ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="customers" className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Search email, name or product…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                {(["all", "active", "churned"] as const).map((v) => (
                  <Button key={v} size="sm" variant={segment === v ? "default" : "outline"} onClick={() => setSegment(v)}>
                    {v}
                  </Button>
                ))}
                <span className="self-center text-xs text-muted-foreground">{filteredCustomers.length} customers</span>
              </div>
              <Card className="p-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>LTV</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Payments</TableHead>
                      <TableHead>Tenure</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Menu link</TableHead>
                      <TableHead>Branding</TableHead>
                      <TableHead>Hub users</TableHead>
                      <TableHead>Logins</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.slice(0, 300).map((c) => (
                      <TableRow key={`${c.email}-${c.startedAt}`}>
                        <TableCell>{c.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.segment === "churned" ? "destructive" : "default"}>{c.status}</Badge>
                        </TableCell>
                        <TableCell>{c.stripePlan}</TableCell>
                        <TableCell className="font-semibold">{money(c.ltv)}</TableCell>
                        <TableCell>{money(c.mrr)}</TableCell>
                        <TableCell>{c.payments}</TableCell>
                        <TableCell>{c.tenureMonths} mo</TableCell>
                        <TableCell>{c.startedAt ? c.startedAt.slice(0, 10) : "—"}</TableCell>
                        <TableCell>{c.endedAt ? c.endedAt.slice(0, 10) : "—"}</TableCell>
                        <TableCell>{c.signals.menu_link_installed ? "Yes" : "No"}</TableCell>
                        <TableCell>{c.signals.branding_pushed ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          {c.hubUsers}
                          {c.clientUsers > 0 ? (
                            <span className="ml-1 text-xs text-muted-foreground">({c.clientUsers} clients)</span>
                          ) : null}
                        </TableCell>
                        <TableCell>{String(c.signals.login_count ?? 0)}</TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 pt-4">
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Ask AI about this data</span>
                  <div className="ml-auto flex gap-2">
                    {(["summary", "full"] as const).map((v) => (
                      <Button key={v} size="sm" variant={scope === v ? "default" : "outline"} onClick={() => setScope(v)}>
                        {v === "summary" ? "Aggregates only" : "Include customer rows"}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_QUESTIONS.map((q) => (
                    <Button key={q} size="sm" variant="outline" disabled={asking} onClick={() => ask(q)}>
                      {q.length > 52 ? `${q.slice(0, 52)}…` : q}
                    </Button>
                  ))}
                </div>
                <Textarea
                  placeholder="e.g. Which churned accounts never installed the menu link, and what did they have in common?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button onClick={() => ask(question)} disabled={asking || !question.trim()}>
                    {asking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Analyze
                  </Button>
                  {chat.length ? (
                    <Button variant="ghost" onClick={() => setChat([])}>
                      Clear
                    </Button>
                  ) : null}
                </div>
              </Card>

              {chat.map((m, i) => (
                <Card key={i} className={`p-4 ${m.role === "user" ? "bg-muted/40" : ""}`}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.role === "user" ? "You" : "AI analyst"}
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-sm text-foreground">
                    {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
                  </div>
                </Card>
              ))}
              {asking ? (
                <Card className="p-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Analyzing…
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
