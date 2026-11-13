import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * Read-only "everything on /admin" API for external platforms.
 *
 * Auth: header `x-api-key: <ADMIN_DATA_API_KEY>` (or `Authorization: Bearer <ADMIN_DATA_API_KEY>`)
 * All routes are GET. See GET /schema.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("ADMIN_DATA_API_KEY") ?? "";
const PAGE_KEY = Deno.env.get("PAGE_ANALYTICS_API_KEY") ?? "";
const USER_360_KEY = Deno.env.get("USER_360_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

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

async function pageAll(table: string, cols: string, tweak?: (q: any) => any, maxPages = 20) {
  const out: Record<string, any>[] = [];
  for (let p = 0; p < maxPages; p++) {
    let q = admin.from(table).select(cols).range(p * 1000, p * 1000 + 999);
    if (tweak) q = tweak(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function callFn(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      "x-api-key": name === "user-360" ? USER_360_KEY : API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, data: { error: text.slice(0, 500) } };
  }
}

async function proxyAnalytics(route: string, search: string) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/page-analytics-api/${route}${search}`,
    { headers: { Authorization: `Bearer ${PAGE_KEY}`, apikey: SERVICE_ROLE } },
  );
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

const USER_COLS =
  "email, full_name, plan, approval, billing_state, created_at, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, login_count, last_login_at, last_accessed, install_confirmed_at, onboarding_completed, onboarding_completed_at, initial_questions_completed, max_onboarding_users, onboarding_call_wallet, agency_support_wallet, branding_tool_access, email_warmup_access, free_leads_access, custom_domain_live, client_hub_enabled, knowledge_base_enabled, support_ticketing_enabled, is_affiliate, affiliate_slug, utm_source, utm_medium, utm_campaign, source, landing_page, referrer, payment_failure_count, videos_watched_count, ai_questions_count, tickets_opened_count";

async function usersPayload(limit: number | null) {
  const rows = await pageAll("saas_suite_users", USER_COLS, (q) =>
    q.order("created_at", { ascending: false }),
  );
  const list = limit ? rows.slice(0, limit) : rows;
  const byPlan: Record<string, number> = {};
  for (const u of rows) byPlan[String(u.plan ?? "UNKNOWN")] = (byPlan[String(u.plan ?? "UNKNOWN")] || 0) + 1;
  const day = 86400_000;
  const sinceCount = (d: number) =>
    rows.filter((u) => new Date(String(u.created_at)).getTime() > Date.now() - d * day).length;
  return {
    totals: {
      users: rows.length,
      by_plan: byPlan,
      approved: rows.filter((u) => String(u.approval).toUpperCase() === "YES").length,
      blocked: rows.filter((u) => String(u.approval).toUpperCase() === "NO").length,
      install_confirmed: rows.filter((u) => u.install_confirmed_at).length,
      onboarding_completed: rows.filter((u) => u.onboarding_completed).length,
      signups_24h: sinceCount(1),
      signups_7d: sinceCount(7),
      signups_30d: sinceCount(30),
    },
    returned: list.length,
    users: list,
  };
}

async function supportPayload(days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const tickets = await pageAll(
    "support_tickets",
    "id, agency_id, customer_email, customer_name, subject, status, priority, created_at, updated_at, last_reply_at",
    (q) => q.gte("created_at", since).order("created_at", { ascending: false }),
    5,
  );
  const threads = await pageAll(
    "chat_threads",
    "id, agency_id, visitor_email, visitor_name, status, handover_requested, created_at, updated_at, message_count",
    (q) => q.gte("created_at", since).order("created_at", { ascending: false }),
    3,
  ).catch(() => []);
  const byStatus: Record<string, number> = {};
  for (const t of tickets) byStatus[String(t.status ?? "unknown")] = (byStatus[String(t.status ?? "unknown")] || 0) + 1;
  return {
    window_days: days,
    tickets: { total: tickets.length, by_status: byStatus, rows: tickets },
    ai_chat_threads: { total: threads.length, rows: threads },
  };
}

async function fulfillmentPayload() {
  const [warmup, leads, calls] = await Promise.all([
    admin
      .from("email_warmup_requests")
      .select("user_email, agency_name, sender_email, warmed_domain, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("free_leads")
      .select("user_email, business_keywords, city, country, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("onboarding_calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  return {
    email_warmup: {
      pending: (warmup.data ?? []).filter((r: any) => r.status === "pending").length,
      rows: warmup.data ?? [],
    },
    free_leads: {
      pending: (leads.data ?? []).filter((r: any) => r.status === "pending").length,
      rows: leads.data ?? [],
    },
    onboarding_calls: { rows: calls.data ?? [] },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!API_KEY) return json({ error: "ADMIN_DATA_API_KEY is not configured" }, 500);

  const provided =
    req.headers.get("x-api-key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || !safeEqual(provided, API_KEY)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const route =
    "/" + url.pathname.replace(/^.*admin-data-api\/?/, "").replace(/^\/+|\/+$/g, "");
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(5000, Math.max(1, Number(limitParam))) : null;
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  try {
    if (route.startsWith("/analytics")) {
      const sub = route.replace(/^\/analytics\/?/, "") || "overview";
      return json(await proxyAnalytics(sub, url.search));
    }

    switch (route) {
      case "/":
      case "/schema":
        return json({
          description:
            "Read-only mirror of the SaaSSuite /admin dashboard: users, revenue & churn, signup funnel, support, fulfillment queues and site analytics.",
          auth: "x-api-key: <ADMIN_DATA_API_KEY> (Authorization: Bearer <key> also works)",
          base_url: `${SUPABASE_URL}/functions/v1/admin-data-api`,
          endpoints: [
            { path: "/everything", params: ["days"], returns: "one payload with every section below (heaviest call, ~10-30s)" },
            { path: "/users", params: ["limit"], returns: "all SaaSSuite accounts + plan/approval/install/onboarding totals" },
            { path: "/user", params: ["email (required)"], returns: "full 360 profile for one user" },
            { path: "/revenue", params: [], returns: "Stripe MRR, churn, LTV, cohorts, per-customer revenue" },
            { path: "/signups", params: ["days"], returns: "signup funnel by source and landing page, daily series" },
            { path: "/support", params: ["days"], returns: "tickets + AI chat threads with status breakdown" },
            { path: "/fulfillment", params: [], returns: "email warmup, free leads and onboarding call queues" },
            { path: "/analytics/<route>", params: ["days", "path", "limit", "include_app"], returns: "page analytics: overview, pages, page, timeseries, attribution, sessions, heatmap, video-retention, plans, schema" },
          ],
          notes: [
            "Everything is GET and read-only; no route can write data.",
            "days defaults to 30 (max 365). /users returns all rows unless you pass limit.",
            "Rotate the key any time in Lovable project secrets; old key stops working immediately.",
          ],
        });

      case "/users":
        return json(await usersPayload(limit));

      case "/user": {
        if (!email) return json({ error: "email query param is required" }, 400);
        const r = await callFn("user-360", { email, limit: 200 });
        return json(r.data, r.ok ? 200 : r.status);
      }

      case "/revenue": {
        const r = await callFn("revenue-analytics", { action: "metrics" });
        return json(r.data, r.ok ? 200 : r.status);
      }

      case "/signups": {
        const r = await callFn("signup-stats", { days });
        return json(r.data, r.ok ? 200 : r.status);
      }

      case "/support":
        return json(await supportPayload(days));

      case "/fulfillment":
        return json(await fulfillmentPayload());

      case "/everything": {
        const [users, revenue, signups, support, fulfillment, analytics] = await Promise.all([
          usersPayload(limit).catch((e) => ({ error: String(e) })),
          callFn("revenue-analytics", { action: "metrics" }).then((r) => r.data).catch((e) => ({ error: String(e) })),
          callFn("signup-stats", { days }).then((r) => r.data).catch((e) => ({ error: String(e) })),
          supportPayload(days).catch((e) => ({ error: String(e) })),
          fulfillmentPayload().catch((e) => ({ error: String(e) })),
          proxyAnalytics("overview", `?days=${days}`).catch((e) => ({ error: String(e) })),
        ]);
        return json({
          generated_at: new Date().toISOString(),
          window_days: days,
          users,
          revenue,
          signups,
          support,
          fulfillment,
          analytics_overview: analytics,
        });
      }

      default:
        return json({ error: `Unknown route ${route}. GET /schema for the endpoint list.` }, 404);
    }
  } catch (e) {
    console.error("admin-data-api error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
