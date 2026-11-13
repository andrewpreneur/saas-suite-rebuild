/** Pure affiliate referral and page-attribution rules. No Deno, no network. */

export const DEFAULT_COMMISSION_PERCENT = 30;
export const DEFAULT_PAGE_STATS_DAYS = 45;
export const PAGE_STATS_MAX_DAYS = 366;

const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export type ReferralKind = "trial" | "active" | "past_due" | "canceled" | "unknown";

export type AccountSnapshot = {
  plan?: string | null;
  billingState?: string | null;
  approval?: string | null;
  source?: string | null;
  trialSource?: string | null;
  trialStart?: string | null;
  trialLength?: number | null;
  cancelAccessUntil?: string | null;
  referralStatus?: string | null;
};

export type SubscriptionSnapshot = {
  status?: string | null;
  plan?: string | null;
  trialEnd?: string | null;
  periodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  cancelAt?: string | null;
  created?: number | null;
  /** Recurring price after discounts, in major units. Null when Stripe sent no unit amount. */
  convertPrice?: number | null;
};

export type ClassifiedReferral = {
  kind: ReferralKind;
  label: string;
  plan: string | null;
  trialEnd: string | null;
  nextPaymentAt: string | null;
};

export type FailedPayment = {
  id: string;
  failedAt: string;
  currency: string;
  amount: number;
  status: string;
};

export type BillingLookup = {
  emails: string[];
  customerIds: string[];
};

export type CollectedPayment = {
  id: string;
  paidAt: string;
  createdUnix: number | null;
  currency: string;
  /** Amount Stripe collected, in major units, before refunds. */
  paid: number;
  /** Cash refunded or credited back, in major units. */
  refunded: number;
  /** paid minus refunded. Commission is calculated on this. */
  net: number;
  commission: number;
  description: string | null;
};

export type ReferralPaymentView = {
  paidAt: string;
  currency: string;
  paid: number;
  refunded: number;
  net: number;
  commission: number;
};

export type ReferralTotals = {
  activeTrials: number;
  payingCustomers: number;
  totalPaid: number;
  totalCommission: number;
  nextExpectedPaymentAt: string | null;
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeCommissionPercent(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return roundMoney(n);
}

/** Rate stored on a new affiliate_referrals row. Existing rows keep their own rate. */
export function rateForNewReferral(affiliateRate: unknown): number {
  return normalizeCommissionPercent(affiliateRate) ?? DEFAULT_COMMISSION_PERCENT;
}

/** Rate used when a payment is commissioned. The referral row is the snapshot. */
export function rateForReferral(referralRate: unknown): number {
  return normalizeCommissionPercent(referralRate) ?? DEFAULT_COMMISSION_PERCENT;
}

export function commissionOnAmount(amount: number, percent: number): number {
  return roundMoney(amount * (percent / 100));
}

export function majorUnits(minor: number, currency: string | null | undefined): number {
  const code = (currency || "usd").toLowerCase();
  const amount = Math.max(0, Math.round(Number(minor) || 0));
  if (ZERO_DECIMAL.has(code)) return amount;
  return amount / 100;
}

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "***";
  return `${trimmed.slice(0, at).slice(0, 2)}***@${trimmed.slice(at + 1)}`;
}

/** What to tell the portal when the daily chart query does not return rows. */
export function seriesFailureNote(
  error: { message?: string; code?: string } | null | undefined,
  keptPrevious: boolean,
): string {
  if (isMissingSchema(error, "affiliate_portal_series")) {
    return "The activity chart needs the affiliate stats migration.";
  }
  const message = (error?.message || "").toLowerCase();
  const timedOut = error?.code === "57014" || message.includes("statement timeout") || message.includes("canceling statement");
  const why = timedOut ? "The activity chart query timed out." : "The activity chart could not be loaded.";
  if (keptPrevious) return `${why} Showing the last saved chart.`;
  return `${why} It will be tried again on the next refresh.`;
}

export function isMissingSchema(error: { message?: string; code?: string } | null | undefined, name: string): boolean {
  if (!error) return false;
  const code = error.code || "";
  const msg = (error.message || "").toLowerCase();
  const target = name.toLowerCase();
  if (!msg.includes(target) && code !== "42P01" && code !== "42703" && code !== "PGRST204" && code !== "PGRST205" && code !== "PGRST202") {
    return false;
  }
  return msg.includes(target) || code === "42P01" || code === "42703" || code === "PGRST202" || code === "PGRST204" || code === "PGRST205";
}

export function unixToIso(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

export function displayPlan(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  const n = trimmed.toLowerCase();
  if (n.includes("elite")) return "Elite";
  if (n.includes("advanced") || n.includes("enhanced") || n.includes("premium") || n.includes("special")) return "Advanced";
  if (n.includes("basic")) return "Basic";
  if (n.includes("starter")) return "Starter";
  return trimmed;
}

/** Monthly list price when a trial subscription has no Stripe unit amount. */
const PLAN_LIST_PRICE: Record<string, number> = {
  Starter: 0,
  Basic: 27,
  Advanced: 97,
  Elite: 97,
};

export function planListPrice(plan: string | null | undefined): number | null {
  const named = displayPlan(plan);
  if (!named || !(named in PLAN_LIST_PRICE)) return null;
  return PLAN_LIST_PRICE[named];
}

type DiscountLike = {
  coupon?: { percent_off?: number | null; amount_off?: number | null } | null;
  source?: { coupon?: { percent_off?: number | null; amount_off?: number | null } | null } | null;
  percent_off?: number | null;
  amount_off?: number | null;
};

function discountEntries(value: unknown): DiscountLike[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object") as DiscountLike[];
  if (typeof value === "object") return [value as DiscountLike];
  return [];
}

/** Unit amount after percent and amount coupons. Unexpanded discount ids are ignored. */
export function priceAfterDiscounts(unitAmountMinor: number, discounts: DiscountLike[], currency: string): number {
  let minor = Math.max(0, Number(unitAmountMinor) || 0);
  for (const discount of discounts) {
    const coupon = discount.coupon || discount.source?.coupon || discount;
    const percent = Number(coupon.percent_off);
    const amountOff = Number(coupon.amount_off);
    if (Number.isFinite(percent) && percent > 0) minor *= 1 - Math.min(percent, 100) / 100;
    else if (Number.isFinite(amountOff) && amountOff > 0) minor -= amountOff;
  }
  return majorUnits(Math.max(0, Math.round(minor)), currency);
}

/**
 * Price a subscription will bill when the trial converts.
 * Uses the first item's unit amount after subscription and item discounts.
 */
export function subscriptionConvertPrice(sub: Record<string, unknown> | null | undefined): number | null {
  if (!sub) return null;
  const items = sub.items as { data?: Array<Record<string, unknown>> } | undefined;
  const item = items?.data?.[0];
  if (!item) return null;
  const price = item.price as { unit_amount?: number | null; currency?: string | null } | undefined;
  const unit = price?.unit_amount;
  if (unit == null || !Number.isFinite(Number(unit))) return null;
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const currency = price?.currency || (typeof sub.currency === "string" ? sub.currency : "usd");
  const subscriptionDiscounts = discountEntries(sub.discounts);
  const itemDiscounts = discountEntries(item.discounts);
  const discounts = [
    ...(subscriptionDiscounts.length ? subscriptionDiscounts : discountEntries(sub.discount)),
    ...(itemDiscounts.length ? itemDiscounts : discountEntries(item.discount)),
  ];
  return priceAfterDiscounts(Math.round(Number(unit) * quantity), discounts, currency);
}

export type ExpectedTrialInput = {
  kind?: string | null;
  commissionRate?: unknown;
  convertPrice?: number | null;
  plan?: string | null;
};

/** Commission if every referral currently in Stripe Trial converts at its price. */
export function expectedTrialCommission(rows: ExpectedTrialInput[]): { amount: number; trials: number } {
  let amount = 0;
  let trials = 0;
  for (const row of rows) {
    if (row.kind !== "trial") continue;
    trials += 1;
    const stripePrice = row.convertPrice;
    const price = stripePrice != null && Number.isFinite(Number(stripePrice))
      ? Number(stripePrice)
      : planListPrice(row.plan);
    if (price == null || !Number.isFinite(price)) continue;
    amount += commissionOnAmount(Math.max(0, price), rateForReferral(row.commissionRate));
  }
  return { amount: roundMoney(amount), trials };
}

export function accountTrialEnd(account: AccountSnapshot): string | null {
  if (account.trialStart) {
    const start = Date.parse(account.trialStart);
    const days = account.trialLength && account.trialLength > 0 ? account.trialLength : 0;
    if (!Number.isNaN(start) && days > 0) return new Date(start + days * 86_400_000).toISOString();
  }
  const source = (account.trialSource || "").toLowerCase();
  if ((source === "manual_basic_30day" || source === "one_feature_kit_30day") && account.cancelAccessUntil) {
    const end = Date.parse(account.cancelAccessUntil);
    if (!Number.isNaN(end)) return new Date(end).toISOString();
  }
  return null;
}

function futureIso(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time) || time <= now.getTime()) return null;
  return new Date(time).toISOString();
}

/**
 * Trial / Active / Past due / Canceled come only from the live Stripe subscription.
 * Referral row status and created_at are not billing status.
 */
export function classifyReferral(
  subscription: SubscriptionSnapshot | null,
  now = new Date(),
): ClassifiedReferral {
  const plan = displayPlan(subscription?.plan);
  const status = (subscription?.status || "").toLowerCase();
  if (!status) {
    return { kind: "unknown", label: "No subscription", plan: null, trialEnd: null, nextPaymentAt: null };
  }
  if (status === "past_due" || status === "unpaid") {
    return { kind: "past_due", label: "Past due", plan, trialEnd: null, nextPaymentAt: null };
  }
  if (status === "trialing") {
    return {
      kind: "trial",
      label: "Trial",
      plan,
      trialEnd: subscription?.trialEnd || null,
      nextPaymentAt: futureIso(subscription?.trialEnd, now),
    };
  }
  if (status === "active") {
    const canceling = subscription?.cancelAtPeriodEnd ? futureIso(subscription.cancelAt || subscription.periodEnd, now) : null;
    return {
      kind: "active",
      label: "Active",
      plan,
      trialEnd: null,
      nextPaymentAt: canceling ? null : futureIso(subscription?.periodEnd, now),
    };
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return { kind: "canceled", label: "Canceled", plan, trialEnd: null, nextPaymentAt: null };
  }
  return { kind: "unknown", label: "No subscription", plan, trialEnd: null, nextPaymentAt: null };
}

/** App email plus an optional Stripe email / customer id. Neither address is dropped. */
export function billingLookupKeys(
  appEmail: string,
  override?: { stripeEmail?: string | null; stripeCustomerId?: string | null } | null,
): BillingLookup {
  const emails = new Set<string>();
  const app = appEmail.trim().toLowerCase();
  if (app.includes("@")) emails.add(app);
  const extra = (override?.stripeEmail || "").trim().toLowerCase();
  if (extra.includes("@")) emails.add(extra);
  const customerId = (override?.stripeCustomerId || "").trim();
  return {
    emails: [...emails],
    customerIds: customerId.startsWith("cus_") ? [customerId] : [],
  };
}

const SUBSCRIPTION_RANK: Record<string, number> = {
  active: 50,
  trialing: 40,
  past_due: 30,
  unpaid: 30,
  paused: 20,
  canceled: 10,
  incomplete: 5,
  incomplete_expired: 1,
};

export function pickSubscription(subscriptions: SubscriptionSnapshot[]): SubscriptionSnapshot | null {
  let best: SubscriptionSnapshot | null = null;
  let bestRank = -1;
  for (const subscription of subscriptions) {
    const rank = SUBSCRIPTION_RANK[(subscription.status || "").toLowerCase()] ?? 0;
    const created = subscription.created ?? 0;
    const bestCreated = best?.created ?? 0;
    if (rank > bestRank || (rank === bestRank && created > bestCreated)) {
      best = subscription;
      bestRank = rank;
    }
  }
  return best;
}

type InvoiceLike = {
  id?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  amount_refunded?: number | null;
  created?: number | null;
  status_transitions?: { paid_at?: number | null } | null;
  currency?: string | null;
  charge?: { amount_refunded?: number | null } | string | null;
  post_payment_credit_notes_amount?: number | null;
  number?: string | null;
  description?: string | null;
  lines?: { data?: Array<{ description?: string | null }> } | null;
};

/**
 * Cash collected on one Stripe invoice.
 * amount_paid is what the customer was charged after discounts.
 * Refunds come from the charge when Stripe expands it; otherwise a post-payment credit note.
 * A $0 trial invoice returns null. A fully refunded invoice returns null unless keepFullyRefunded is set.
 */
export function collectedInvoice(
  invoice: InvoiceLike,
  ratePercent: number,
  options?: { keepFullyRefunded?: boolean },
): CollectedPayment | null {
  const id = (invoice.id || "").trim();
  if (!id) return null;
  if (invoice.status && invoice.status !== "paid") return null;
  const currency = (invoice.currency || "usd").toLowerCase();
  const paidMinor = Math.max(0, Math.round(Number(invoice.amount_paid) || 0));
  const charge = invoice.charge && typeof invoice.charge === "object" ? invoice.charge : null;
  const chargeRefund = Math.max(0, Math.round(Number(charge?.amount_refunded) || 0));
  const explicitRefund = Math.max(0, Math.round(Number(invoice.amount_refunded) || 0));
  const creditNotes = Math.max(0, Math.round(Number(invoice.post_payment_credit_notes_amount) || 0));
  const refundMinor = chargeRefund > 0 ? chargeRefund : Math.max(explicitRefund, creditNotes);
  const netMinor = Math.max(0, paidMinor - refundMinor);
  // A $0 trial never collected cash. A full refund collected cash and then returned it:
  // the portal hides it, and the daily job keeps it so a pending row can be cancelled.
  if (paidMinor <= 0) return null;
  if (netMinor <= 0 && !options?.keepFullyRefunded) return null;
  const paid = majorUnits(paidMinor, currency);
  const refunded = majorUnits(Math.min(refundMinor, paidMinor), currency);
  const net = majorUnits(netMinor, currency);
  const paidAt = unixToIso(invoice.status_transitions?.paid_at) || unixToIso(invoice.created);
  if (!paidAt) return null;
  const line = invoice.lines?.data?.find((entry) => entry?.description)?.description || null;
  return {
    id,
    paidAt,
    createdUnix: Number.isFinite(Number(invoice.created)) ? Math.floor(Number(invoice.created)) : null,
    currency,
    paid,
    refunded,
    net,
    commission: commissionOnAmount(net, ratePercent),
    description: invoice.description || line,
  };
}

type FailedInvoiceLike = InvoiceLike & {
  attempt_count?: number | null;
  amount_due?: number | null;
  amount_remaining?: number | null;
};

/** An invoice Stripe tried to collect and did not pay. These earn no commission. */
export function failedInvoice(invoice: FailedInvoiceLike): FailedPayment | null {
  const id = (invoice.id || "").trim();
  if (!id) return null;
  const status = (invoice.status || "").toLowerCase();
  const attempts = Math.max(0, Math.round(Number(invoice.attempt_count) || 0));
  if (status !== "uncollectible" && !(status === "open" && attempts > 0)) return null;
  const currency = (invoice.currency || "usd").toLowerCase();
  const dueMinor = Math.max(0, Math.round(Number(invoice.amount_due ?? invoice.amount_remaining) || 0));
  if (dueMinor <= 0) return null;
  const failedAt = unixToIso(invoice.created);
  if (!failedAt) return null;
  return { id, failedAt, currency, amount: majorUnits(dueMinor, currency), status };
}

export type ActivityPoint = {
  date: string;
  label: string;
  views: number;
  clicks: number;
  signups: number;
  revenue: number;
};

function dayKey(iso: string): string | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

/** One point per UTC day in the window. Revenue is net cash collected that day. */
export function fillActivitySeries(input: {
  since: string;
  until: string;
  rows?: Array<{ date?: string; views?: number; clicks?: number; signups?: number }>;
  payments?: Array<{ paidAt: string; net: number }>;
}): ActivityPoint[] {
  const since = Date.parse(input.since);
  const until = Date.parse(input.until);
  if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until) return [];
  const byDay = new Map<string, ActivityPoint>();
  const cursor = new Date(Date.UTC(
    new Date(since).getUTCFullYear(),
    new Date(since).getUTCMonth(),
    new Date(since).getUTCDate(),
  ));
  const end = new Date(until);
  while (cursor.getTime() < end.getTime() && byDay.size < PAGE_STATS_MAX_DAYS) {
    const date = cursor.toISOString().slice(0, 10);
    const label = cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    byDay.set(date, { date, label, views: 0, clicks: 0, signups: 0, revenue: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const row of input.rows || []) {
    const date = (row.date || "").slice(0, 10);
    const point = byDay.get(date);
    if (!point) continue;
    point.views += Number(row.views) || 0;
    point.clicks += Number(row.clicks) || 0;
    point.signups += Number(row.signups) || 0;
  }
  for (const payment of input.payments || []) {
    const date = dayKey(payment.paidAt);
    const point = date ? byDay.get(date) : undefined;
    if (!point) continue;
    point.revenue = roundMoney(point.revenue + (Number(payment.net) || 0));
  }
  return [...byDay.values()];
}

export type CachedReferral = {
  id: string;
  affiliateId?: string;
  affiliateName?: string;
  affiliateSlug?: string | null;
  name?: string | null;
  email?: string;
  signupAt?: string | null;
  kind?: string;
  label?: string;
  plan?: string | null;
  trialEnd?: string | null;
  cancelsAt?: string | null;
  commissionRate?: number;
  convertPrice?: number | null;
  payments?: Array<{ paidAt?: string; net?: number; commission?: number; paid?: number; refunded?: number; currency?: string }>;
  failedPayments?: Array<{ failedAt?: string; amount?: number; status?: string }>;
  lastPaymentAt?: string | null;
  totalPaid?: number;
  totalCommission?: number;
  nextPaymentAt?: string | null;
};

export type CachedPage = Record<string, unknown> & {
  customers?: Array<{ email?: string }>;
};

/** Stripe status, payments, and page totals saved by the daily refresh. */
export type CachedAffiliatePortal = {
  version: 1;
  referrals?: CachedReferral[];
  seriesDays?: Array<{ date?: string; views?: number; clicks?: number; signups?: number }>;
  pages?: CachedPage[];
  pageSince?: string;
  pageUntil?: string;
  pendingPayout?: number | null;
  commissionRate?: number | null;
  stripeUnavailable?: boolean;
  stripeTruncated?: boolean;
  stripeLookupFailures?: number;
  activityNote?: string | null;
};

export function isCachedAffiliatePortal(value: unknown): value is CachedAffiliatePortal {
  if (!value || typeof value !== "object") return false;
  const row = value as CachedAffiliatePortal;
  return row.version === 1 && Array.isArray(row.referrals);
}

function windowsAlign(aSince: string | undefined, aUntil: string | undefined, bSince: string, bUntil: string): boolean {
  const day = 86_400_000;
  const leftSince = Date.parse(aSince || "");
  const leftUntil = Date.parse(aUntil || "");
  const rightSince = Date.parse(bSince);
  const rightUntil = Date.parse(bUntil);
  if (![leftSince, leftUntil, rightSince, rightUntil].every(Number.isFinite)) return false;
  return Math.abs(leftSince - rightSince) < 2 * day && Math.abs(leftUntil - rightUntil) < 2 * day;
}

function maskCachedPages(pages: CachedPage[], mask: boolean): CachedPage[] {
  if (!mask) return pages;
  return pages.map((page) => {
    const customers = Array.isArray(page.customers) ? page.customers : [];
    return {
      ...page,
      customers: customers.map((customer) => ({
        ...customer,
        email: maskEmail(String(customer?.email || "")),
      })),
    };
  });
}

/**
 * Turn daily cache rows into the portal response for one date window.
 * Missing arrays become empty lists so a partial cache cannot throw.
 */
export function projectCachedPortals(input: {
  caches: Array<CachedAffiliatePortal | null | undefined>;
  since: string;
  until: string;
  maskEmails: boolean;
}): {
  referrals: CachedReferral[];
  series: ActivityPoint[];
  pages: CachedPage[];
  totals: ReferralTotals;
  activity: {
    views: number;
    clicks: number;
    signups: number;
    trials: number;
    active: number;
    revenue: number;
    commission: number;
    pendingPayout: number | null;
    expectedTrialCommission: number;
    expectedTrialCount: number;
  };
  activityNote: string | null;
  stripeUnavailable: boolean;
  stripeTruncated: boolean;
  stripeLookupFailures: number;
  commissionRate: number | null;
} {
  const caches = input.caches.filter((cache): cache is CachedAffiliatePortal => isCachedAffiliatePortal(cache));
  const referrals = caches.flatMap((cache) => (Array.isArray(cache.referrals) ? cache.referrals : [])).map((referral) => {
    const payments = Array.isArray(referral.payments) ? referral.payments : [];
    return {
      ...referral,
      email: input.maskEmails ? maskEmail(String(referral.email || "")) : String(referral.email || ""),
      kind: referral.kind || "unknown",
      label: referral.label || "No subscription",
      payments: payments.map((payment) => ({
        ...payment,
        paidAt: payment.paidAt || "",
        net: Number.isFinite(Number(payment.net)) ? Number(payment.net) : 0,
        commission: Number.isFinite(Number(payment.commission)) ? Number(payment.commission) : 0,
        paid: Number.isFinite(Number(payment.paid)) ? Number(payment.paid) : Number(payment.net) || 0,
        refunded: Number.isFinite(Number(payment.refunded)) ? Number(payment.refunded) : 0,
      })),
      failedPayments: Array.isArray(referral.failedPayments) ? referral.failedPayments : [],
      totalPaid: Number.isFinite(Number(referral.totalPaid)) ? Number(referral.totalPaid) : 0,
      totalCommission: Number.isFinite(Number(referral.totalCommission)) ? Number(referral.totalCommission) : 0,
      commissionRate: rateForReferral(referral.commissionRate),
    };
  });
  const series = fillActivitySeries({
    since: input.since,
    until: input.until,
    rows: caches.flatMap((cache) => (Array.isArray(cache.seriesDays) ? cache.seriesDays : [])),
    payments: referrals.flatMap((referral) => referral.payments.map((payment) => ({
      paidAt: payment.paidAt || "",
      net: payment.net || 0,
    }))),
  });
  const sinceMs = Date.parse(input.since);
  const untilMs = Date.parse(input.until);
  let revenue = 0;
  let commission = 0;
  for (const referral of referrals) {
    for (const payment of referral.payments) {
      const paidAt = Date.parse(payment.paidAt || "");
      if (Number.isFinite(paidAt) && paidAt >= sinceMs && paidAt < untilMs) {
        revenue += payment.net || 0;
        commission += payment.commission || 0;
      }
    }
  }
  const totals = referralTotals(referrals.map((referral) => ({
    kind: (referral.kind === "trial" || referral.kind === "active" || referral.kind === "past_due" || referral.kind === "canceled")
      ? referral.kind
      : "unknown",
    payments: referral.payments.map((payment) => ({ net: payment.net || 0, commission: payment.commission || 0 })),
    nextPaymentAt: referral.nextPaymentAt || null,
  })));
  const expected = expectedTrialCommission(referrals.map((referral) => ({
    kind: referral.kind,
    commissionRate: referral.commissionRate,
    convertPrice: referral.convertPrice,
    plan: referral.plan,
  })));
  const pendingValues = caches.map((cache) => cache.pendingPayout);
  const pendingPayout = caches.length === 0 || pendingValues.some((value) => value == null || !Number.isFinite(Number(value)))
    ? null
    : roundMoney(pendingValues.reduce((sum, value) => sum + Number(value), 0));
  const pages = maskCachedPages(caches.flatMap((cache) => (Array.isArray(cache.pages) ? cache.pages : [])), input.maskEmails);
  const aligned = caches.length > 0 && caches.every((cache) => windowsAlign(cache.pageSince, cache.pageUntil, input.since, input.until));
  const notes = caches.map((cache) => cache.activityNote).filter((note): note is string => !!note);
  if (!aligned && caches.length) {
    const sample = caches[0];
    const start = (sample.pageSince || "").slice(0, 10);
    const end = (sample.pageUntil || "").slice(0, 10);
    notes.push(`Kit totals are from the daily refresh${start && end ? ` (${start} – ${end})` : ""}. The chart and revenue follow the dates you picked.`);
  }
  const rates = caches.map((cache) => cache.commissionRate).filter((rate): rate is number => typeof rate === "number" && Number.isFinite(rate));
  return {
    referrals,
    series,
    pages,
    totals,
    activity: {
      views: series.reduce((sum, point) => sum + point.views, 0),
      clicks: series.reduce((sum, point) => sum + point.clicks, 0),
      signups: series.reduce((sum, point) => sum + point.signups, 0),
      trials: totals.activeTrials,
      active: totals.payingCustomers,
      revenue: roundMoney(revenue),
      commission: roundMoney(commission),
      pendingPayout,
      expectedTrialCommission: expected.amount,
      expectedTrialCount: expected.trials,
    },
    activityNote: notes.length ? [...new Set(notes)].join(" ") : null,
    stripeUnavailable: caches.some((cache) => cache.stripeUnavailable === true),
    stripeTruncated: caches.some((cache) => cache.stripeTruncated === true),
    stripeLookupFailures: caches.reduce((sum, cache) => sum + (Number(cache.stripeLookupFailures) || 0), 0),
    commissionRate: rates.length === 1 ? rates[0] : null,
  };
}

/** Stable integer that will not collide with the old 0..N monthly period indexes. */
export function invoicePeriodIndex(createdUnix: number | null | undefined): number {
  const n = Math.floor(Number(createdUnix));
  if (!Number.isFinite(n) || n < 1_000_000) return 1_600_000_000;
  return Math.min(n, 2_000_000_000);
}

export function referralTotals(
  rows: Array<{ kind: ReferralKind; payments: Array<{ net: number; commission: number }>; nextPaymentAt: string | null }>,
  now = new Date(),
): ReferralTotals {
  let activeTrials = 0;
  let payingCustomers = 0;
  let totalPaid = 0;
  let totalCommission = 0;
  let nextExpectedPaymentAt: string | null = null;
  for (const row of rows) {
    if (row.kind === "trial") activeTrials += 1;
    if (row.kind === "active") payingCustomers += 1;
    for (const payment of row.payments) {
      totalPaid += payment.net;
      totalCommission += payment.commission;
    }
    if (row.nextPaymentAt && Date.parse(row.nextPaymentAt) > now.getTime()) {
      if (!nextExpectedPaymentAt || row.nextPaymentAt < nextExpectedPaymentAt) nextExpectedPaymentAt = row.nextPaymentAt;
    }
  }
  return {
    activeTrials,
    payingCustomers,
    totalPaid: roundMoney(totalPaid),
    totalCommission: roundMoney(totalCommission),
    nextExpectedPaymentAt,
  };
}

export function authorizeAffiliateReferralRead(input: {
  isPlatformAdmin: boolean;
  scope: "self" | "admin";
  requestedAffiliateId: string | null;
  ownedAffiliateIds: string[];
}): { ok: true; affiliateIds: string[] | "all"; maskEmails: boolean } | { ok: false; status: number; error: string } {
  const requested = input.requestedAffiliateId?.trim() || null;
  if (input.scope === "admin") {
    if (!input.isPlatformAdmin) return { ok: false, status: 403, error: "Admin only" };
    if (requested && requested !== "all") return { ok: true, affiliateIds: [requested], maskEmails: false };
    return { ok: true, affiliateIds: "all", maskEmails: false };
  }
  if (requested) {
    if (input.isPlatformAdmin || input.ownedAffiliateIds.includes(requested)) {
      return { ok: true, affiliateIds: [requested], maskEmails: true };
    }
    return { ok: false, status: 403, error: "You can only view your own referrals" };
  }
  if (input.ownedAffiliateIds.length === 0) {
    return { ok: false, status: 403, error: "No affiliate account is linked to this login" };
  }
  return { ok: true, affiliateIds: input.ownedAffiliateIds, maskEmails: true };
}

export function isKitPageAttribution(pagePath: string, funnelKey: string | null | undefined): boolean {
  const path = pagePath.trim().toLowerCase();
  const funnel = (funnelKey || "").trim().toLowerCase();
  return funnel === "one-feature-kit" || path === "/one-feature-kit" || path.startsWith("/one-feature-kit/");
}

export function attributionPageUrl(pagePath: string, origin = "https://saassuite.ai"): string {
  const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function resolveActivityWindow(
  input: { days?: unknown; since?: unknown; until?: unknown },
  now = Date.now(),
): { days: number; since: string; until: string } {
  const since = typeof input.since === "string" ? Date.parse(input.since) : Number.NaN;
  const until = typeof input.until === "string" ? Date.parse(input.until) : Number.NaN;
  if (Number.isFinite(since) && Number.isFinite(until) && until > since) {
    const spanDays = Math.ceil((until - since) / 86_400_000);
    const days = Math.min(PAGE_STATS_MAX_DAYS, Math.max(1, spanDays));
    const cappedSince = until - days * 86_400_000;
    return {
      days,
      since: new Date(Math.max(since, cappedSince)).toISOString(),
      until: new Date(until).toISOString(),
    };
  }
  return pageStatsWindow(input.days, now);
}

export function pageStatsWindow(days: unknown, now = Date.now()): { days: number; since: string; until: string } {
  const requested = Math.round(Number(days));
  const clamped = Math.min(PAGE_STATS_MAX_DAYS, Math.max(1, Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_PAGE_STATS_DAYS));
  return {
    days: clamped,
    since: new Date(now - clamped * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export function clampStatsWindow(input: {
  since: string;
  until: string;
  startsAt: string | null;
  endsAt: string | null;
}): { since: string; until: string } | null {
  const since = Math.max(Date.parse(input.since), input.startsAt ? Date.parse(input.startsAt) : 0);
  const untilCap = input.endsAt ? Date.parse(input.endsAt) : Number.POSITIVE_INFINITY;
  const until = Math.min(Date.parse(input.until), untilCap);
  if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until) return null;
  return { since: new Date(since).toISOString(), until: new Date(until).toISOString() };
}

export function conversionRate(part: number, whole: number): number | null {
  if (!whole || whole < 0 || part < 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function visitorBase(uniqueVisitors: number, funnelSessions: number | null): number {
  if (uniqueVisitors > 0) return uniqueVisitors;
  return funnelSessions && funnelSessions > 0 ? funnelSessions : 0;
}

export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  }));
  return out;
}
