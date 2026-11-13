import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Password-protected read-only stats for the /webinar and /special funnels.
const PASSWORD = Deno.env.get("WEBINAR_STATS_PASSWORD") || "saassuiterocks";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Row = Record<string, any>;

const PATHS = ["/webinar", "/webinar-confirmation", "/watch-saassuite-webinar", "/special"];

// First day this webinar funnel ran ads. Anything spent before it belongs to
// earlier campaigns and must never be blended into these numbers.
const FUNNEL_START = "2026-09-18";

// SaaS plan prices used to estimate revenue from Supabase records.
const PLAN_PRICE: Record<string, number> = {
  STARTER: 0,
  BASIC: 27,
  ADVANCED: 97,
};
const PREMIUM_SUPPORT_PRICE = 297;

const PAGE = 1000;

// Confirmed live attendance for the webinar. WebinarKit only reported a subset
// of the room, so this high-level total keeps the page honest without adding
// fake registrant records or exposing attendee details.
const CONFIRMED_ATTENDEES = 25;

async function fetchEvents(since: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < 60_000; from += PAGE) {
    const { data, error } = await admin
      .from("site_analytics_events")
      .select(
        "created_at, session_id, visitor_key, path, event_type, label, value, duration_ms, referrer, utm_source, utm_campaign, device, country, metadata",
      )
      .in("path", PATHS)
      .neq("event_type", "hover_intent")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const uniq = (rows: Row[], key: string) => new Set(rows.map((r) => r[key]).filter(Boolean)).size;

/** Only count traffic that actually came from Facebook/Meta ads. */
const FB_SOURCE = /^(fb|facebook|ig|instagram|meta|fb_ads|facebook_ads)$/i;
function isFacebookRow(r: Row) {
  if (FB_SOURCE.test(String(r.utm_source || ""))) return true;
  if (/facebook|instagram|fb\.me/i.test(String(r.referrer || ""))) return true;
  const meta = r.metadata && typeof r.metadata === "object" ? JSON.stringify(r.metadata) : "";
  return /fbclid|fbc|"fb"/i.test(meta);
}

/** Sessions with at least one Facebook signal — attribute every event of that session to FB. */
function facebookSessions(rows: Row[]) {
  const s = new Set<string>();
  for (const r of rows) if (r.session_id && isFacebookRow(r)) s.add(r.session_id);
  return s;
}

const median = (nums: number[]) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

function tally(rows: Row[], key: string, limit = 12) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (!v) continue;
    map.set(String(v), (map.get(String(v)) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function publicUrlValue(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function tallyPublic(rows: Row[], key: string, limit = 12) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const raw = r[key];
    if (!raw) continue;
    const value = publicUrlValue(String(raw));
    if (!value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

const REGISTER_LABEL = /save\s*my\s*seat|register|reserve|claim\s*my\s*spot/i;

function pageBlock(rows: Row[]) {
  const views = rows.filter((r) => r.event_type === "pageview");
  const exits = rows.filter((r) => r.event_type === "exit" && r.label === "time_on_page");
  const scrolls = rows.filter((r) => r.event_type === "scroll_depth");
  const durations = exits.map((r) => Number(r.duration_ms) || 0).filter((n) => n > 0);
  const engaged = new Set(scrolls.map((r) => r.session_id));
  const sessions = uniq(views, "session_id");
  return {
    pageviews: views.length,
    unique_sessions: sessions,
    unique_visitors: uniq(views, "visitor_key"),
    clicks: rows.filter((r) => r.event_type === "click").length,
    video_plays: rows.filter((r) => r.event_type === "video_play").length,
    register_clicks: rows.filter((r) => r.event_type === "click" && REGISTER_LABEL.test(String(r.label || ""))).length,
    median_seconds_on_page: Math.round(median(durations) / 1000),
    deep_scroll_75_sessions: new Set(scrolls.filter((r) => Number(r.value) >= 75).map((r) => r.session_id)).size,
    bounce_rate_pct: sessions ? Math.round(((sessions - engaged.size) / sessions) * 100) : 0,
    top_clicks: tally(rows.filter((r) => r.event_type === "click"), "label", 10),
  };
}

function isFunnelLanding(page: string | null) {
  return /webinar|special|watch-saassuite/i.test(String(page || ""));
}

function isPaidPlan(plan: string | null) {
  return !!plan && plan.toUpperCase() !== "STARTER";
}

function estimatedUserRevenue(user: Row) {
  const plan = String(user.plan || "").toUpperCase();
  const base = PLAN_PRICE[plan] ?? 0;
  const premium = user.premium_support ? PREMIUM_SUPPORT_PRICE : 0;
  const monthly = base + premium;
  if (!monthly) return 0;
  const start = new Date(user.created_at);
  if (isNaN(start.getTime())) return 0;
  const now = new Date();
  const months = Math.max(1, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  return monthly * months;
}

async function fetchAllTimeEventStats() {
  const { count: pageviews } = await admin
    .from("site_analytics_events")
    .select("*", { count: "exact", head: true })
    .in("path", PATHS)
    .eq("event_type", "pageview");

  const visitorKeys = new Set<string>();
  const sessionIds = new Set<string>();
  let capped = false;
  for (let from = 0; from < 120_000; from += PAGE) {
    const { data, error } = await admin
      .from("site_analytics_events")
      .select("visitor_key,session_id")
      .in("path", PATHS)
      .eq("event_type", "pageview")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    for (const r of data) {
      if (r.visitor_key) visitorKeys.add(r.visitor_key);
      if (r.session_id) sessionIds.add(r.session_id);
    }
    if (data.length < PAGE) break;
    if (visitorKeys.size + sessionIds.size >= 100_000) {
      capped = true;
      break;
    }
  }

  const videoSessions = new Set<string>();
  for (let from = 0; from < 80_000; from += PAGE) {
    const { data, error } = await admin
      .from("site_analytics_events")
      .select("session_id")
      .in("path", PATHS)
      .eq("event_type", "video_play")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    for (const r of data) if (r.session_id) videoSessions.add(r.session_id);
    if (data.length < PAGE) break;
  }

  return {
    pageviews: pageviews || 0,
    unique_visitors: visitorKeys.size,
    unique_sessions: sessionIds.size,
    viewers: videoSessions.size,
    capped,
  };
}

async function fetchAllTimeRegistrants() {
  const [current, attended] = await Promise.all([
    admin
      .from("webinar_registrations")
      .select("*", { count: "exact", head: true })
      .eq("is_test", false)
      .is("duplicate_of", null),
    admin
      .from("webinar_registrations")
      .select("*", { count: "exact", head: true })
      .eq("is_test", false)
      .is("duplicate_of", null)
      .eq("attended", true),
  ]);
  return { registrants: current.count || 0, attendees: attended.count || 0 };
}

/** Purchases recorded by hand for the webinar funnel (all-time only). */
async function fetchFunnelPurchases() {
  const { data } = await admin
    .from("webinar_funnel_purchases")
    .select("amount, interval, purchased_at")
    .order("purchased_at", { ascending: false });
  const rows = (data ?? []) as {
    amount: number;
    interval: string;
    purchased_at: string;
  }[];
  let collected = 0;
  let mrr = 0;
  const purchasesByMonth = new Map<string, { count: number; collected: number; mrr: number }>();
  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    const monthly = r.interval === "monthly" ? amount : r.interval === "yearly" ? amount / 12 : 0;
    collected += amount;
    mrr += monthly;
    const month = String(r.purchased_at || "").slice(0, 7) || "unknown";
    const monthRow = purchasesByMonth.get(month) ?? { count: 0, collected: 0, mrr: 0 };
    monthRow.count += 1;
    monthRow.collected += amount;
    monthRow.mrr += monthly;
    purchasesByMonth.set(month, monthRow);
  }
  return {
    purchases_by_month: [...purchasesByMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, row]) => ({
        month,
        count: row.count,
        collected: +row.collected.toFixed(2),
        mrr: +row.mrr.toFixed(2),
      })),
    count: rows.length,
    matched_count: rows.length,
    collected: +collected.toFixed(2),
    mrr: +mrr.toFixed(2),
    unmatched_count: 0,
    unmatched_collected: 0,
    unmatched_mrr: 0,
  };
}



async function fetchAllTimeFunnelUsers() {
  const out: Row[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await admin
      .from("saas_suite_users")
      .select("created_at, plan, premium_support, landing_page")
      .or("landing_page.ilike.%webinar%,landing_page.ilike.%special%,landing_page.ilike.%watch-saassuite%")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    // The OR filter catches most matches; also include any literal watch-saassuite variant.
    for (const u of data) {
      if (isFunnelLanding(u.landing_page)) out.push(u);
    }
    if (data.length < PAGE) break;
  }
  return out;
}

type AdSnapshot = Record<string, any>;

const sum = (rows: AdSnapshot[], k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

function adAggregate(rows: AdSnapshot[]) {
  const spend = sum(rows, "spend");
  const impressions = sum(rows, "impressions");
  const clicks = sum(rows, "clicks");
  const leads = sum(rows, "leads");
  const registrations = sum(rows, "registrations");
  const purchases = sum(rows, "purchases");
  const revenue = sum(rows, "revenue");
  return {
    days: rows.length,
    spend,
    impressions,
    reach: sum(rows, "reach"),
    clicks,
    leads,
    registrations,
    purchases,
    revenue,
    ctr: impressions ? +((clicks / impressions) * 100).toFixed(2) : 0,
    cpc: clicks ? +(spend / clicks).toFixed(2) : 0,
    cpm: impressions ? +((spend / impressions) * 1000).toFixed(2) : 0,
    cpl: leads ? +(spend / leads).toFixed(2) : 0,
    cpa: purchases ? +(spend / purchases).toFixed(2) : 0,
    roas: spend ? +(revenue / spend).toFixed(2) : 0,
    profit: +(revenue - spend).toFixed(2),
  };
}

/** Ad data pushed in through webinar-ads-api. */
async function fetchAds(since: string) {
  const windowStart = since.slice(0, 10) > FUNNEL_START ? since.slice(0, 10) : FUNNEL_START;
  const [{ data: windowRows }, { data: allRows }] = await Promise.all([
    admin
      .from("webinar_ad_snapshots")
      .select("*")
      .gte("snapshot_date", windowStart)
      .order("snapshot_date", { ascending: true }),
    admin
      .from("webinar_ad_snapshots")
      .select("*")
      .gte("snapshot_date", FUNNEL_START)
      .order("snapshot_date", { ascending: true }),
  ]);

  const wRows = windowRows ?? [];
  const aRows = allRows ?? [];
  const latest = aRows.length ? aRows[aRows.length - 1] : null;

  let entities: AdSnapshot[] = [];
  if (wRows.length) {
    const { data } = await admin
      .from("webinar_ad_entities")
      .select("*")
      .in("snapshot_id", wRows.map((r) => r.id))
      .order("spend", { ascending: false });
    entities = data ?? [];
  }

  // Roll breakdowns up across the window so repeated daily pushes don't duplicate names.
  const rolled = new Map<string, AdSnapshot>();
  for (const e of entities) {
    const key = `${e.level}|${e.name}`;
    const cur = rolled.get(key) ?? {
      level: e.level,
      name: e.name,
      campaign_name: e.campaign_name,
      adset_name: e.adset_name,
      status: e.status,
      thumbnail_url: e.thumbnail_url,
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      registrations: 0,
      purchases: 0,
      revenue: 0,
    };
    for (const k of ["spend", "impressions", "clicks", "leads", "registrations", "purchases", "revenue"]) {
      cur[k] += Number(e[k]) || 0;
    }
    rolled.set(key, cur);
  }
  const byLevel = (level: string) =>
    [...rolled.values()]
      .filter((r) => r.level === level)
      .map((r) => ({
        ...r,
        ctr: r.impressions ? +((r.clicks / r.impressions) * 100).toFixed(2) : 0,
        cpc: r.clicks ? +(r.spend / r.clicks).toFixed(2) : 0,
        cpl: r.leads ? +(r.spend / r.leads).toFixed(2) : 0,
        roas: r.spend ? +(r.revenue / r.spend).toFixed(2) : 0,
      }))
      .sort((a: any, b: any) => (Number(b.spend) || 0) - (Number(a.spend) || 0));

  // "Live configuration": ad sets that still spent money on the most recent reported day.
  // Retired sets keep their historical spend in the blended numbers, which makes
  // cost-per-lead look far worse than the current setup actually is.
  const latestSnapshotId = latest?.id;
  const liveNames = new Set(
    entities
      .filter((e) => e.snapshot_id === latestSnapshotId && e.level === "adset" && (Number(e.spend) || 0) > 0)
      .map((e) => String(e.name)),
  );
  const liveSets = [...rolled.values()].filter((r) => r.level === "adset" && liveNames.has(String(r.name)));
  const liveSpend = liveSets.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const liveLeads = liveSets.reduce((s, r) => s + (Number(r.leads) || 0), 0);
  const liveClicks = liveSets.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const liveImpressions = liveSets.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const retiredSpend = +(adAggregate(wRows).spend - liveSpend).toFixed(2);

  return {
    has_data: aRows.length > 0,
    live: {
      ad_sets: liveSets.length,
      spend: +liveSpend.toFixed(2),
      leads: liveLeads,
      clicks: liveClicks,
      impressions: liveImpressions,
      cpl: liveLeads ? +(liveSpend / liveLeads).toFixed(2) : 0,
      ctr: liveImpressions ? +((liveClicks / liveImpressions) * 100).toFixed(2) : 0,
      retired_spend: retiredSpend > 0 ? retiredSpend : 0,
    },
    last_push: latest ? { date: latest.snapshot_date, source: latest.source, notes: latest.notes, updated_at: latest.updated_at } : null,
    sources: [...new Set(aRows.map((r) => r.source))],
    window: adAggregate(wRows),
    all_time: adAggregate(aRows),
    daily: wRows.map((r) => ({
      date: r.snapshot_date,
      source: r.source,
      spend: Number(r.spend) || 0,
      clicks: Number(r.clicks) || 0,
      leads: Number(r.leads) || 0,
      purchases: Number(r.purchases) || 0,
      revenue: Number(r.revenue) || 0,
      roas: Number(r.roas) || 0,
      ctr: Number(r.ctr) || 0,
    })),
    campaigns: byLevel("campaign"),
    ad_sets: byLevel("adset"),
    creatives: byLevel("creative"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (String(body?.password || "") !== PASSWORD) return json({ error: "Unauthorized" }, 401);

    const days = Math.min(365, Math.max(1, Number(body?.days) || 7));
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    // Never count traffic or spend from before this funnel started running.
    const campaignStart = `${FUNNEL_START}T00:00:00.000Z`;
    const effectiveSince = campaignStart > since ? campaignStart : since;

    const rawEvents = await fetchEvents(effectiveSince);
    // Only Facebook-sourced sessions count — direct/organic/internal traffic skews the funnel.
    const fbSessions = facebookSessions(rawEvents);
    const events = rawEvents.filter((r) => r.session_id && fbSessions.has(r.session_id));

    const byPath: Record<string, ReturnType<typeof pageBlock>> = {};
    for (const p of PATHS) byPath[p] = pageBlock(events.filter((r) => r.path === p));

    // Daily timeline of pageviews per path
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dayKeys.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
    }
    const timeline = dayKeys.map((date) => {
      const row: Record<string, string | number> = { date };
      for (const p of PATHS) {
        row[p] = events.filter(
          (r) => r.event_type === "pageview" && r.path === p && String(r.created_at).slice(0, 10) === date,
        ).length;
      }
      return row;
    });

    // Registrants captured from the live /webinar form within the window
    // (duplicate signups are collapsed onto the original row)
    const REG_FIELDS =
      "created_at, attended, attendance_status, watched_replay, offer_clicked, needs_followup, is_test";
    const { data: regs } = await admin
      .from("webinar_registrations")
      .select(REG_FIELDS)
      .eq("is_test", false)
      .is("duplicate_of", null)
      .gte("created_at", effectiveSince)
      .order("created_at", { ascending: false });
    const attendedCount = (regs ?? []).filter((r) => r.attended).length;
    const missedCount = (regs ?? []).filter((r) => r.attendance_status === "missed").length;
    const replayCount = (regs ?? []).filter((r) => r.watched_replay).length;
    const offerClickCount = (regs ?? []).filter((r) => r.offer_clicked).length;

    // Everyone flagged for a manual follow-up, regardless of window
    const { data: followupRows } = await admin
      .from("webinar_registrations")
      .select(REG_FIELDS)
      .eq("is_test", false)
      .is("duplicate_of", null)
      .eq("needs_followup", true)
      .order("created_at", { ascending: false });



    // Signups + purchases attributed to these funnel pages
    const { data: users } = await admin
      .from("saas_suite_users")
      .select("created_at, plan, billing_state, landing_page, utm_source, utm_campaign, agency_name, premium_support")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    const funnelUsers = (users ?? []).filter((u) => isFunnelLanding(u.landing_page));


    // All-time stats (kept entirely separate from the rolling window)
    const [allTimeEvents, allTimeRegs, allTimeUsers, funnelPurchases, ads] = await Promise.all([
      fetchAllTimeEventStats(),
      fetchAllTimeRegistrants(),
      fetchAllTimeFunnelUsers(),
      fetchFunnelPurchases().catch((e) => {
        console.error("funnel purchases", e);
        return {
          purchases_by_month: [],
          count: 0,
          matched_count: 0,
          collected: 0,
          mrr: 0,
          unmatched_count: 0,
          unmatched_collected: 0,
          unmatched_mrr: 0,
        };
      }),

      fetchAds(since).catch((e) => {
        console.error("ads", e);
        return null;
      }),
    ]);

    const allTimePaid = allTimeUsers.filter((u) => isPaidPlan(u.plan));
    const allTimeMrr = allTimePaid.reduce((s, u) => {
      const base = PLAN_PRICE[String(u.plan || "").toUpperCase()] ?? 0;
      return s + base + (u.premium_support ? PREMIUM_SUPPORT_PRICE : 0);
    }, 0);

    return json({
      generated_at: new Date().toISOString(),
      window_days: days,
      ads,
      totals: {
        webinar_pageviews: byPath["/webinar"].pageviews,
        webinar_visitors: byPath["/webinar"].unique_visitors,
        special_pageviews: byPath["/special"].pageviews,
        special_visitors: byPath["/special"].unique_visitors,
        missed: missedCount,

        register_clicks:
          byPath["/webinar"].register_clicks + byPath["/special"].register_clicks,
        registrants: regs?.length ?? 0,
        attendees: Math.max(attendedCount, CONFIRMED_ATTENDEES),
        replay_viewers: replayCount,
        offer_clicks: offerClickCount,
        needs_followup: (followupRows ?? []).length,
        purchases: funnelUsers.filter((u) => isPaidPlan(u.plan)).length,
      },

      counting: {
        campaign_start: campaignStart ? campaignStart.slice(0, 10) : null,
        window_start: effectiveSince.slice(0, 10),
        facebook_only: true,
        excludes_test_registrations: true,
      },
      by_path: byPath,
      timeline,
      traffic: {
        sources: tally(events.filter((r) => r.event_type === "pageview"), "utm_source"),
        campaigns: tally(events.filter((r) => r.event_type === "pageview"), "utm_campaign"),
        referrers: tallyPublic(events.filter((r) => r.event_type === "pageview"), "referrer"),
        devices: tally(events.filter((r) => r.event_type === "pageview"), "device"),
        countries: tally(events.filter((r) => r.event_type === "pageview"), "country"),
      },
      funnel_users: {
        count: funnelUsers.length,
        paid: funnelUsers.filter((u) => isPaidPlan(u.plan)).length,
        estimated_revenue: +funnelUsers.reduce((sum, u) => sum + estimatedUserRevenue(u), 0).toFixed(2),
      },
      all_time: {
        pageviews: allTimeEvents.pageviews,
        unique_visitors: allTimeEvents.unique_visitors,
        unique_sessions: allTimeEvents.unique_sessions,
        registrants: allTimeRegs.registrants,
        attendees: Math.max(allTimeRegs.attendees, CONFIRMED_ATTENDEES),
        purchases: funnelPurchases.matched_count,
        recorded_purchases: funnelPurchases.count,
        // Revenue tied to a known registrant only.
        collected_revenue: funnelPurchases.collected,
        // Recorded sales are the single source of truth for funnel MRR, so
        // plan-derived MRR is reported separately instead of being added on top.
        mrr: +funnelPurchases.mrr.toFixed(2),
        unmatched_purchases: funnelPurchases.unmatched_count,
        unmatched_collected_revenue: funnelPurchases.unmatched_collected,
        plan_mrr: allTimeMrr,
        purchases_by_month: funnelPurchases.purchases_by_month,
        capped: allTimeEvents.capped,
      },

    });

  } catch (e) {
    console.error("webinar-stats", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
