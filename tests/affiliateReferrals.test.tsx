import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AffiliateReferralReport } from "../src/components/affiliate/AffiliateReferralReport";
import {
  attributionPageUrl,
  authorizeAffiliateReferralRead,
  billingLookupKeys,
  classifyReferral,
  collectedInvoice,
  commissionOnAmount,
  expectedTrialCommission,
  planListPrice,
  priceAfterDiscounts,
  subscriptionConvertPrice,
  conversionRate,
  failedInvoice,
  fillActivitySeries,
  invoicePeriodIndex,
  isCachedAffiliatePortal,
  isKitPageAttribution,
  maskEmail,
  projectCachedPortals,
  pageStatsWindow,
  seriesFailureNote,
  rateForNewReferral,
  rateForReferral,
  visitorBase,
} from "../supabase/functions/_shared/affiliateReferrals";

const NOW = new Date("2026-10-22T15:00:00.000Z");

describe("referral commission rates", () => {
  it("defaults new referrals to 30 and keeps a stored referral rate", () => {
    expect(rateForNewReferral(null)).toBe(30);
    expect(rateForNewReferral("")).toBe(30);
    expect(rateForNewReferral(0)).toBe(0);
    expect(rateForNewReferral(70)).toBe(70);
    expect(rateForNewReferral(150)).toBe(30);
    expect(rateForReferral(30)).toBe(30);
    expect(rateForReferral(70)).toBe(70);
    expect(rateForReferral(undefined)).toBe(30);
  });

  it("commissions the cash collected, including a discounted invoice", () => {
    expect(commissionOnAmount(97, 70)).toBe(67.9);
    expect(commissionOnAmount(87.3, 30)).toBe(26.19);
  });
});

describe("collected invoices", () => {
  const paidAt = 1_760_000_000;

  it("uses amount paid at the referral rate", () => {
    const payment = collectedInvoice({
      id: "in_paid",
      status: "paid",
      amount_paid: 9700,
      currency: "usd",
      created: paidAt,
      status_transitions: { paid_at: paidAt },
    }, 70);
    expect(payment?.net).toBe(97);
    expect(payment?.commission).toBe(67.9);
    expect(payment?.paidAt).toBe(new Date(paidAt * 1000).toISOString());
  });

  it("subtracts a partial refund and hides a full refund or a zero trial", () => {
    const partial = collectedInvoice({
      id: "in_partial",
      status: "paid",
      amount_paid: 9700,
      currency: "usd",
      created: paidAt,
      charge: { amount_refunded: 2000 },
    }, 70);
    expect(partial?.net).toBe(77);
    expect(partial?.refunded).toBe(20);
    expect(partial?.commission).toBe(53.9);

    expect(collectedInvoice({
      id: "in_refunded",
      status: "paid",
      amount_paid: 9700,
      amount_refunded: 9700,
      currency: "usd",
      created: paidAt,
    }, 70)).toBeNull();

    const kept = collectedInvoice({
      id: "in_refunded",
      status: "paid",
      amount_paid: 9700,
      post_payment_credit_notes_amount: 9700,
      currency: "usd",
      created: paidAt,
    }, 70, { keepFullyRefunded: true });
    expect(kept?.net).toBe(0);
    expect(kept?.commission).toBe(0);

    expect(collectedInvoice({
      id: "in_trial",
      status: "paid",
      amount_paid: 0,
      currency: "usd",
      created: paidAt,
    }, 70)).toBeNull();

    expect(collectedInvoice({ id: "in_open", status: "open", amount_paid: 9700, created: paidAt }, 70)).toBeNull();
  });

  it("stores invoice rows on a period index that will not collide with monthly estimates", () => {
    expect(invoicePeriodIndex(1_700_000_000)).toBe(1_700_000_000);
    expect(invoicePeriodIndex(12)).toBe(1_600_000_000);
    expect(invoicePeriodIndex(3_000_000_000)).toBe(2_000_000_000);
  });
});

describe("referral status", () => {
  it("reads Trial, Active, Past due, and Canceled from Stripe only", () => {
    expect(maskEmail("john@gmail.com")).toBe("jo***@gmail.com");
    expect(classifyReferral({ status: "past_due" }, NOW).label).toBe("Past due");
    expect(classifyReferral({ status: "trialing", trialEnd: "2026-11-01T00:00:00.000Z", plan: "Advanced" }, NOW).label).toBe("Trial");
    expect(classifyReferral({ status: "active", plan: "Advanced", periodEnd: "2026-11-22T00:00:00.000Z" }, NOW).label).toBe("Active");
    expect(classifyReferral({ status: "canceled" }, NOW).kind).toBe("canceled");
    expect(classifyReferral(null, NOW).label).toBe("No subscription");
    expect(classifyReferral({ status: "trialing", trialEnd: "2026-11-01T00:00:00.000Z" }, NOW).trialEnd).toBe("2026-11-01T00:00:00.000Z");
  });

  it("keeps a Stripe email override beside the app email", () => {
    expect(billingLookupKeys("craig@botsguy.com", { stripeEmail: "smartsites@gmail.com" })).toEqual({
      emails: ["craig@botsguy.com", "smartsites@gmail.com"],
      customerIds: [],
    });
    expect(billingLookupKeys("person@example.com", { stripeCustomerId: "cus_123" }).customerIds).toEqual(["cus_123"]);
  });

  it("treats failed collections as unpaid and charts net revenue by day", () => {
    expect(failedInvoice({ id: "in_open", status: "open", attempt_count: 2, amount_due: 9700, currency: "usd", created: 1_760_000_000 })?.amount).toBe(97);
    expect(failedInvoice({ id: "in_paid", status: "paid", attempt_count: 1, amount_due: 0, amount_paid: 9700, currency: "usd", created: 1_760_000_000 })).toBeNull();
    const series = fillActivitySeries({
      since: "2026-10-01T00:00:00.000Z",
      until: "2026-10-03T00:00:00.000Z",
      rows: [{ date: "2026-10-01", views: 4, clicks: 1, signups: 1 }],
      payments: [{ paidAt: "2026-10-02T12:00:00.000Z", net: 97 }],
    });
    expect(series.map((point) => point.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(series[0].views).toBe(4);
    expect(series[1].revenue).toBe(97);
  });

  it("lets an affiliate read only their own rows and keeps admin impersonation masked", () => {
    expect(authorizeAffiliateReferralRead({
      isPlatformAdmin: false,
      scope: "self",
      requestedAffiliateId: "other",
      ownedAffiliateIds: ["mine"],
    }).ok).toBe(false);
    const adminScope = authorizeAffiliateReferralRead({
      isPlatformAdmin: false,
      scope: "admin",
      requestedAffiliateId: null,
      ownedAffiliateIds: ["mine"],
    });
    expect(adminScope.ok).toBe(false);
    if (!adminScope.ok) expect(adminScope.status).toBe(403);
    const impersonated = authorizeAffiliateReferralRead({
      isPlatformAdmin: true,
      scope: "self",
      requestedAffiliateId: "theirs",
      ownedAffiliateIds: [],
    });
    expect(impersonated.ok).toBe(true);
    if (impersonated.ok) expect(impersonated.maskEmails).toBe(true);
  });
});

describe("page attribution", () => {
  it("defaults the window to 45 days and builds the public page link", () => {
    expect(pageStatsWindow(undefined, NOW.getTime()).days).toBe(45);
    expect(pageStatsWindow(900, NOW.getTime()).days).toBe(366);
    expect(conversionRate(1, 4)).toBe(25);
    expect(conversionRate(0, 0)).toBeNull();
    expect(visitorBase(0, 10)).toBe(10);
    expect(visitorBase(5, 10)).toBe(5);
    expect(isKitPageAttribution("/one-feature-kit", null)).toBe(true);
    expect(isKitPageAttribution("/pricing", "one-feature-kit")).toBe(true);
    expect(isKitPageAttribution("/pricing", null)).toBe(false);
    expect(attributionPageUrl("/one-feature-kit")).toBe("https://saassuite.ai/one-feature-kit");
  });
});

describe("expected trial conversion revenue", () => {
  it("uses the discounted subscription price, then the plan list price, and skips anyone who is not in trial", () => {
    expect(planListPrice("Advanced")).toBe(97);
    expect(planListPrice("Basic")).toBe(27);
    expect(planListPrice("Elite")).toBe(97);
    expect(planListPrice("Starter")).toBe(0);
    expect(planListPrice("Custom")).toBeNull();
    expect(priceAfterDiscounts(9700, [{ coupon: { percent_off: 40 } }], "usd")).toBe(58.2);
    expect(priceAfterDiscounts(9700, [{ coupon: { amount_off: 2000 } }], "usd")).toBe(77);
    expect(subscriptionConvertPrice({
      discounts: [{ coupon: { percent_off: 40 } }],
      items: { data: [{ quantity: 1, price: { unit_amount: 9700, currency: "usd", nickname: "Advanced" } }] },
    })).toBe(58.2);
    expect(subscriptionConvertPrice({
      discounts: ["di_unexpanded"],
      items: { data: [{ price: { unit_amount: 2700, currency: "usd" } }] },
    })).toBe(27);

    const mixed = expectedTrialCommission([
      { kind: "trial", commissionRate: 70, convertPrice: 58.2, plan: "Advanced" },
      { kind: "trial", commissionRate: 30, convertPrice: null, plan: "Basic" },
      { kind: "trial", commissionRate: 30, convertPrice: 0, plan: "Advanced" },
      { kind: "active", commissionRate: 30, convertPrice: 97, plan: "Advanced" },
      { kind: "unknown", commissionRate: 30, convertPrice: null, plan: "Advanced" },
    ]);
    expect(mixed).toEqual({ amount: 48.84, trials: 3 });
    expect(expectedTrialCommission([])).toEqual({ amount: 0, trials: 0 });
    expect(expectedTrialCommission([{ kind: "trial", commissionRate: Number.NaN, convertPrice: null, plan: "Advanced" }])).toEqual({
      amount: 29.1,
      trials: 1,
    });
  });
});

describe("affiliate portal cache projection", () => {
  const since = "2026-10-01T00:00:00.000Z";
  const until = "2026-10-22T00:00:00.000Z";
  const cache = {
    version: 1 as const,
    commissionRate: 70,
    pendingPayout: 12.5,
    pageSince: "2026-09-01T00:00:00.000Z",
    pageUntil: "2026-10-01T00:00:00.000Z",
    seriesDays: [{ date: "2026-10-10", views: 4, clicks: 1, signups: 1 }],
    pages: [{ id: "kit", customers: [{ email: "buyer@example.com" }] }],
    referrals: [
      {
        id: "trial",
        email: "trial@example.com",
        kind: "trial",
        commissionRate: 70,
        convertPrice: 97,
        plan: "Advanced",
        payments: [],
      },
      {
        id: "paid",
        email: "paid@example.com",
        kind: "active",
        commissionRate: 70,
        convertPrice: 97,
        plan: "Advanced",
        payments: [{ paidAt: "2026-10-10T00:00:00.000Z", net: 97, commission: 67.9, paid: 97, refunded: 0 }],
      },
    ],
  };

  it("turns an empty cache into zeros without throwing", () => {
    const projected = projectCachedPortals({ caches: [], since, until, maskEmails: true });
    expect(projected.referrals).toEqual([]);
    expect(projected.pages).toEqual([]);
    expect(projected.activity.expectedTrialCommission).toBe(0);
    expect(projected.activity.expectedTrialCount).toBe(0);
    expect(projected.activity.pendingPayout).toBeNull();
    expect(projected.activity.revenue).toBe(0);
    expect(isCachedAffiliatePortal({ version: 1 })).toBe(false);
    expect(isCachedAffiliatePortal({ version: 1, referrals: [] })).toBe(true);
  });

  it("sums trial commission, slices revenue to the picked dates, and masks emails", () => {
    const projected = projectCachedPortals({ caches: [cache], since, until, maskEmails: true });
    expect(projected.activity.expectedTrialCommission).toBe(67.9);
    expect(projected.activity.expectedTrialCount).toBe(1);
    expect(projected.activity.revenue).toBe(97);
    expect(projected.activity.commission).toBe(67.9);
    expect(projected.activity.views).toBe(4);
    expect(projected.referrals.map((row) => row.email).join(" ")).not.toContain("trial@example.com");
    expect(JSON.stringify(projected.pages)).not.toContain("buyer@example.com");
    expect(projected.activityNote).toContain("Kit totals are from the daily refresh");
    expect(projected.commissionRate).toBe(70);
  });

  it("keeps current trials when the chart window has no payments", () => {
    const later = projectCachedPortals({
      caches: [cache],
      since: "2026-11-01T00:00:00.000Z",
      until: "2026-11-15T00:00:00.000Z",
      maskEmails: false,
    });
    expect(later.activity.revenue).toBe(0);
    expect(later.activity.commission).toBe(0);
    expect(later.activity.expectedTrialCommission).toBe(67.9);
    expect(later.referrals[0]?.email).toBe("trial@example.com");
  });

  it("ignores a broken payment amount", () => {
    const projected = projectCachedPortals({
      caches: [{
        version: 1,
        referrals: [{ id: "x", email: "a@b.co", kind: "active", payments: [{ paidAt: since, net: Number.NaN, commission: Number.NaN }] }],
        pendingPayout: 0,
        pageSince: since,
        pageUntil: until,
      }],
      since,
      until,
      maskEmails: false,
    });
    expect(projected.activity.revenue).toBe(0);
    expect(projected.activityNote).toBeNull();
    expect(JSON.stringify(projected)).not.toContain("NaN");
  });
});

function activity(overrides: Record<string, number | null> = {}) {
  return {
    views: 0,
    clicks: 0,
    signups: 0,
    trials: 0,
    active: 0,
    revenue: 0,
    commission: 0,
    pendingPayout: 0,
    expectedTrialCommission: 0,
    expectedTrialCount: 0,
    ...overrides,
  };
}

describe("affiliate referral report", () => {
  it("renders masked status, payment commission, and the attributed page link", () => {
    const html = renderToStaticMarkup(
      <AffiliateReferralReport
        showAffiliate={false}
        notices={[]}
        series={[{ date: "2026-10-02", label: "Oct 2", views: 3, clicks: 1, signups: 1, revenue: 97 }]}
        activity={activity({
          views: 3,
          clicks: 1,
          signups: 1,
          trials: 1,
          revenue: 97,
          commission: 67.9,
          pendingPayout: 0,
          expectedTrialCommission: 67.9,
          expectedTrialCount: 1,
        })}
        referrals={[{
          id: "ref-1",
          name: "Jordan",
          email: "jo***@gmail.com",
          signupAt: "2026-10-01T00:00:00.000Z",
          kind: "trial",
          label: "Trial",
          plan: "Advanced",
          trialEnd: "2026-10-31T00:00:00.000Z",
          lastPaymentAt: "2026-10-02T00:00:00.000Z",
          commissionRate: 70,
          payments: [{ paidAt: "2026-10-02T00:00:00.000Z", paid: 97, refunded: 0, net: 97, commission: 67.9 }],
          totalPaid: 97,
          totalCommission: 67.9,
          nextPaymentAt: "2026-11-21T00:00:00.000Z",
        }]}
        pages={[{
          id: "page-1",
          label: "One Feature Kit",
          url: "https://saassuite.ai/one-feature-kit",
          pagePath: "/one-feature-kit",
          commissionRate: 70,
          available: true,
          note: null,
          visits: 12,
          uniqueVisitors: 9,
          leads: 4,
          checkoutStarts: 2,
          purchases: 1,
          revenue: 27,
          commission: 18.9,
          leadRate: 44.4,
          checkoutRate: 22.2,
          purchaseRate: 50,
          downstreamTrials: 1,
          downstreamPaying: 0,
          customers: [],
        }]}
      />,
    );
    expect(html).toContain("jo***@gmail.com");
    expect(html).toContain("Trial");
    expect(html).toContain("$67.90");
    expect(html).toContain("https://saassuite.ai/one-feature-kit");
    expect(html).toContain("Active paying");
    expect(html).toContain("Pending payout");
    expect(html).toContain("Expected 14-day trial conversion revenue");
    expect(html).toContain("+$67.90");
    expect(html).toContain("Commission if every current trial converts. 1 trial.");
    expect(html).not.toContain("NaN");
  });

  it("shows +$0 and no kit section for an affiliate with no referrals", () => {
    const html = renderToStaticMarkup(
      <AffiliateReferralReport
        showAffiliate={false}
        notices={[]}
        series={[]}
        activity={activity()}
        referrals={[]}
        pages={[]}
      />,
    );
    expect(html).toContain("Expected 14-day trial conversion revenue");
    expect(html).toContain("+$0.00");
    expect(html).toContain("Commission if every current trial converts. 0 trials.");
    expect(html).toContain("No referrals yet.");
    expect(html).not.toContain("one-feature-kit");
    expect(html).not.toContain("NaN");
  });

  it("shows signups without kit stats or trial revenue when nobody is in trial", () => {
    const html = renderToStaticMarkup(
      <AffiliateReferralReport
        showAffiliate={false}
        notices={[]}
        series={[]}
        activity={activity({ signups: 2 })}
        referrals={[{
          id: "signup-1",
          name: "Casey",
          email: "ca***@gmail.com",
          signupAt: "2026-10-02T00:00:00.000Z",
          kind: "unknown",
          label: "No subscription",
          plan: null,
          trialEnd: null,
          commissionRate: 30,
          payments: [],
          totalPaid: 0,
          totalCommission: 0,
          nextPaymentAt: null,
        }]}
        pages={[]}
      />,
    );
    expect(html).toContain("ca***@gmail.com");
    expect(html).toContain("No subscription");
    expect(html).toContain("+$0.00");
    expect(html).not.toContain("one-feature-kit");
    expect(html).not.toContain("NaN");
  });

  it("shows paid referrals at 30% without kit stats and without trial revenue", () => {
    const html = renderToStaticMarkup(
      <AffiliateReferralReport
        showAffiliate
        notices={[]}
        series={[]}
        activity={activity({ signups: 1, active: 1, revenue: 97, commission: 29.1, pendingPayout: 29.1 })}
        referrals={[{
          id: "paid-1",
          affiliateName: "North Agency",
          name: "Avery",
          email: "avery@example.com",
          signupAt: "2026-09-01T00:00:00.000Z",
          kind: "active",
          label: "Active",
          plan: "Advanced",
          trialEnd: null,
          commissionRate: 30,
          payments: [{ paidAt: "2026-10-01T00:00:00.000Z", paid: 97, refunded: 0, net: 97, commission: 29.1 }],
          totalPaid: 97,
          totalCommission: 29.1,
          nextPaymentAt: "2026-11-01T00:00:00.000Z",
        }]}
        pages={[]}
      />,
    );
    expect(html).toContain("avery@example.com");
    expect(html).toContain("Active");
    expect(html).toContain("$29.10");
    expect(html).toContain("+$0.00");
    expect(html).toContain("North Agency");
    expect(html).not.toContain("one-feature-kit");
    expect(html).not.toContain("NaN");
  });

  it("renders the link under the chart and zeros when fields are missing", () => {
    const html = renderToStaticMarkup(
      <AffiliateReferralReport
        notices={[]}
        belowChart={<p>saassuite.ai/?ref=demo</p>}
      />,
    );
    expect(html).toContain("+$0.00");
    expect(html).toContain("saassuite.ai/?ref=demo");
    expect(html.indexOf("Performance")).toBeLessThan(html.indexOf("saassuite.ai/?ref=demo"));
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Your Affiliate Link");
  });
});

describe("chart failure note", () => {
  it("names a timeout and keeps the migration sentence for a missing function", () => {
    expect(seriesFailureNote({ code: "57014", message: "canceling statement due to statement timeout" }, true))
      .toBe("The activity chart query timed out. Showing the last saved chart.");
    expect(seriesFailureNote({ code: "57014", message: "canceling statement due to statement timeout" }, false))
      .toBe("The activity chart query timed out. It will be tried again on the next refresh.");
    expect(seriesFailureNote({ message: "Could not connect" }, false))
      .toBe("The activity chart could not be loaded. It will be tried again on the next refresh.");
    expect(seriesFailureNote({ code: "PGRST202", message: "affiliate_portal_series" }, false))
      .toBe("The activity chart needs the affiliate stats migration.");
  });
});

describe("affiliate referral sources", () => {
  it("does not accrue list price and does not hardcode a person in application code", () => {
    const accrue = readFileSync(new URL("../supabase/functions/accrue-affiliate-commissions/index.ts", import.meta.url), "utf8");
    expect(accrue).not.toContain("monthsBetween");
    expect(accrue).not.toContain("PLAN_PRICES");
    expect(accrue).toContain("keepFullyRefunded");
    expect(accrue).toContain("stripe_invoice_id");

    const notify = readFileSync(new URL("../supabase/functions/notify-stripe-purchase/index.ts", import.meta.url), "utf8");
    expect(notify).not.toContain("0.30");
    expect(notify).toContain("rateForNewReferral");
    expect(notify).toContain("ignoreDuplicates");

    const migration = readFileSync(new URL("../supabase/migrations/20261022184859_affiliate_referral_status.sql", import.meta.url), "utf8");
    expect(migration).toContain("SET commission_rate = 70");
    expect(migration).toContain("COALESCE(a.commission_rate, 30)");
    expect(migration).toContain("affiliate_billing_overrides");
    expect(migration).toContain("craig@botsguy.com");
    expect(migration).toContain("smartsites@gmail.com");
    expect(accrue).toContain("billingForAccount");
    expect(accrue).toContain("stripe_invoice_id");

    const portal = readFileSync(new URL("../supabase/functions/affiliate-referrals/index.ts", import.meta.url), "utf8");
    const sharedPortal = readFileSync(new URL("../supabase/functions/_shared/affiliateReferrals.ts", import.meta.url), "utf8");
    expect(sharedPortal).toContain("expectedTrialCommission");
    expect(sharedPortal).toContain("expectedTrialCount");
    expect(portal).toContain("activity: projected.activity");
    expect(portal).toContain("affiliate_portal_cache");
    expect(portal).toContain("refresh-batch");
    expect(portal).toContain("projectCachedPortals");
    expect(portal).toContain("loadPortalSeries");
    expect(portal).toContain("previousSeries");
    expect(sharedPortal).toContain("The activity chart query timed out.");
    const seriesMigration = readFileSync(new URL("../supabase/migrations/20261022212630_affiliate_portal_series_chart.sql", import.meta.url), "utf8");
    expect(seriesMigration).toContain("text_pattern_ops");
    expect(seriesMigration).toContain("site_analytics_events_chart_path_idx");
    expect(seriesMigration).toContain("~>=~");
    const cacheMigration = readFileSync(new URL("../supabase/migrations/20261022204259_affiliate_portal_cache.sql", import.meta.url), "utf8");
    expect(cacheMigration).toContain("affiliate_portal_cache");
    expect(cacheMigration).toContain("refresh-affiliate-portal-cache");
    expect(cacheMigration).toContain("30 14 * * *");
    expect(cacheMigration).toContain("can_access_affiliate");
    const dashboardAffiliate = readFileSync(new URL("../src/components/AffiliateDashboard.tsx", import.meta.url), "utf8");
    expect(dashboardAffiliate).not.toContain("Your Affiliate Link");
    expect(dashboardAffiliate).toContain("belowChart");
    expect(dashboardAffiliate).toContain("Affiliate link");
    const lazy = readFileSync(new URL("../src/lib/lazyRoute.tsx", import.meta.url), "utf8");
    expect(lazy).toContain("shouldReloadForChunkError");
    const appEntry = readFileSync(new URL("../src/entries/app.tsx", import.meta.url), "utf8");
    const funnelEntry = readFileSync(new URL("../src/entries/funnel.tsx", import.meta.url), "utf8");
    expect(appEntry).toContain("installChunkReload()");
    expect(funnelEntry).toContain("installChunkReload()");
    const dashboard = readFileSync(new URL("../src/components/Dashboard.tsx", import.meta.url), "utf8");
    expect(dashboard).not.toContain("GiveawayStandingsCard");
    expect(dashboard).toContain("overview && <HubUrlCard");
    expect(dashboard).not.toContain("giveaway.ts");

    const uuid = "15e6d7bf-3e08-4974-a8b5-8e6217382f39";
    for (const file of [...walk("src"), ...walk("supabase/functions")]) {
      const text = readFileSync(file, "utf8").toLowerCase();
      expect(text.includes(uuid), file).toBe(false);
      expect(/\brussel\b/.test(text), file).toBe(false);
    }
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
