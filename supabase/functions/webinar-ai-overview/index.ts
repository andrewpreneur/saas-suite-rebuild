import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * AI overview endpoint — read-only PULL of everything behind /webinar-stats,
 * shaped for an AI agent to reason about (compact numbers + plain-English notes).
 *
 * Auth: `x-api-key: <WEBINAR_ADS_API_KEY>` (or `Authorization: Bearer <key>`)
 *
 * GET /            -> full overview (?days=7 default, max 365)
 * GET /schema      -> what this returns
 * GET /registrants -> registrant list with attendance + retention
 * GET /retention   -> retention funnel only
 * GET /ads         -> ad spend aggregates only
 */

const API_KEY = Deno.env.get("WEBINAR_ADS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Row = Record<string, any>;

const MILESTONES = [25, 50, 75, 95, 100];

// First day this webinar funnel ran ads; earlier spend belongs to other campaigns.
const FUNNEL_START = "2026-09-18";
const pct = (n: number, d: number) => (d ? +((n / d) * 100).toFixed(1) : 0);
const sum = (rows: Row[], k: string) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

async function fetchRegistrations() {
  const { data, error } = await admin
    .from("webinar_registrations")
    .select(
      "id, first_name, last_name, email, session_date_text, utm_source, utm_campaign, created_at, attended, attended_at, attendance_status, max_retention_pct, watch_seconds, watched_replay, offer_clicked, offer_click_context, needs_followup, followup_note",
    )
    .eq("is_test", false)
    .is("duplicate_of", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}


async function fetchRetentionEvents() {
  const { data, error } = await admin
    .from("webinar_retention_events")
    .select("email, milestone, watch_seconds, session_date_text, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function retentionBlock(regs: Row[], events: Row[]) {
  const attendees = regs.filter((r) => r.attended);
  const base = attendees.length;
  const reached = new Map<number, Set<string>>();
  for (const m of MILESTONES) reached.set(m, new Set());
  for (const e of events) {
    const m = Number(e.milestone);
    if (reached.has(m)) reached.get(m)!.add(String(e.email).toLowerCase());
  }
  // Someone at 75% necessarily passed 25 and 50 even if only the top ping arrived.
  for (const r of regs) {
    const top = Number(r.max_retention_pct) || 0;
    if (!top) continue;
    for (const m of MILESTONES) if (m <= top) reached.get(m)!.add(String(r.email).toLowerCase());
  }
  const watch = attendees.map((r) => Number(r.watch_seconds) || 0).filter((n) => n > 0);
  return {
    attendees: base,
    avg_watch_seconds: watch.length ? Math.round(watch.reduce((a, b) => a + b, 0) / watch.length) : null,
    funnel: MILESTONES.map((m) => {
      const n = reached.get(m)!.size;
      return { milestone: `${m}%`, attendees_reached: n, rate_pct: pct(n, base) };
    }),
    biggest_dropoff: (() => {
      let worst: { from: string; to: string; lost_pct: number } | null = null;
      for (let i = 1; i < MILESTONES.length; i++) {
        const a = reached.get(MILESTONES[i - 1])!.size;
        const b = reached.get(MILESTONES[i])!.size;
        const lost = pct(a - b, a || 1);
        if (!worst || lost > worst.lost_pct) {
          worst = { from: `${MILESTONES[i - 1]}%`, to: `${MILESTONES[i]}%`, lost_pct: lost };
        }
      }
      return worst;
    })(),
  };
}

async function fetchAds(sinceDate: string) {
  const windowStart = sinceDate > FUNNEL_START ? sinceDate : FUNNEL_START;
  const [{ data: windowRows }, { data: allRows }] = await Promise.all([
    admin.from("webinar_ad_snapshots").select("*").gte("snapshot_date", windowStart).order("snapshot_date"),
    admin.from("webinar_ad_snapshots").select("*").gte("snapshot_date", FUNNEL_START).order("snapshot_date"),
  ]);
  const w = windowRows ?? [];
  const a = allRows ?? [];
  const agg = (rows: Row[]) => {
    const spend = sum(rows, "spend");
    const clicks = sum(rows, "clicks");
    const impressions = sum(rows, "impressions");
    const leads = sum(rows, "leads");
    return {
      days: rows.length,
      spend: +spend.toFixed(2),
      impressions,
      clicks,
      leads,
      purchases: sum(rows, "purchases"),
      revenue: +sum(rows, "revenue").toFixed(2),
      ctr_pct: pct(clicks, impressions),
      cpc: clicks ? +(spend / clicks).toFixed(2) : 0,
      cpm: impressions ? +((spend / impressions) * 1000).toFixed(2) : 0,
      cost_per_lead: leads ? +(spend / leads).toFixed(2) : 0,
    };
  };
  const latest = a.length ? a[a.length - 1] : null;
  let liveSets: Row[] = [];
  if (latest) {
    const { data } = await admin
      .from("webinar_ad_entities")
      .select("name, level, spend, clicks, impressions, leads")
      .eq("snapshot_id", latest.id)
      .eq("level", "adset")
      .gt("spend", 0)
      .order("spend", { ascending: false });
    liveSets = data ?? [];
  }
  const liveSpend = sum(liveSets, "spend");
  const liveLeads = sum(liveSets, "leads");
  return {
    has_data: a.length > 0,
    first_spend_date: a[0]?.snapshot_date ?? null,
    last_push: latest ? { date: latest.snapshot_date, source: latest.source, updated_at: latest.updated_at } : null,
    window: agg(w),
    all_time: agg(a),
    live_configuration: {
      ad_sets: liveSets.length,
      spend: +liveSpend.toFixed(2),
      leads: liveLeads,
      cost_per_lead: liveLeads ? +(liveSpend / liveLeads).toFixed(2) : 0,
      top_ad_sets: liveSets.slice(0, 10).map((r) => ({
        name: r.name,
        spend: +(Number(r.spend) || 0).toFixed(2),
        leads: Number(r.leads) || 0,
        cost_per_lead: Number(r.leads) ? +((Number(r.spend) || 0) / Number(r.leads)).toFixed(2) : 0,
      })),
    },
  };
}

async function fetchPurchases(registrantEmails: Set<string>) {
  const { data } = await admin
    .from("webinar_funnel_purchases")
    .select("customer_label, customer_email, amount, interval, purchased_at")
    .order("purchased_at", { ascending: false });
  const rows = data ?? [];
  let collected = 0;
  let mrr = 0;
  let unmatchedCollected = 0;
  let unmatchedCount = 0;
  const purchases = rows.map((r) => {
    const amount = Number(r.amount) || 0;
    const monthly = r.interval === "monthly" ? amount : r.interval === "yearly" ? amount / 12 : 0;
    const matched = !!r.customer_email && registrantEmails.has(String(r.customer_email).toLowerCase());
    if (matched) {
      collected += amount;
      mrr += monthly;
    } else {
      unmatchedCollected += amount;
      unmatchedCount += 1;
    }
    return { ...r, matched_registrant: matched };
  });
  return {
    count: rows.length - unmatchedCount,
    collected_revenue: +collected.toFixed(2),
    mrr: +mrr.toFixed(2),
    unmatched_count: unmatchedCount,
    unmatched_collected_revenue: +unmatchedCollected.toFixed(2),
    purchases,
  };
}

const registrantOut = (r: Row) => ({
  name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
  email: r.email,
  session: r.session_date_text ?? null,
  source: r.utm_source ?? null,
  registered_at: r.created_at,
  attendance: r.attendance_status ?? (r.attended ? "attended" : "unknown"),
  attended: !!r.attended,
  attended_at: r.attended_at ?? null,
  watched_replay: !!r.watched_replay,
  max_retention_pct: Number(r.max_retention_pct) || 0,
  watch_seconds: r.watch_seconds ?? null,
  offer_clicked: !!r.offer_clicked,
  offer_click_context: r.offer_click_context ?? null,
  needs_followup: !!r.needs_followup,
  followup_note: r.followup_note ?? null,
});


const SCHEMA = {
  description:
    "AI overview: read-only pull of the /webinar-stats data — registrations, attendance, watch retention, ad spend and recorded revenue.",
  auth: "x-api-key: <WEBINAR_ADS_API_KEY>  (Authorization: Bearer <key> also works)",
  endpoint: `${SUPABASE_URL}/functions/v1/webinar-ai-overview`,
  routes: {
    "GET /": "full overview (?days=7, max 365)",
    "GET /registrants": "registrant list with attendance + retention",
    "GET /retention": "retention funnel only",
    "GET /ads": "ad spend aggregates only",
    "GET /schema": "this document",
  },
  counting_rules: [
    "Test registrations (is_test) are never counted.",
    "Duplicate signups are collapsed onto the original person, so each human counts once.",
    "Phone numbers are never returned.",
    "Revenue only counts purchases matched to a registrant email; anything unmatched is reported separately as unmatched_collected_revenue.",
    "Ad numbers come from whatever was pushed to webinar-ads-api.",
    "live_configuration covers only ad sets that spent money on the most recent reported day.",
    "Retention percentages are computed against attendees, and a higher milestone implies the lower ones.",
  ],

  companion_write_endpoint: `${SUPABASE_URL}/functions/v1/webinar-ingest`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!API_KEY) return json({ error: "WEBINAR_ADS_API_KEY is not configured" }, 500);

  const provided =
    req.headers.get("x-api-key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || !safeEqual(provided, API_KEY)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const route = "/" + url.pathname.replace(/^.*webinar-ai-overview\/?/, "").replace(/^\/+|\/+$/g, "");
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 7));
  const sinceDate = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  try {
    if (route === "/schema") return json(SCHEMA);
    if (route === "/ads") return json({ window_days: days, ads: await fetchAds(sinceDate) });

    const [regs, events] = await Promise.all([fetchRegistrations(), fetchRetentionEvents()]);

    if (route === "/registrants") {
      return json({ count: regs.length, registrants: regs.map(registrantOut) });
    }
    if (route === "/retention") {
      return json({ retention: retentionBlock(regs, events) });
    }
    if (route !== "/" && route !== "/overview") {
      return json({ error: `Unknown route ${route}. GET /schema for the route list.` }, 404);
    }

    const registrantEmails = new Set(
      regs.map((r) => String(r.email || "").toLowerCase()).filter(Boolean),
    );
    const [ads, purchases] = await Promise.all([
      fetchAds(sinceDate).catch(() => null),
      fetchPurchases(registrantEmails).catch(() => ({
        count: 0,
        collected_revenue: 0,
        mrr: 0,
        unmatched_count: 0,
        unmatched_collected_revenue: 0,
        purchases: [],
      })),
    ]);

    const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
    const windowRegs = regs.filter((r) => String(r.created_at) >= sinceIso);
    const attendedAll = regs.filter((r) => r.attended).length;
    const missedAll = regs.filter((r) => r.attendance_status === "missed").length;
    const followups = regs.filter((r) => r.needs_followup);
    const ret = retentionBlock(regs, events);

    return json({
      generated_at: new Date().toISOString(),
      window_days: days,
      headline: {
        registrants_all_time: regs.length,
        registrants_in_window: windowRegs.length,
        attended: attendedAll,
        missed: missedAll,
        replay_viewers: regs.filter((r) => r.watched_replay).length,
        offer_clicks: regs.filter((r) => r.offer_clicked).length,
        reached_95_pct: regs.filter((r) => (Number(r.max_retention_pct) || 0) >= 95).length,
        needs_followup: followups.length,
        unmarked: regs.length - attendedAll - missedAll,
        show_up_rate_pct: pct(attendedAll, attendedAll + missedAll),
        recorded_purchases: purchases.count,
        collected_revenue: purchases.collected_revenue,
        mrr: purchases.mrr,
        unmatched_purchases: purchases.unmatched_count,
        unmatched_collected_revenue: purchases.unmatched_collected_revenue,
        ad_spend_all_time: ads?.all_time.spend ?? 0,
        cost_per_registrant: regs.length && ads ? +(ads.all_time.spend / regs.length).toFixed(2) : 0,
      },
      retention: ret,
      ads,
      revenue: purchases,
      followups: followups.map(registrantOut),
      registrants: regs.slice(0, 500).map(registrantOut),

      counting_rules: SCHEMA.counting_rules,
    });
  } catch (e) {
    console.error("webinar-ai-overview", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
