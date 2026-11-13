import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ReferralPaymentRow = {
  paidAt: string;
  currency?: string;
  paid: number;
  refunded: number;
  net: number;
  commission: number;
};

export type FailedPaymentRow = {
  failedAt: string;
  amount: number;
  status: string;
};

export type ReferralStatusRow = {
  id: string;
  affiliateName?: string;
  affiliateSlug?: string | null;
  name: string | null;
  email: string;
  signupAt: string | null;
  kind: string;
  label: string;
  plan: string | null;
  trialEnd: string | null;
  cancelsAt?: string | null;
  commissionRate: number;
  payments: ReferralPaymentRow[];
  failedPayments?: FailedPaymentRow[];
  lastPaymentAt?: string | null;
  totalPaid: number;
  totalCommission: number;
  nextPaymentAt: string | null;
};

export type PageCustomerRow = {
  email: string;
  name: string | null;
  label: string;
  payments: Array<{ paidAt: string; amount: number; commission: number }>;
  subscriptionPayments: ReferralPaymentRow[];
  totalPaid: number;
  totalCommission: number;
};

export type PageAttributionSection = {
  id: string;
  label: string | null;
  url: string;
  pagePath: string;
  commissionRate: number;
  available: boolean;
  note: string | null;
  visits?: number;
  uniqueVisitors?: number;
  clicks?: number;
  leads?: number;
  checkoutStarts?: number;
  purchases?: number;
  revenue?: number;
  commission?: number;
  leadRate?: number | null;
  clickRate?: number | null;
  checkoutRate?: number | null;
  purchaseRate?: number | null;
  downstreamTrials?: number;
  downstreamPaying?: number;
  customers?: PageCustomerRow[];
};

export type ReferralActivity = {
  views: number;
  clicks: number;
  signups: number;
  trials: number;
  active: number;
  revenue: number;
  commission: number;
  pendingPayout: number | null;
  /** Commission if every current Stripe trial converts. Omitted by older function responses. */
  expectedTrialCommission?: number | null;
  expectedTrialCount?: number | null;
};

export type ActivityPoint = {
  date: string;
  label: string;
  views: number;
  clicks: number;
  signups: number;
  revenue: number;
};

const SERIES = [
  { key: "views", label: "Views", color: "hsl(var(--primary))" },
  { key: "clicks", label: "Clicks", color: "hsl(142 71% 45%)" },
  { key: "signups", label: "Signups", color: "hsl(25 95% 53%)" },
  { key: "revenue", label: "Revenue", color: "hsl(199 89% 48%)" },
] as const;

function finiteNumber(value: number | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(amount: number | null | undefined): string {
  const n = finiteNumber(amount) ?? 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function plusMoney(amount: number | null | undefined): string {
  return `+${money(amount)}`;
}

function countLabel(value: number | null | undefined): string {
  const n = finiteNumber(value) ?? 0;
  return Math.round(n).toLocaleString();
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function percent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}%`;
}

function statusVariant(kind: string): "default" | "secondary" | "destructive" | "outline" {
  if (kind === "active") return "default";
  if (kind === "trial") return "secondary";
  if (kind === "past_due") return "destructive";
  return "outline";
}

function KpiBox({ label, value, hint, info }: { label: string; value: string; hint: string; info?: string }) {
  return (
    <Card className="h-full rounded-2xl border-border/60 bg-card">
      <CardContent className="flex h-full flex-col justify-center p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {info ? (
            <TooltipProvider>
              <InfoTip label={`${label} details`}>{info}</InfoTip>
            </TooltipProvider>
          ) : null}
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function AffiliateReferralReport({
  activity,
  series,
  referrals,
  pages,
  notices,
  showAffiliate,
  rangeControl,
  belowChart,
}: {
  activity?: ReferralActivity | null;
  series?: ActivityPoint[] | null;
  referrals?: ReferralStatusRow[] | null;
  pages?: PageAttributionSection[] | null;
  notices?: string[] | null;
  showAffiliate?: boolean;
  rangeControl?: ReactNode;
  belowChart?: ReactNode;
}) {
  const safeSeries = Array.isArray(series) ? series : [];
  const safeReferrals = Array.isArray(referrals) ? referrals : [];
  const safePages = Array.isArray(pages) ? pages : [];
  const safeNotices = Array.isArray(notices) ? notices : [];
  const safeActivity: ReferralActivity = {
    views: finiteNumber(activity?.views) ?? 0,
    clicks: finiteNumber(activity?.clicks) ?? 0,
    signups: finiteNumber(activity?.signups) ?? 0,
    trials: finiteNumber(activity?.trials) ?? 0,
    active: finiteNumber(activity?.active) ?? 0,
    revenue: finiteNumber(activity?.revenue) ?? 0,
    commission: finiteNumber(activity?.commission) ?? 0,
    pendingPayout: activity?.pendingPayout == null || !Number.isFinite(Number(activity.pendingPayout))
      ? null
      : Number(activity.pendingPayout),
    expectedTrialCommission: finiteNumber(activity?.expectedTrialCommission) ?? 0,
    expectedTrialCount: finiteNumber(activity?.expectedTrialCount) ?? finiteNumber(activity?.trials) ?? 0,
  };
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState<"all" | "views" | "clicks" | "signups" | "revenue">("all");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return safeReferrals;
    return safeReferrals.filter((row) =>
      [row.name, row.email, row.affiliateName, row.affiliateSlug, row.label, row.plan]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, safeReferrals]);
  const visibleSeries = metric === "all" ? SERIES : SERIES.filter((item) => item.key === metric);
  const pendingLabel = safeActivity.pendingPayout == null ? "—" : money(safeActivity.pendingPayout);
  const trialCount = finiteNumber(safeActivity.expectedTrialCount) ?? 0;
  const trialWord = trialCount === 1 ? "trial" : "trials";
  const expectedInfo = `Commission if every current trial converts. ${trialCount} ${trialWord}.`;

  return (
    <div className="space-y-4" data-affiliate-referral-report>
      {safeNotices.map((notice) => (
        <p key={notice} className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{notice}</p>
      ))}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiBox label="Views" value={countLabel(safeActivity.views)} hint="Page visits in the selected dates" />
        <KpiBox label="Clicks" value={countLabel(safeActivity.clicks)} hint="Link and checkout clicks" />
        <KpiBox label="Signups" value={countLabel(safeActivity.signups)} hint="Accounts created in the selected dates" />
        <KpiBox label="Trials" value={countLabel(safeActivity.trials)} hint="Stripe trials right now" />
        <KpiBox label="Active paying" value={countLabel(safeActivity.active)} hint="Stripe active subscriptions" />
        <KpiBox label="Revenue" value={money(safeActivity.revenue)} hint="Amount paid in the selected dates" />
        <KpiBox label="Commission earned" value={money(safeActivity.commission)} hint="Rate times amount paid in those dates" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiBox label="Pending payout" value={pendingLabel} hint="Invoice commissions not yet sent" />
        <KpiBox
          label="Expected 14-day trial conversion revenue"
          value={plusMoney(safeActivity.expectedTrialCommission)}
          hint={expectedInfo}
          info={expectedInfo}
        />
      </div>

      <Card className="rounded-2xl border-border/60 bg-muted/30">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">Performance</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border/60 bg-background/70 p-1">
                  {(["all", "views", "clicks", "signups", "revenue"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`h-8 rounded-md px-3 text-xs capitalize ${metric === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => setMetric(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {rangeControl}
              </div>
            </div>
          </div>
          <div className="mt-4 h-[260px]">
            {safeSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this date range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {SERIES.map((item) => (
                      <linearGradient key={item.key} id={`affiliate-fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} width={40} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  {visibleSeries.map((item) => (
                    <Area
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.label}
                      stroke={item.color}
                      strokeWidth={2}
                      fill={`url(#affiliate-fill-${item.key})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {visibleSeries.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {belowChart}

      {safePages.map((page) => (
        <Card key={page.id} className="rounded-2xl border-border/60">
          <CardContent className="space-y-4 p-5">
            <div>
              <h3 className="text-lg font-bold">{page.label || page.pagePath}</h3>
              <a className="font-mono text-sm text-primary break-all" href={page.url}>{page.url}</a>
              <p className="mt-1 text-xs text-muted-foreground">Commission rate for this page: {page.commissionRate}%</p>
            </div>
            {page.note ? <p className="text-sm text-muted-foreground">{page.note}</p> : null}
            {page.available ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><p className="text-xl font-bold">{countLabel(page.visits)}</p><p className="text-xs text-muted-foreground">Visits</p></div>
                  <div><p className="text-xl font-bold">{countLabel(page.uniqueVisitors)}</p><p className="text-xs text-muted-foreground">Unique visitors</p></div>
                  <div><p className="text-xl font-bold">{countLabel(page.clicks)}</p><p className="text-xs text-muted-foreground">Clicks · {percent(page.clickRate)}</p></div>
                  <div><p className="text-xl font-bold">{countLabel(page.leads)}</p><p className="text-xs text-muted-foreground">Leads · {percent(page.leadRate)}</p></div>
                  <div><p className="text-xl font-bold">{countLabel(page.checkoutStarts)}</p><p className="text-xs text-muted-foreground">Checkouts · {percent(page.checkoutRate)}</p></div>
                  <div><p className="text-xl font-bold">{countLabel(page.purchases)}</p><p className="text-xs text-muted-foreground">Purchases · {percent(page.purchaseRate)}</p></div>
                  <div><p className="text-xl font-bold">{money(page.revenue || 0)}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
                  <div><p className="text-xl font-bold">{page.downstreamTrials ?? 0} / {page.downstreamPaying ?? 0}</p><p className="text-xs text-muted-foreground">Trials / active</p></div>
                </div>
                <p className="text-xs text-muted-foreground">Counts cover this page and its funnel steps. Test traffic and QA (utm_source qa_test, fbclid test) are left out.</p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground">{filtered.length} Referred customers</h3>
              <p className="text-sm text-muted-foreground">Status comes from Stripe. Commission is the referral rate times the amount paid.</p>
            </div>
            {safeReferrals.length > 0 ? (
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter customers"
                className="sm:max-w-xs"
                aria-label="Filter referrals"
              />
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <p className="px-5 pb-8 text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto px-5 pb-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showAffiliate ? <TableHead>Affiliate</TableHead> : null}
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trial end</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Last payment</TableHead>
                    <TableHead>Total paid</TableHead>
                    <TableHead>Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      {showAffiliate ? <TableCell className="text-sm">{row.affiliateName || "—"}</TableCell> : null}
                      <TableCell>
                        <div className="font-medium">{row.name || "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.kind)}>{row.label}</Badge>
                        {row.cancelsAt ? <span className="mt-1 block text-xs text-muted-foreground">Cancels {formatWhen(row.cancelsAt)}</span> : null}
                        {(row.failedPayments || []).length > 0 ? (
                          <span className="mt-1 block text-xs text-destructive">{row.failedPayments?.length} failed payment{row.failedPayments?.length === 1 ? "" : "s"}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{formatWhen(row.trialEnd)}</TableCell>
                      <TableCell className="text-sm">{row.plan || "—"}</TableCell>
                      <TableCell className="text-sm">{formatWhen(row.lastPaymentAt)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{money(row.totalPaid)}</div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground">Payments ({row.payments.length})</summary>
                          <ul className="mt-2 space-y-1 text-xs">
                            {row.payments.map((payment, index) => (
                              <li key={`${payment.paidAt}-${index}`}>{formatWhen(payment.paidAt)} · paid {money(payment.net)} · commission {money(payment.commission)}</li>
                            ))}
                            {(row.failedPayments || []).map((payment, index) => (
                              <li key={`failed-${payment.failedAt}-${index}`} className="text-destructive">{formatWhen(payment.failedAt)} · failed {money(payment.amount)}</li>
                            ))}
                          </ul>
                        </details>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{money(row.totalCommission)}</div>
                        <div className="text-xs text-muted-foreground">{row.commissionRate}%</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
