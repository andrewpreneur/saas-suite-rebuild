import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { isPlatformAdminEmail } from "../_shared/admin-auth.ts";
import { billingForAccounts, type EmailBilling } from "../_shared/affiliateInvoices.ts";
import {
  attributionPageUrl,
  authorizeAffiliateReferralRead,
  billingLookupKeys,
  clampStatsWindow,
  classifyReferral,
  commissionOnAmount,
  conversionRate,
  isCachedAffiliatePortal,
  isKitPageAttribution,
  isMissingSchema,
  maskEmail,
  normalizeCommissionPercent,
  PAGE_STATS_MAX_DAYS,
  pageStatsWindow,
  projectCachedPortals,
  rateForNewReferral,
  rateForReferral,
  resolveActivityWindow,
  roundMoney,
  seriesFailureNote,
  visitorBase,
  type CachedAffiliatePortal,
  type CollectedPayment,
} from "../_shared/affiliateReferrals.ts";
import { secretEquals } from "../_shared/meta-capi-policy.ts";
import { json, requireAuthedUser, serviceClient } from "../_shared/user-auth.ts";

const USER_COLS =
  "email, full_name, created_at, plan, approval, billing_state, source, trial_source, trial_start_date, trial_length, cancel_access_until, affiliate_id";
const AFFILIATE_BASE =
  "id, full_name, email, affiliate_slug, status, user_email_linked";
const STRIPE_EMAIL_CAP = 150;
/** Stop the daily batch before the cron HTTP call (120s) gives up. */
const CACHE_REFRESH_BUDGET_MS = 90_000;

type AffiliateRow = {
  id: string;
  full_name: string;
  email: string;
  affiliate_slug: string | null;
  status: string | null;
  user_email_linked: string | null;
  commission_rate?: number | null;
};

type ReferralRow = {
  id: string;
  affiliate_id: string;
  referred_email: string;
  referred_name: string | null;
  plan: string | null;
  status: string;
  commission_rate: number;
  created_at: string;
};

type UserRow = {
  email: string | null;
  full_name: string | null;
  created_at: string;
  plan: string | null;
  approval: string | null;
  billing_state: string | null;
  source: string | null;
  trial_source: string | null;
  trial_start_date: string | null;
  trial_length: number | null;
  cancel_access_until: string | null;
  affiliate_id: string | null;
};

type AttributionRow = {
  id: string;
  affiliate_id: string;
  page_path: string;
  funnel_key: string | null;
  label: string | null;
  starts_at: string;
  ends_at: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function paymentView(payment: CollectedPayment) {
  return {
    paidAt: payment.paidAt,
    currency: payment.currency,
    paid: payment.paid,
    refunded: payment.refunded,
    net: payment.net,
    commission: payment.commission,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
  const body = await req.json().catch(() => ({}));
  const supabase = serviceClient();
  if (body?.action === "refresh-batch") {
    if (!(await cacheCronAuthorized(req, supabase))) return json({ error: "unauthorized" }, 401);
    return json(await refreshStalePortals(supabase));
  }

  const auth = await requireAuthedUser(req);
  if (!auth.ok) return auth.res;
  const isAdmin = isPlatformAdminEmail(auth.email);
  const action = body?.action === "set-rate" ? "set-rate" : body?.action === "refresh" ? "refresh" : "snapshot";

  if (action === "set-rate") {
    if (!isAdmin) return json({ error: "Admin only" }, 403);
    const requested = normalizeCommissionPercent(body?.commissionRate);
    if (requested == null) return json({ error: "Rate must be between 0 and 100" }, 400);
    const affiliateId = String(body?.affiliateId || "");
    if (!isUuid(affiliateId)) return json({ error: "Affiliate id is required" }, 400);
    const { error } = await supabase.from("affiliates").update({ commission_rate: requested }).eq("id", affiliateId);
    if (error && isMissingSchema(error, "commission_rate")) {
      return json({ error: "Apply the affiliate commission migration, then set the rate.", code: "migration_required" }, 409);
    }
    if (error) return json({ error: "Could not save the commission rate" }, 500);
    return json({ ok: true, commissionRate: requested });
  }

  const scope = body?.scope === "admin" ? "admin" : "self";
  const requestedId = typeof body?.affiliateId === "string" ? body.affiliateId.trim() : null;
  const window = resolveActivityWindow({ days: body?.days, since: body?.since, until: body?.until });

  const affiliatesResult = await loadAffiliates(supabase);
  if (affiliatesResult.error) return json({ error: "Could not load affiliates" }, 500);
  const owned = affiliatesResult.rows.filter((row) => ownsAffiliate(row, auth.email)).map((row) => row.id);
  const access = authorizeAffiliateReferralRead({
    isPlatformAdmin: isAdmin,
    scope,
    requestedAffiliateId: requestedId,
    ownedAffiliateIds: owned,
  });
  if (!access.ok) return json({ error: access.error }, access.status);

  const selected = selectAffiliates(affiliatesResult.rows, access.affiliateIds);
  const forceRefresh = action === "refresh";
  if (forceRefresh) {
    if (!isAdmin) return json({ error: "Admin only" }, 403);
    if (selected.length !== 1) return json({ error: "Choose one affiliate to refresh" }, 400);
  }

  const portalArgs = {
    affiliatesResult,
    selected,
    scope,
    maskEmails: access.maskEmails,
    window,
  };
  if (selected.length === 0) {
    return respondWithPortal({ ...portalArgs, caches: [], fromCache: false, refreshedAt: null });
  }

  const cacheRead = await loadPortalCache(supabase, selected.map((row) => row.id));
  if (!forceRefresh && !cacheRead.missing) {
    const byId = new Map(cacheRead.rows.map((row) => [row.affiliate_id, row]));
    const ready = selected.filter((row) => isCachedAffiliatePortal(byId.get(row.id)?.payload));
    const missing = selected.filter((row) => !isCachedAffiliatePortal(byId.get(row.id)?.payload));
    if (missing.length === 0) {
      return respondWithPortal({
        ...portalArgs,
        caches: ready.map((row) => byId.get(row.id)?.payload as CachedAffiliatePortal),
        fromCache: true,
        refreshedAt: oldestRefresh(ready.map((row) => byId.get(row.id)?.refreshed_at)),
      });
    }
    // One missing affiliate is filled once, then saved. A multi-affiliate view
    // returns whatever is already saved so it does not fan out to Stripe.
    if (selected.length > 1) {
      const waiting = missing.length === 1 ? "1 affiliate is" : `${missing.length} affiliates are`;
      return respondWithPortal({
        ...portalArgs,
        caches: ready.map((row) => byId.get(row.id)?.payload as CachedAffiliatePortal),
        fromCache: ready.length > 0,
        refreshedAt: oldestRefresh(ready.map((row) => byId.get(row.id)?.refreshed_at)),
        extraNote: `${waiting} still waiting on the daily refresh and ${missing.length === 1 ? "is" : "are"} not in these totals yet.`,
      });
    }
  }

  const seriesWindow = forceRefresh ? pageStatsWindow(PAGE_STATS_MAX_DAYS) : window;
  const previousSeries = selected.length === 1
    ? cachedSeriesDays(cacheRead.rows.find((row) => row.affiliate_id === selected[0].id)?.payload)
    : [];
  const cache = await computePortalSnapshot({ supabase, selected, pageWindow: window, seriesWindow, previousSeries });
  let refreshedAt: string | null = null;
  if (!cacheRead.missing && selected.length === 1) {
    refreshedAt = new Date().toISOString();
    await upsertPortalCache(supabase, selected[0].id, cache, refreshedAt);
  }
  return respondWithPortal({ ...portalArgs, caches: [cache], fromCache: false, refreshedAt });
  } catch (error) {
    console.error("affiliate-referrals failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Could not load affiliate referrals" }, 500);
  }
});

type CacheHit = { affiliate_id: string; payload: unknown; refreshed_at: string | null };
type ActivityWindow = { days: number; since: string; until: string };

function respondWithPortal(input: {
  affiliatesResult: { rows: AffiliateRow[]; rateColumn: boolean };
  selected: AffiliateRow[];
  scope: "self" | "admin";
  maskEmails: boolean;
  window: ActivityWindow;
  caches: Array<CachedAffiliatePortal | null | undefined>;
  fromCache: boolean;
  refreshedAt: string | null;
  extraNote?: string | null;
}) {
  const projected = projectCachedPortals({
    caches: input.caches,
    since: input.window.since,
    until: input.window.until,
    maskEmails: input.maskEmails,
  });
  const notes = [projected.activityNote, input.extraNote].filter((note): note is string => !!note);
  const primary = input.selected.length === 1 ? input.selected[0] : null;
  const affiliateCard = (row: AffiliateRow) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    slug: row.affiliate_slug,
    status: row.status,
    commissionRate: input.affiliatesResult.rateColumn ? rateForNewReferral(row.commission_rate) : null,
  });
  return json({
    maskEmails: input.maskEmails,
    rateColumnReady: input.affiliatesResult.rateColumn,
    stripeUnavailable: projected.stripeUnavailable,
    stripeTruncated: projected.stripeTruncated,
    stripeLookupFailures: projected.stripeLookupFailures,
    days: input.window.days,
    commissionRate: projected.commissionRate ?? (primary ? rateForNewReferral(primary.commission_rate) : null),
    affiliates: input.selected.map(affiliateCard),
    affiliateChoices: (input.scope === "admin" ? input.affiliatesResult.rows : input.selected).map(affiliateCard),
    referrals: projected.referrals,
    totals: projected.totals,
    pages: projected.pages,
    series: projected.series,
    since: input.window.since,
    until: input.window.until,
    activityNote: notes.length ? notes.join(" ") : null,
    activity: projected.activity,
    fromCache: input.fromCache,
    refreshedAt: input.refreshedAt,
  });
}

function oldestRefresh(values: Array<string | null | undefined>): string | null {
  const times = values.map((value) => Date.parse(value || "")).filter((time) => Number.isFinite(time));
  if (!times.length) return null;
  return new Date(Math.min(...times)).toISOString();
}

async function loadPortalCache(supabase: ReturnType<typeof serviceClient>, ids: string[]): Promise<{ missing: boolean; rows: CacheHit[] }> {
  if (!ids.length) return { missing: false, rows: [] };
  const { data, error } = await supabase.from("affiliate_portal_cache").select("affiliate_id, payload, refreshed_at").in("affiliate_id", ids);
  if (error && isMissingSchema(error, "affiliate_portal_cache")) return { missing: true, rows: [] };
  if (error) {
    console.error("affiliate portal cache read failed", error.message);
    return { missing: false, rows: [] };
  }
  return { missing: false, rows: (data || []) as CacheHit[] };
}

async function upsertPortalCache(
  supabase: ReturnType<typeof serviceClient>,
  affiliateId: string,
  payload: CachedAffiliatePortal,
  refreshedAt: string,
) {
  const { error } = await supabase.from("affiliate_portal_cache").upsert({
    affiliate_id: affiliateId,
    payload,
    refreshed_at: refreshedAt,
  }, { onConflict: "affiliate_id" });
  if (error) console.error("affiliate portal cache upsert failed", error.message);
}

async function cacheCronAuthorized(req: Request, supabase: ReturnType<typeof serviceClient>): Promise<boolean> {
  const presented = (req.headers.get("x-webhook-secret") ?? "").trim();
  if (!presented) return false;
  const { data, error } = await supabase.from("affiliate_portal_cache_cron_auth").select("secret").eq("id", 1).maybeSingle();
  if (error || typeof data?.secret !== "string" || !data.secret) return false;
  return secretEquals(presented, data.secret);
}

async function refreshStalePortals(supabase: ReturnType<typeof serviceClient>) {
  const started = Date.now();
  const affiliatesResult = await loadAffiliates(supabase);
  if (affiliatesResult.error) return { ok: false, error: "Could not load affiliates" };
  const { data, error } = await supabase.from("affiliate_portal_cache").select("affiliate_id, refreshed_at");
  if (error && isMissingSchema(error, "affiliate_portal_cache")) {
    return { ok: false, error: "Apply the affiliate portal cache migration first.", code: "migration_required" };
  }
  if (error) return { ok: false, error: "Could not read the affiliate portal cache" };
  const stamp = new Map((data || []).map((row) => [String(row.affiliate_id), String(row.refreshed_at || "")]));
  const ordered = [...affiliatesResult.rows].sort((a, b) => {
    const left = stamp.get(a.id) || "";
    const right = stamp.get(b.id) || "";
    if (!left && right) return -1;
    if (left && !right) return 1;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const pageWindow = pageStatsWindow(45);
  const seriesWindow = pageStatsWindow(PAGE_STATS_MAX_DAYS);
  let refreshed = 0;
  let failed = 0;
  for (const affiliate of ordered) {
    if (Date.now() - started > CACHE_REFRESH_BUDGET_MS) break;
    try {
      const prior = await supabase.from("affiliate_portal_cache").select("payload").eq("affiliate_id", affiliate.id).maybeSingle();
      const previousSeries = prior.error ? [] : cachedSeriesDays(prior.data?.payload);
      const cache = await computePortalSnapshot({ supabase, selected: [affiliate], pageWindow, seriesWindow, previousSeries });
      const refreshedAt = new Date().toISOString();
      await upsertPortalCache(supabase, affiliate.id, cache, refreshedAt);
      refreshed += 1;
    } catch (err) {
      failed += 1;
      console.error("affiliate portal cache refresh failed", affiliate.id, err instanceof Error ? err.message : "unknown");
    }
  }
  return { ok: true, refreshed, failed, considered: ordered.length, elapsedMs: Date.now() - started };
}

type SeriesDay = { date?: string; views?: number; clicks?: number; signups?: number };

function cachedSeriesDays(payload: unknown): SeriesDay[] {
  if (!isCachedAffiliatePortal(payload) || !Array.isArray(payload.seriesDays)) return [];
  return payload.seriesDays;
}

/** One chart query, then one retry. A failure keeps the previous days instead of saving an empty chart. */
async function loadPortalSeries(input: {
  supabase: ReturnType<typeof serviceClient>;
  affiliate: AffiliateRow;
  since: string;
  until: string;
  paths: string[];
  previous: SeriesDay[];
}): Promise<{ rows: SeriesDay[]; note: string | null }> {
  let lastError: { message?: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      const seriesQuery = await input.supabase.rpc("affiliate_portal_series", {
        p_affiliate_id: input.affiliate.id,
        p_slug: input.affiliate.affiliate_slug || "",
        p_since: input.since,
        p_until: input.until,
        p_page_paths: input.paths,
      });
      if (!seriesQuery.error) {
        return { rows: Array.isArray(seriesQuery.data) ? seriesQuery.data as SeriesDay[] : [], note: null };
      }
      lastError = seriesQuery.error;
      if (isMissingSchema(seriesQuery.error, "affiliate_portal_series")) break;
    } catch (err) {
      lastError = { message: err instanceof Error ? err.message : "chart query failed" };
    }
  }
  const kept = input.previous.filter((row) => !!row && typeof row === "object");
  console.error("affiliate portal series failed", input.affiliate.id, lastError?.code || "", lastError?.message || "");
  return { rows: kept, note: seriesFailureNote(lastError, kept.length > 0) };
}

/**
 * Live Stripe read for one or more affiliates.
 * Each referral looks up a customer, paid/open/uncollectible invoices, and a
 * subscription, four at a time. A kit page then repeats that for up to 80
 * buyers, and the page totals run a site_analytics SQL function. Together that
 * is the ~20 second page view. Callers skip this when the daily cache is warm.
 * Emails stay unmasked here; the response masks them.
 */
async function computePortalSnapshot(input: {
  supabase: ReturnType<typeof serviceClient>;
  selected: AffiliateRow[];
  pageWindow: ActivityWindow;
  seriesWindow: ActivityWindow;
  previousSeries?: SeriesDay[];
}): Promise<CachedAffiliatePortal> {
  const { supabase, selected, pageWindow, seriesWindow, previousSeries = [] } = input;
  const affiliateIds = selected.map((row) => row.id);
  const referrals = affiliateIds.length ? await loadReferrals(supabase, affiliateIds) : [];
  const users = await loadUsers(supabase, selected, referrals.map((row) => row.referred_email));
  const usersByEmail = new Map<string, UserRow>();
  for (const user of users) {
    if (user.email) usersByEmail.set(user.email.trim().toLowerCase(), user);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;
  const overrides = await loadOverrides(supabase);
  const referralEmails = [...new Set(referrals.map((row) => row.referred_email.trim().toLowerCase()))];
  const stripeEmails = referralEmails.slice(0, STRIPE_EMAIL_CAP);
  let stripeFailed = 0;
  let billing = new Map<string, EmailBilling>();
  if (stripe && stripeEmails.length) {
    const rateFor = (email: string) => {
      const referral = referrals.find((row) => row.referred_email.trim().toLowerCase() === email);
      return rateForReferral(referral?.commission_rate);
    };
    const accounts = stripeEmails.map((email) => ({ key: email, ...billingLookupKeys(email, overrides.get(email)) }));
    const loaded = await billingForAccounts(stripe, accounts, rateFor, { includeFailed: true, subscriptions: true });
    billing = loaded.billing;
    stripeFailed = loaded.failed;
  }

  const affiliateById = new Map(selected.map((row) => [row.id, row]));
  const views = referrals.map((referral) => {
    const email = referral.referred_email.trim().toLowerCase();
    const user = usersByEmail.get(email);
    const found = billing.get(email);
    const payments = (found?.payments || []).filter((payment) => payment.net > 0);
    const classified = classifyReferral(found?.subscription || null);
    const affiliate = affiliateById.get(referral.affiliate_id);
    const canceling = classified.kind === "active" && found?.subscription?.cancelAtPeriodEnd
      ? found.subscription.cancelAt || found.subscription.periodEnd || null
      : null;
    return {
      id: referral.id,
      affiliateId: referral.affiliate_id,
      affiliateName: affiliate?.full_name || "",
      affiliateSlug: affiliate?.affiliate_slug || null,
      name: user?.full_name || referral.referred_name || null,
      email,
      signupAt: user?.created_at || null,
      kind: classified.kind,
      label: classified.label,
      plan: classified.plan,
      trialEnd: classified.trialEnd,
      cancelsAt: canceling,
      commissionRate: rateForReferral(referral.commission_rate),
      convertPrice: found?.subscription?.convertPrice ?? null,
      payments: payments.map(paymentView),
      failedPayments: (found?.failedPayments || []).map((payment) => ({
        failedAt: payment.failedAt,
        amount: payment.amount,
        status: payment.status,
      })),
      lastPaymentAt: payments[0]?.paidAt || null,
      totalPaid: roundMoney(payments.reduce((sum, payment) => sum + payment.net, 0)),
      totalCommission: roundMoney(payments.reduce((sum, payment) => sum + payment.commission, 0)),
      nextPaymentAt: classified.nextPaymentAt,
    };
  }).sort((a, b) => ((a.signupAt || "") < (b.signupAt || "") ? 1 : -1));

  const attributions = await loadAttributions(supabase, affiliateIds);
  const pages = [];
  for (const attribution of attributions.rows) {
    const affiliate = affiliateById.get(attribution.affiliate_id);
    const rate = rateForNewReferral(affiliate?.commission_rate);
    const bounded = clampStatsWindow({
      since: pageWindow.since,
      until: pageWindow.until,
      startsAt: attribution.starts_at,
      endsAt: attribution.ends_at,
    });
    const header = {
      id: attribution.id,
      affiliateId: attribution.affiliate_id,
      affiliateName: affiliate?.full_name || "",
      affiliateSlug: affiliate?.affiliate_slug || null,
      pagePath: attribution.page_path,
      funnelKey: attribution.funnel_key,
      label: attribution.label,
      startsAt: attribution.starts_at,
      endsAt: attribution.ends_at,
      url: attributionPageUrl(attribution.page_path),
      commissionRate: rate,
    };
    if (!attributions.ready || !bounded) {
      pages.push({ ...header, available: false, note: attributions.ready ? "This attribution is outside the selected dates." : "Apply the page attribution migration to load these stats.", days: pageWindow.days });
      continue;
    }
    const { data, error } = await supabase.rpc("affiliate_page_funnel_stats", {
      p_page_path: attribution.page_path,
      p_funnel_key: attribution.funnel_key,
      p_since: bounded.since,
      p_until: bounded.until,
    });
    if (error) {
      pages.push({ ...header, available: false, note: "Page stats are not available until the stats function is applied.", days: pageWindow.days });
      continue;
    }
    const raw = (data || {}) as Record<string, unknown>;
    if (raw.error) {
      pages.push({ ...header, available: false, note: "That date range could not be totaled.", days: pageWindow.days });
      continue;
    }
    const pageCustomerRows = await pageCustomers({
      supabase,
      rawCustomers: Array.isArray(raw.customers) ? raw.customers as Array<Record<string, unknown>> : [],
      kit: isKitPageAttribution(attribution.page_path, attribution.funnel_key),
      since: bounded.since,
      until: bounded.until,
      rate,
      mask: false,
      usersByEmail,
      stripe,
      overrides,
    });
    const visits = Number(raw.visits) || 0;
    const uniqueVisitors = Number(raw.unique_visitors) || 0;
    const funnelSessions = raw.funnel_sessions == null ? null : Number(raw.funnel_sessions) || 0;
    const clicks = Number(raw.clicks) || 0;
    const leads = Number(raw.leads) || 0;
    const checkoutStarts = Number(raw.checkout_starts) || 0;
    const purchases = Number(raw.purchases) || 0;
    const revenue = roundMoney((Number(raw.revenue_cents) || 0) / 100);
    const base = visitorBase(uniqueVisitors, funnelSessions);
    pages.push({
      ...header,
      available: true,
      note: null,
      days: pageWindow.days,
      since: bounded.since,
      until: bounded.until,
      visits,
      uniqueVisitors,
      funnelSessions,
      clicks,
      leads,
      checkoutStarts,
      purchases,
      revenue,
      commission: commissionOnAmount(revenue, rate),
      leadRate: conversionRate(leads, base),
      clickRate: conversionRate(clicks, base),
      checkoutRate: conversionRate(checkoutStarts, base),
      purchaseRate: conversionRate(purchases, checkoutStarts),
      downstreamTrials: pageCustomerRows.filter((customer) => customer.kind === "trial").length,
      downstreamPaying: pageCustomerRows.filter((customer) => customer.kind === "active").length,
      customers: pageCustomerRows,
    });
  }

  let activityNote: string | null = null;
  let seriesRows: SeriesDay[] = [];
  if (selected.length === 1) {
    const affiliate = selected[0];
    const paths = attributions.rows.filter((row) => row.affiliate_id === affiliate.id).map((row) => row.page_path);
    const series = await loadPortalSeries({
      supabase,
      affiliate,
      since: seriesWindow.since,
      until: seriesWindow.until,
      paths,
      previous: previousSeries,
    });
    seriesRows = series.rows;
    activityNote = series.note;
  }

  const pending = affiliateIds.length
    ? await supabase.from("affiliate_commissions").select("amount").in("affiliate_id", affiliateIds).eq("status", "pending").not("stripe_invoice_id", "is", null)
    : { data: [], error: null };
  const pendingPayout = pending.error
    ? null
    : roundMoney((pending.data || []).reduce((sum, row) => sum + Number(row.amount), 0));

  return {
    version: 1,
    referrals: views,
    seriesDays: seriesRows,
    pages,
    pageSince: pageWindow.since,
    pageUntil: pageWindow.until,
    pendingPayout,
    commissionRate: selected.length === 1 ? rateForNewReferral(selected[0].commission_rate) : null,
    stripeUnavailable: !stripe,
    stripeTruncated: referralEmails.length > stripeEmails.length,
    stripeLookupFailures: stripeFailed,
    activityNote,
  };
}

function ownsAffiliate(row: AffiliateRow, email: string): boolean {
  return row.email.trim().toLowerCase() === email || (row.user_email_linked || "").trim().toLowerCase() === email;
}

function selectAffiliates(rows: AffiliateRow[], ids: string[] | "all"): AffiliateRow[] {
  if (ids === "all") return rows;
  const wanted = new Set(ids.map((id) => id.toLowerCase()));
  return rows.filter((row) => wanted.has(row.id.toLowerCase()) || (row.affiliate_slug && wanted.has(row.affiliate_slug.toLowerCase())));
}

async function loadAffiliates(supabase: ReturnType<typeof serviceClient>): Promise<{ rows: AffiliateRow[]; rateColumn: boolean; error: { message?: string } | null }> {
  const withRate = await supabase.from("affiliates").select(`${AFFILIATE_BASE}, commission_rate`).order("full_name");
  if (withRate.error && isMissingSchema(withRate.error, "commission_rate")) {
    const plain = await supabase.from("affiliates").select(AFFILIATE_BASE).order("full_name");
    return { rows: (plain.data || []) as AffiliateRow[], rateColumn: false, error: plain.error };
  }
  return { rows: (withRate.data || []) as AffiliateRow[], rateColumn: true, error: withRate.error };
}

async function loadOverrides(supabase: ReturnType<typeof serviceClient>) {
  const overrides = new Map<string, { stripeEmail: string | null; stripeCustomerId: string | null }>();
  const { data, error } = await supabase
    .from("affiliate_billing_overrides")
    .select("referred_email, stripe_email, stripe_customer_id");
  if (error) return overrides;
  for (const row of data || []) {
    const email = String(row.referred_email || "").trim().toLowerCase();
    if (!email) continue;
    overrides.set(email, { stripeEmail: row.stripe_email, stripeCustomerId: row.stripe_customer_id });
  }
  return overrides;
}

async function loadReferrals(supabase: ReturnType<typeof serviceClient>, affiliateIds: string[]): Promise<ReferralRow[]> {
  const { data, error } = await supabase
    .from("affiliate_referrals")
    .select("id, affiliate_id, referred_email, referred_name, plan, status, commission_rate, created_at")
    .in("affiliate_id", affiliateIds)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return [];
  return (data || []) as ReferralRow[];
}

async function loadUsers(supabase: ReturnType<typeof serviceClient>, affiliates: AffiliateRow[], emails: string[]): Promise<UserRow[]> {
  const keys = [...new Set(affiliates.flatMap((row) => [row.id, row.affiliate_slug].filter((value): value is string => !!value)))];
  const lowered = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const rows: UserRow[] = [];
  if (keys.length) {
    const { data } = await supabase.from("saas_suite_users").select(USER_COLS).in("affiliate_id", keys).limit(1000);
    rows.push(...((data || []) as UserRow[]));
  }
  for (let i = 0; i < lowered.length; i += 100) {
    const slice = lowered.slice(i, i + 100);
    const { data } = await supabase.from("saas_suite_users").select(USER_COLS).in("email", slice);
    rows.push(...((data || []) as UserRow[]));
  }
  return rows;
}

async function loadAttributions(supabase: ReturnType<typeof serviceClient>, affiliateIds: string[]): Promise<{ rows: AttributionRow[]; ready: boolean }> {
  if (!affiliateIds.length) return { rows: [], ready: true };
  const { data, error } = await supabase
    .from("affiliate_page_attributions")
    .select("id, affiliate_id, page_path, funnel_key, label, starts_at, ends_at")
    .in("affiliate_id", affiliateIds);
  if (error && isMissingSchema(error, "affiliate_page_attributions")) return { rows: [], ready: false };
  if (error) return { rows: [], ready: false };
  return { rows: (data || []) as AttributionRow[], ready: true };
}

async function pageCustomers(input: {
  supabase: ReturnType<typeof serviceClient>;
  rawCustomers: Array<Record<string, unknown>>;
  kit: boolean;
  since: string;
  until: string;
  rate: number;
  mask: boolean;
  usersByEmail: Map<string, UserRow>;
  stripe: Stripe | null;
  overrides: Map<string, { stripeEmail: string | null; stripeCustomerId: string | null }>;
}) {
  const grouped = new Map<string, { email: string; payments: Array<{ paidAt: string; amount: number; lineId: string | null; commission: number }> }>();
  for (const row of input.rawCustomers) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) continue;
    const comped = row.comped === true;
    const amount = comped ? 0 : roundMoney((Number(row.amount_cents) || 0) / 100);
    const bucket = grouped.get(email) || { email, payments: [] };
    if (amount > 0 || comped) {
      bucket.payments.push({
        paidAt: String(row.paid_at || ""),
        amount,
        lineId: row.line_id ? String(row.line_id) : null,
        commission: comped ? 0 : commissionOnAmount(amount, input.rate),
      });
    }
    grouped.set(email, bucket);
  }

  if (input.kit) {
    const { data } = await input.supabase
      .from("saas_suite_users")
      .select(USER_COLS)
      .eq("trial_source", "one_feature_kit_30day")
      .gte("created_at", input.since)
      .lt("created_at", input.until)
      .limit(500);
    for (const user of (data || []) as UserRow[]) {
      const email = (user.email || "").trim().toLowerCase();
      if (!email || grouped.has(email)) continue;
      input.usersByEmail.set(email, user);
      grouped.set(email, { email, payments: [] });
    }
  }

  const missing = [...grouped.keys()].filter((email) => !input.usersByEmail.has(email));
  if (missing.length) {
    const extra = await loadUsers(input.supabase, [], missing);
    for (const user of extra) {
      if (user.email) input.usersByEmail.set(user.email.trim().toLowerCase(), user);
    }
  }

  let kitBilling = new Map<string, EmailBilling>();
  if (input.stripe) {
    const accounts = [...grouped.keys()].slice(0, 80).map((email) => ({
      key: email,
      ...billingLookupKeys(email, input.overrides.get(email)),
    }));
    const loaded = await billingForAccounts(input.stripe, accounts, () => input.rate, { includeFailed: true, subscriptions: true });
    kitBilling = loaded.billing;
  }

  const customers = [...grouped.values()].map((bucket) => {
    const user = input.usersByEmail.get(bucket.email);
    const subscription = kitBilling.get(bucket.email)?.subscription || null;
    const stripePayments = (kitBilling.get(bucket.email)?.payments || []).filter((payment) => payment.net > 0);
    const classified = subscription
      ? classifyReferral(subscription)
      : { kind: "unknown" as const, label: user ? "No subscription" : "No SaaS account", plan: null, trialEnd: null, nextPaymentAt: null };
    const saasPayments = stripePayments.map(paymentView);
    return {
      email: input.mask ? maskEmail(bucket.email) : bucket.email,
      name: user?.full_name || null,
      kind: classified.kind,
      label: classified.label,
      plan: classified.plan,
      trialEnd: classified.trialEnd,
      signupAt: user?.created_at || null,
      payments: bucket.payments,
      subscriptionPayments: saasPayments,
      totalPaid: roundMoney(bucket.payments.reduce((sum, payment) => sum + payment.amount, 0) + saasPayments.reduce((sum, payment) => sum + payment.net, 0)),
      totalCommission: roundMoney(bucket.payments.reduce((sum, payment) => sum + payment.commission, 0) + saasPayments.reduce((sum, payment) => sum + payment.commission, 0)),
    };
  }).sort((a, b) => ((a.payments[0]?.paidAt || a.signupAt || "") < (b.payments[0]?.paidAt || b.signupAt || "") ? 1 : -1));

  return customers;
}
