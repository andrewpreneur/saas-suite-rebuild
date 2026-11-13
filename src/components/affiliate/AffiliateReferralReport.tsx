import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MousePointerClick, Users } from "lucide-react";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { chartColors } from "@/lib/chart-colors";
import { InfoTip } from "@/components/ui/info-tip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatStrip } from "@/components/premium/StatStrip";
import { useIsMobile } from "@/hooks/use-mobile";
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
  { key: "views", label: "Views", color: chartColors.categorical[0] },
  { key: "clicks", label: "Clicks", color: chartColors.categorical[2] },
  { key: "signups", label: "Signups", color: chartColors.categorical[3] },
  { key: "revenue", label: "Revenue", color: chartColors.categorical[5] },
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

function statusVariant(kind: string): "success" | "info" | "danger" | "neutral" {
  if (kind === "active") return "success";
  if (kind === "trial") return "info";
  if (kind === "past_due") return "danger";
  return "neutral";
}

function KpiBox({
  label,
  value,
  hint,
  info,
  lead,
}: {
  label: string;
  value: string;
  hint: string;
  info?: string;
  /** The headline money figures get a larger number. */
  lead?: boolean;
}) {
  return (
    <div className="px-surface flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="px-eyebrow">{label}</p>
        {info ? (
          <TooltipProvider>
            <InfoTip label={`${label} details`}>{info}</InfoTip>
          </TooltipProvider>
        ) : null}
      </div>
      <p className={(lead ? "text-h3 " : "text-h4 ") + "mt-2 font-semibold tabular-nums tracking-tight text-foreground"}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; name: string; value: number; stroke: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-popover">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((p) => (
          <p key={p.dataKey} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: p.stroke }} aria-hidden="true" />
            {p.name}
            <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">
              {p.dataKey === "revenue" ? money(p.value) : countLabel(p.value)}
            </span>
          </p>
        ))}
      </div>
    </div>
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
  calm = false,
}: {
  activity?: ReferralActivity | null;
  series?: ActivityPoint[] | null;
  referrals?: ReferralStatusRow[] | null;
  pages?: PageAttributionSection[] | null;
  notices?: string[] | null;
  showAffiliate?: boolean;
  rangeControl?: ReactNode;
  belowChart?: ReactNode;
  /** Calm screens: the nine number cards become one strip and the chart legend carries the totals. */
  calm?: boolean;
}) {
  // Two-up on phones leaves no room for a hint beside the number.
  const hints = !useIsMobile();
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
    <div className="space-y-4 sm:space-y-6" data-affiliate-referral-report>
      {safeNotices.map((notice) => (
        <p key={notice} role="status" className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">{notice}</p>
      ))}

      {calm ? (
        <StatStrip
          stats={[
            { label: "Commission earned", value: money(safeActivity.commission), hint: hints ? "in these dates" : undefined },
            { label: "Pending payout", value: pendingLabel, hint: hints ? "not yet sent" : undefined },
            { label: hints ? "Expected from trials" : `Expected, ${trialCount} ${trialWord}`, value: plusMoney(safeActivity.expectedTrialCommission), hint: hints ? `if ${trialCount} ${trialWord} convert` : undefined },
            { label: hints ? "Active paying" : `Active, ${countLabel(safeActivity.trials)} on trial`, value: countLabel(safeActivity.active), hint: hints ? `${countLabel(safeActivity.trials)} on trial` : undefined },
          ]}
        />
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiBox lead label="Commission earned" value={money(safeActivity.commission)} hint="Rate times amount paid in those dates" />
          <KpiBox lead label="Pending payout" value={pendingLabel} hint="Invoice commissions not yet sent" />
          <KpiBox
            lead
            label="Expected 14-day trial conversion revenue"
            value={plusMoney(safeActivity.expectedTrialCommission)}
            hint={expectedInfo}
            info={expectedInfo}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
          <KpiBox label="Views" value={countLabel(safeActivity.views)} hint="Page visits in the selected dates" />
          <KpiBox label="Clicks" value={countLabel(safeActivity.clicks)} hint="Link and checkout clicks" />
          <KpiBox label="Signups" value={countLabel(safeActivity.signups)} hint="Accounts created in the selected dates" />
          <KpiBox label="Trials" value={countLabel(safeActivity.trials)} hint="Stripe trials right now" />
          <KpiBox label="Active paying" value={countLabel(safeActivity.active)} hint="Stripe active subscriptions" />
          <KpiBox label="Revenue" value={money(safeActivity.revenue)} hint="Amount paid in the selected dates" />
        </div>
        </>
      )}

      <section className="px-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Performance</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Daily activity from your links</p>
          </div>
          {rangeControl}
        </div>
        <div className="mt-4 max-w-full overflow-x-auto">
          <AnimatedTabs
            variant="segment"
            activeTab={metric}
            onChange={(id) => setMetric(id as typeof metric)}
            tabs={[
              { id: "all", label: "All" },
              { id: "views", label: "Views" },
              { id: "clicks", label: "Clicks" },
              { id: "signups", label: "Signups" },
              { id: "revenue", label: "Revenue" },
            ]}
          />
        </div>
        {safeSeries.length === 0 ? (
          <EmptyState
            icon={
              <span className="px-icon-chip">
                <MousePointerClick className="size-5" />
              </span>
            }
            title="No activity in this date range yet."
            description="Share your affiliate link, or pick a longer date range."
          />
        ) : (
          <>
            <div className="-ml-2 mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {SERIES.map((item) => (
                      <linearGradient key={item.key} id={`affiliate-fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartColors.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis allowDecimals={false} width={40} tick={{ fontSize: 12, fill: chartColors.axis }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: chartColors.axis, strokeDasharray: "3 3" }} />
                  {visibleSeries.map((item) => (
                    <Area
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      name={item.label}
                      stroke={item.color}
                      strokeWidth={2}
                      fill={`url(#affiliate-fill-${item.key})`}
                      animationDuration={500}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {visibleSeries.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  {calm ? (
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {item.key === "revenue" ? money(safeActivity.revenue) : countLabel(safeActivity[item.key])}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {belowChart}

      {safePages.map((page) => (
        <section key={page.id} className="px-surface space-y-4 p-4 sm:p-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">{page.label || page.pagePath}</h3>
            <a className="break-all font-mono text-sm text-brand underline-offset-4 hover:underline" href={page.url}>{page.url}</a>
            <p className="mt-1 text-xs text-muted-foreground">Commission rate for this page: {page.commissionRate}%</p>
          </div>
          {page.note ? <p className="text-sm text-muted-foreground">{page.note}</p> : null}
          {page.available ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                {[
                  [countLabel(page.visits), "Visits"],
                  [countLabel(page.uniqueVisitors), "Unique visitors"],
                  [countLabel(page.clicks), `Clicks · ${percent(page.clickRate)}`],
                  [countLabel(page.leads), `Leads · ${percent(page.leadRate)}`],
                  [countLabel(page.checkoutStarts), `Checkouts · ${percent(page.checkoutRate)}`],
                  [countLabel(page.purchases), `Purchases · ${percent(page.purchaseRate)}`],
                  [money(page.revenue || 0), "Revenue"],
                  [`${page.downstreamTrials ?? 0} / ${page.downstreamPaying ?? 0}`, "Trials / active"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Counts cover this page and its funnel steps. Test traffic and QA (utm_source qa_test, fbclid test) are left out.</p>
            </>
          ) : null}
        </section>
      ))}

      <section className="px-surface">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="px-icon-chip shrink-0" aria-hidden="true">
              <Users className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">{filtered.length} Referred customers</h3>
              <p className="text-sm text-muted-foreground">Status comes from Stripe. Commission is the referral rate times the amount paid.</p>
            </div>
          </div>
          {safeReferrals.length > 0 ? (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter customers"
              className="h-11 sm:h-10 sm:max-w-xs"
              aria-label="Filter referrals"
            />
          ) : null}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={
              <span className="px-icon-chip">
                <Users className="size-5" />
              </span>
            }
            title="No referrals yet."
            description={
              safeReferrals.length > 0
                ? "Nobody matches that filter. Try a different name or email."
                : "People who sign up through your link show up here with their status and your commission."
            }
          />
        ) : (
          <div className="overflow-x-auto px-2 pb-2 sm:px-4 sm:pb-4">
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
                  <TableRow key={row.id} className="align-top transition-colors hover:bg-brand-subtle/50">
                    {showAffiliate ? <TableCell className="text-sm">{row.affiliateName || "—"}</TableCell> : null}
                    <TableCell>
                      <div className="whitespace-nowrap font-medium text-foreground">{row.name || "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.kind)} className="whitespace-nowrap">{row.label}</Badge>
                      {row.cancelsAt ? <span className="mt-1 block text-xs text-muted-foreground">Cancels {formatWhen(row.cancelsAt)}</span> : null}
                      {(row.failedPayments || []).length > 0 ? (
                        <span className="mt-1 block text-xs text-destructive">{row.failedPayments?.length} failed payment{row.failedPayments?.length === 1 ? "" : "s"}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatWhen(row.trialEnd)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.plan || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatWhen(row.lastPaymentAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium tabular-nums text-foreground">{money(row.totalPaid)}</div>
                      <details className="mt-1">
                        <summary className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground hover:text-foreground">Payments ({row.payments.length})</summary>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
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
                      <div className="font-medium tabular-nums text-foreground">{money(row.totalCommission)}</div>
                      <div className="text-xs text-muted-foreground">{row.commissionRate}%</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
