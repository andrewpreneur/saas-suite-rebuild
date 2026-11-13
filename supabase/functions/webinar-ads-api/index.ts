import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Ad-spend ingest for the /webinar + /special funnel ONLY.
 *
 * Auth: header `x-api-key: <WEBINAR_ADS_API_KEY>` (or `Authorization: Bearer <key>`)
 *
 * GET  /                -> schema + example payload
 * GET  /latest          -> the most recent snapshot with its breakdowns
 * POST /                -> upsert one daily snapshot (totals + campaigns/ad sets/creatives)
 * POST /  {delete:true, date, source} -> remove a snapshot
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

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const int = (v: unknown) => Math.round(num(v));
const nullable = (v: unknown) => (v === undefined || v === null || v === "" ? null : num(v));

/** Fill in ctr/cpc/cpm/cpl/roas when the caller did not send them. */
function derive(row: Record<string, any>) {
  const spend = num(row.spend);
  const clicks = int(row.clicks);
  const impressions = int(row.impressions);
  const leads = int(row.leads ?? row.registrations);
  const revenue = num(row.revenue);
  return {
    ctr: nullable(row.ctr) ?? (impressions ? +((clicks / impressions) * 100).toFixed(2) : null),
    cpc: nullable(row.cpc) ?? (clicks ? +(spend / clicks).toFixed(2) : null),
    cpm: nullable(row.cpm) ?? (impressions ? +((spend / impressions) * 1000).toFixed(2) : null),
    cpl: nullable(row.cpl ?? row.cost_per_lead) ?? (leads ? +(spend / leads).toFixed(2) : null),
    roas: nullable(row.roas) ?? (spend ? +(revenue / spend).toFixed(2) : null),
  };
}

function entityRows(snapshotId: string, body: Record<string, any>) {
  const groups: [string, any[]][] = [
    ["campaign", body.campaigns ?? []],
    ["adset", body.ad_sets ?? body.adsets ?? []],
    ["creative", body.creatives ?? body.ads ?? []],
  ];
  const rows: Record<string, any>[] = [];
  for (const [level, list] of groups) {
    for (const raw of Array.isArray(list) ? list : []) {
      const name = String(raw?.name ?? raw?.campaign_name ?? raw?.adset_name ?? "").trim();
      if (!name) continue;
      const d = derive(raw);
      rows.push({
        snapshot_id: snapshotId,
        level,
        name,
        campaign_name: raw.campaign_name ?? null,
        adset_name: raw.adset_name ?? null,
        status: raw.status ?? null,
        spend: num(raw.spend),
        impressions: int(raw.impressions),
        clicks: int(raw.clicks),
        leads: int(raw.leads),
        registrations: int(raw.registrations),
        purchases: int(raw.purchases),
        revenue: num(raw.revenue),
        thumbnail_url: raw.thumbnail_url ?? raw.image_url ?? null,
        ...d,
      });
    }
  }
  return rows;
}

const SCHEMA = {
  description:
    "Push Meta (or any platform) ad performance for the /webinar and /special funnel. Data shows up on /webinar-stats. Send totals-to-date or per-day figures once a day, or whenever you like.",
  auth: "x-api-key: <WEBINAR_ADS_API_KEY>  (Authorization: Bearer <key> also works)",
  endpoint: `${SUPABASE_URL}/functions/v1/webinar-ads-api`,
  routes: {
    "GET /": "this schema",
    "GET /latest": "most recent snapshot + breakdowns",
    "POST /": "upsert a snapshot (unique per date + source)",
    "POST / {delete:true,date,source}": "delete a snapshot",
  },
  example_payload: {
    date: "2026-09-17",
    source: "meta",
    notes: "manual push",
    totals: {
      spend: 1240.55,
      impressions: 184320,
      reach: 121004,
      clicks: 3120,
      leads: 214,
      registrations: 198,
      purchases: 11,
      revenue: 3267,
      ctr: 1.69,
      cpc: 0.4,
      roas: 2.63,
    },
    campaigns: [{ name: "Webinar - Cold - US", spend: 900, impressions: 120000, clicks: 2100, leads: 150, purchases: 8, revenue: 2400, status: "ACTIVE" }],
    ad_sets: [{ name: "Broad 25-55", campaign_name: "Webinar - Cold - US", spend: 500, clicks: 1200, leads: 80, purchases: 4, revenue: 1200 }],
    creatives: [{ name: "VSL Hook A", campaign_name: "Webinar - Cold - US", adset_name: "Broad 25-55", spend: 300, impressions: 40000, clicks: 700, leads: 40, purchases: 3, revenue: 900, thumbnail_url: "https://..." }],
  },
  notes: [
    "Any metric you omit (ctr, cpc, cpm, cpl, roas) is calculated from spend/clicks/impressions/leads/revenue.",
    "Re-posting the same date + source replaces that day's numbers and its breakdowns.",
    "Only totals is required; campaigns / ad_sets / creatives are optional arrays.",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!API_KEY) return json({ error: "WEBINAR_ADS_API_KEY is not configured" }, 500);

  const provided =
    req.headers.get("x-api-key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || !safeEqual(provided, API_KEY)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const route = "/" + url.pathname.replace(/^.*webinar-ads-api\/?/, "").replace(/^\/+|\/+$/g, "");

  try {
    if (req.method === "GET") {
      if (route === "/latest") {
        const { data: snap } = await admin
          .from("webinar_ad_snapshots")
          .select("*")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!snap) return json({ snapshot: null, entities: [] });
        const { data: ents } = await admin
          .from("webinar_ad_entities")
          .select("*")
          .eq("snapshot_id", snap.id)
          .order("spend", { ascending: false });
        return json({ snapshot: snap, entities: ents ?? [] });
      }
      return json(SCHEMA);
    }

    if (req.method !== "POST") return json({ error: "Use GET or POST" }, 405);

    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const source = String(body?.source || "meta").toLowerCase().trim() || "meta";

    if (body?.delete === true) {
      const { error } = await admin
        .from("webinar_ad_snapshots")
        .delete()
        .eq("snapshot_date", date)
        .eq("source", source);
      if (error) throw new Error(error.message);
      return json({ ok: true, deleted: { date, source } });
    }

    const totals = body?.totals ?? body?.overall ?? body ?? {};
    const d = derive(totals);
    const payload = {
      snapshot_date: date,
      source,
      spend: num(totals.spend),
      impressions: int(totals.impressions),
      reach: int(totals.reach),
      clicks: int(totals.clicks),
      leads: int(totals.leads),
      registrations: int(totals.registrations),
      purchases: int(totals.purchases),
      revenue: num(totals.revenue),
      notes: body?.notes ?? null,
      raw: body ?? null,
      updated_at: new Date().toISOString(),
      ...d,
    };

    const { data: snap, error } = await admin
      .from("webinar_ad_snapshots")
      .upsert(payload, { onConflict: "snapshot_date,source" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await admin.from("webinar_ad_entities").delete().eq("snapshot_id", snap.id);
    const rows = entityRows(snap.id, body ?? {});
    if (rows.length) {
      const { error: e2 } = await admin.from("webinar_ad_entities").insert(rows);
      if (e2) throw new Error(e2.message);
    }

    return json({
      ok: true,
      snapshot_id: snap.id,
      date,
      source,
      breakdown_rows: rows.length,
      stored_metrics: payload,
    });
  } catch (e) {
    console.error("webinar-ads-api", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
