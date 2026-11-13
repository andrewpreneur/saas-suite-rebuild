import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Affiliates (GHL signups under us) get free lifetime access — imputed monthly-equivalent value. */
const AFFILIATE_IMPUTED_VALUE = 67;

/** Only SaaSSuite-branded Stripe products count as platform subscriptions. */
function isSaasSuiteProduct(name: string) {
  const n = (name || "").toLowerCase().replace(/[^a-z]/g, "");
  return n.includes("saassuite") || n.includes("saasuite") || /(^|[^a-z])ss([^a-z]|$)/.test((name || "").toLowerCase());
}

type Row = Record<string, any>;

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const pct = (part: number, total: number) => (total ? round((part / total) * 100, 1) : 0);
const days = (from?: number | null, to?: number | null) =>
  from && to ? Math.max(0, Math.round((to - from) / 86400)) : 0;

async function loadUsers(supabase: any) {
  const cols =
    "email, full_name, plan, approval, created_at, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite, is_affiliate, affiliate_slug, login_count, last_login_at, last_accessed, install_confirmed_at, dynamic_installation, generated_css, primary_color, secondary_color, initial_questions_completed, onboarding_completed, onboarding_skipped, videos_watched_count, total_watch_time_seconds, ai_questions_count, tickets_opened_count, client_hub_enabled, knowledge_base_enabled, support_ticketing_enabled, tips_bot_enabled, custom_domain_live, branding_tool_access, email_warmup_access, free_leads_access, onboarding_call_wallet, agency_support_wallet, active_subaccounts, highlevel_experience, utm_source, landing_page, source, last_device, weekly_login_count, payment_failure_count";
  const out: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("saas_suite_users")
      .select(cols)
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Every onboarding user (owner + their customers) that has ever loaded a client hub. */
async function loadAgencyHubUsers(supabase: any) {
  const out: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("user_progress")
      .select("email, agency_id, last_accessed, created_at")
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Raw activity sessions (first-party behavioural tracking). */
async function loadActivitySessions(supabase: any) {
  const out: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("user_activity_sessions")
      .select("user_email, session_started_at, session_ended_at, status")
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function buildStripeData(stripe: Stripe) {
  // Products → SaaSSuite filter
  const products = await stripe.products.list({ limit: 100, active: undefined as any }).autoPagingToArray({ limit: 500 });
  const productName = new Map<string, string>();
  products.forEach((p: Stripe.Product) => productName.set(p.id, p.name || ""));

  const subs = await stripe.subscriptions
    .list({ status: "all", limit: 100, expand: ["data.customer"] })
    .autoPagingToArray({ limit: 2000 });

  // Invoice expansion lets us tell SaaSSuite charges apart from every other product.
  // Restricted keys may lack invoice-read permissions — fall back to plain charges.
  let charges: any[];
  try {
    charges = await stripe.charges
      .list({ limit: 100, expand: ["data.invoice"] })
      .autoPagingToArray({ limit: 5000 });
  } catch (e) {
    console.warn("[revenue-analytics] invoice expand unavailable, retrying without it:", e instanceof Error ? e.message : e);
    charges = await stripe.charges.list({ limit: 100 }).autoPagingToArray({ limit: 5000 });
  }

  return { productName, subs, charges };
}


function planFromProduct(name: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("advanced") || n.includes("pro") || n.includes("elite") || n.includes("enhanced")) return "ADVANCED";
  if (n.includes("basic")) return "BASIC";
  if (n.includes("lite") || n.includes("starter")) return "STARTER";
  return "OTHER";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ---- admin only (admin session OR machine key) ----
  const machineKey = Deno.env.get("ADMIN_DATA_API_KEY") || "";
  const providedKey = req.headers.get("x-api-key") || "";
  if (!(machineKey && providedKey && providedKey === machineKey)) {
    try {
      const auth = req.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);
      const { data } = await supabase.auth.getUser(auth.slice(7));
      const email = data.user?.email?.trim().toLowerCase();
      if (!email) return json({ error: "Invalid session" }, 401);
      if (!isPlatformAdminEmail(email)) return json({ error: "Admin only" }, 403);
    } catch {
      return json({ error: "Auth failed" }, 401);
    }
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const action = body?.action ?? "metrics";

  try {
    if (action === "ask") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
      const question = String(body?.question ?? "").slice(0, 4000);
      const context = JSON.stringify(body?.context ?? {}).slice(0, 120_000);
      const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are SaaSSuite's revenue and retention analyst. You are given a JSON snapshot of Stripe subscription revenue, churn, LTV, plan segments and product-usage signals for a HighLevel white-label SaaS. "+
                "The snapshot may be scoped to a date range (see `dateRange`) and includes `monthlyTimeline` (per-month new/churned customers, churn rate, net revenue, ARPU) and `signupCohorts` (per-join-month retention and LTV), plus all-time equivalents. When the question is about trends, compare periods and cohorts explicitly and call out which months improved or worsened. " +
                "Answer with concrete numbers pulled from the JSON, name the strongest predictors, and be blunt about small sample sizes. " +
                "`revenueScope` tells you whether figures are SaaSSuite-only or all products. `signalComparison` counts how many churned vs active customers have each condition (menu link installed, branding pushed to their SaaSSuite, users on their agency id, etc.) — use those counts, not just percentages. `hubUserBuckets` splits customers by how many onboarding users exist on their agency id: 0 = nobody ever logged into their hub, 1 = only the owner, 2+ = they have real customers. " +

                "Affiliate users have no Stripe subscription: they got free lifetime access for signing up to HighLevel under us and their value is imputed at $" +
                AFFILIATE_IMPUTED_VALUE +
                "/mo-equivalent. Use short markdown with bullets and tables. Never invent numbers that are not derivable from the JSON.\n\nDATA:\n" +
                context,
            },
            ...history.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") })),
            { role: "user", content: question },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return json({ error: `AI gateway ${res.status}: ${text.slice(0, 400)}` }, res.status);
      }
      const out = await res.json();
      return json({ content: out?.choices?.[0]?.message?.content ?? "" });
    }

    // ---------------- metrics ----------------
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY is not set" }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const [users, hubUsers, sessions, sd] = await Promise.all([
      loadUsers(supabase),
      loadAgencyHubUsers(supabase),
      loadActivitySessions(supabase),
      buildStripeData(stripe),
    ]);
    const { productName, subs, charges } = sd;

    // Customers who hold (or held) a SaaSSuite subscription — used to attribute
    // charges we can't resolve to a product.
    const saasCustomerIds = new Set<string>();
    for (const s of subs as any[]) {
      const names = (s.items?.data ?? []).map(
        (i: any) => productName.get(typeof i.price?.product === "string" ? i.price.product : i.price?.product?.id ?? "") ?? "",
      );
      if (!names.some(isSaasSuiteProduct)) continue;
      const cid = typeof s.customer === "string" ? s.customer : s.customer?.id;
      if (cid) saasCustomerIds.add(cid);
    }

    /** Is this charge for a SaaSSuite product (vs. a different product we sell)? */
    const chargeIsSaas = (c: any) => {
      const inv: any = typeof c.invoice === "object" && c.invoice ? c.invoice : null;
      const names: string[] = [];
      for (const li of inv?.lines?.data ?? []) {
        const pid = typeof li.price?.product === "string" ? li.price.product : li.price?.product?.id;
        if (pid) names.push(productName.get(pid) ?? "");
        if (li.description) names.push(String(li.description));
      }
      if (names.length) return names.some(isSaasSuiteProduct);
      const desc = `${c.description ?? ""} ${c.statement_descriptor ?? ""}`;
      if (isSaasSuiteProduct(desc)) return true;
      // Unresolvable (one-off payment links etc.): attribute to SaaSSuite only if
      // the customer is a SaaSSuite subscriber.
      const cust = typeof c.customer === "string" ? c.customer : c.customer?.id;
      return !!cust && saasCustomerIds.has(cust);
    };

    // ---- net revenue per customer + monthly revenue series ----
    const netByCustomer = new Map<string, number>();
    const netByCustomerSaas = new Map<string, number>();
    const firstCharge = new Map<string, number>();
    const lastCharge = new Map<string, number>();
    const chargeCount = new Map<string, number>();
    const chargeCountSaas = new Map<string, number>();
    const monthly = new Map<
      string,
      { revenue: number; refunds: number; charges: number; revenueSaas: number; refundsSaas: number; chargesSaas: number }
    >();

    for (const c of charges) {
      if (c.status !== "succeeded") continue;
      const cust = typeof c.customer === "string" ? c.customer : c.customer?.id;
      if (!cust) continue;
      const isSaas = chargeIsSaas(c);
      const net = (c.amount - (c.amount_refunded ?? 0)) / 100;
      netByCustomer.set(cust, round((netByCustomer.get(cust) ?? 0) + net));
      chargeCount.set(cust, (chargeCount.get(cust) ?? 0) + 1);
      if (isSaas) {
        netByCustomerSaas.set(cust, round((netByCustomerSaas.get(cust) ?? 0) + net));
        chargeCountSaas.set(cust, (chargeCountSaas.get(cust) ?? 0) + 1);
      }
      if (!firstCharge.has(cust) || c.created < firstCharge.get(cust)!) firstCharge.set(cust, c.created);
      if (!lastCharge.has(cust) || c.created > lastCharge.get(cust)!) lastCharge.set(cust, c.created);
      const key = new Date(c.created * 1000).toISOString().slice(0, 7);
      const m = monthly.get(key) ?? { revenue: 0, refunds: 0, charges: 0, revenueSaas: 0, refundsSaas: 0, chargesSaas: 0 };
      m.revenue = round(m.revenue + c.amount / 100);
      m.refunds = round(m.refunds + (c.amount_refunded ?? 0) / 100);
      m.charges += 1;
      if (isSaas) {
        m.revenueSaas = round(m.revenueSaas + c.amount / 100);
        m.refundsSaas = round(m.refundsSaas + (c.amount_refunded ?? 0) / 100);
        m.chargesSaas += 1;
      }
      monthly.set(key, m);
    }

    // ---- onboarding users under each owner's agency id(s) ----
    const hubUsersByAgency = new Map<string, Row[]>();
    for (const h of hubUsers) {
      const id = h.agency_id ? String(h.agency_id) : "";
      if (!id) continue;
      const list = hubUsersByAgency.get(id) ?? [];
      list.push(h);
      hubUsersByAgency.set(id, list);
    }

    const sessionsByEmail = new Map<string, Row[]>();
    for (const sx of sessions) {
      const e = sx.user_email ? String(sx.user_email).trim().toLowerCase() : "";
      if (!e) continue;
      const list = sessionsByEmail.get(e) ?? [];
      list.push(sx);
      sessionsByEmail.set(e, list);
    }

    /** Owner-level rollup of onboarding users + tracked sessions. */
    const activityFor = (u?: Row) => {
      const ids = [
        u?.agency_id,
        u?.agency_id_basic,
        u?.agency_id_advanced,
        u?.agency_id_elite,
        u?.original_agency_id,
        u?.original_agency_id_basic,
        u?.original_agency_id_advanced,
        u?.original_agency_id_elite,
      ].filter(Boolean) as string[];
      const seen = new Map<string, Row>();
      for (const id of new Set(ids)) {
        for (const h of hubUsersByAgency.get(id) ?? []) {
          const key = String(h.email ?? "").trim().toLowerCase() || `${id}:${h.created_at}`;
          if (!seen.has(key)) seen.set(key, h);
        }
      }
      const rows = [...seen.values()];
      const ownerEmail = String(u?.email ?? "").trim().toLowerCase();
      const clientRows = rows.filter((r) => String(r.email ?? "").trim().toLowerCase() !== ownerEmail);
      const cutoff = Date.now() - 30 * 86400000;
      const recent = rows.filter((r) => r.last_accessed && new Date(r.last_accessed).getTime() >= cutoff);
      const sess = ownerEmail ? sessionsByEmail.get(ownerEmail) ?? [] : [];
      const lastSession = sess
        .map((x) => (x.session_started_at ? new Date(x.session_started_at).getTime() : 0))
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        agencyIds: [...new Set(ids)],
        hubUsers: rows.length,
        clientUsers: clientRows.length,
        activeHubUsers30d: recent.length,
        sessionCount: sess.length,
        lastSessionAt: lastSession ? new Date(lastSession).toISOString() : null,
      };
    };


    // ---- customers with a SaaSSuite subscription ----
    type Cust = {
      customerId: string;
      email: string | null;
      name: string | null;
      products: string[];
      plan: string;
      status: string; // active | trialing | past_due | canceled
      churned: boolean;
      startedAt: number | null;
      endedAt: number | null;
      mrr: number;
    };
    const custMap = new Map<string, Cust>();

    for (const s of subs as any[]) {
      const items = s.items?.data ?? [];
      const names = items
        .map((i: any) => productName.get(typeof i.price?.product === "string" ? i.price.product : i.price?.product?.id ?? "") ?? "")
        .filter(Boolean);
      if (!names.some(isSaasSuiteProduct)) continue;

      const customer: any = s.customer;
      const cid = typeof customer === "string" ? customer : customer?.id;
      if (!cid) continue;
      const email = (typeof customer === "object" ? customer?.email : null)?.trim()?.toLowerCase() ?? null;
      const mrr = items.reduce((sum: number, i: any) => {
        const amt = (i.price?.unit_amount ?? 0) * (i.quantity ?? 1) / 100;
        const interval = i.price?.recurring?.interval;
        const count = i.price?.recurring?.interval_count ?? 1;
        if (interval === "year") return sum + amt / (12 * count);
        if (interval === "week") return sum + (amt * 52) / (12 * count);
        return sum + amt / count;
      }, 0);

      const prev = custMap.get(cid);
      const churned = s.status === "canceled" || s.status === "incomplete_expired";
      const cand: Cust = {
        customerId: cid,
        email,
        name: (typeof customer === "object" ? customer?.name : null) ?? null,
        products: names,
        plan: planFromProduct(names.join(" ")),
        status: s.status,
        churned,
        startedAt: s.start_date ?? s.created ?? null,
        endedAt: s.ended_at ?? s.canceled_at ?? null,
        mrr: round(mrr),
      };
      // Prefer a live subscription over a canceled one for the same customer.
      if (!prev || (prev.churned && !churned)) custMap.set(cid, cand);
      else if (prev && !prev.churned && !churned) {
        prev.mrr = round(prev.mrr + cand.mrr);
        prev.products = [...new Set([...prev.products, ...cand.products])];
      } else if (prev && prev.churned && churned) {
        prev.startedAt = Math.min(prev.startedAt ?? cand.startedAt ?? 0, cand.startedAt ?? prev.startedAt ?? 0) || null;
        prev.endedAt = Math.max(prev.endedAt ?? 0, cand.endedAt ?? 0) || null;
      }
    }

    const usersByEmail = new Map<string, Row>();
    users.forEach((u) => u.email && usersByEmail.set(String(u.email).trim().toLowerCase(), u));

    const nowSec = Math.floor(Date.now() / 1000);
    const SIGNALS: { key: string; label: string; kind: "bool" | "num" }[] = [
      { key: "menu_link_installed", label: "We have the menu link (install confirmed)", kind: "bool" },
      { key: "dynamic_installation", label: "Dynamic install / CSS delivery on", kind: "bool" },
      { key: "branding_pushed", label: "Branding pushed to their SaaSSuite", kind: "bool" },
      { key: "brand_colors_set", label: "Brand colors customised", kind: "bool" },
      { key: "has_hub_users", label: "≥1 user on their agency id", kind: "bool" },
      { key: "has_client_users", label: "Has customers (2+ users on agency id)", kind: "bool" },
      { key: "zero_hub_users", label: "Zero users on their agency id", kind: "bool" },
      { key: "install_confirmed", label: "Confirmed GHL install", kind: "bool" },
      { key: "initial_questions_completed", label: "Completed initial questions", kind: "bool" },
      { key: "onboarding_completed", label: "Completed onboarding", kind: "bool" },
      { key: "client_hub_enabled", label: "Client hub enabled", kind: "bool" },
      { key: "knowledge_base_enabled", label: "Knowledge base enabled", kind: "bool" },
      { key: "support_ticketing_enabled", label: "Support ticketing enabled", kind: "bool" },
      { key: "custom_domain_live", label: "Custom domain live", kind: "bool" },
      { key: "branding_tool_access", label: "Bought branding tool", kind: "bool" },
      { key: "has_agency_name", label: "Set agency name", kind: "bool" },
      { key: "used_ai", label: "Used AI chat", kind: "bool" },
      { key: "watched_video", label: "Watched ≥1 video", kind: "bool" },
      { key: "opened_ticket", label: "Opened a support ticket", kind: "bool" },
      { key: "tracked_session", label: "Has tracked activity session", kind: "bool" },
      { key: "hub_users", label: "Users on agency id", kind: "num" },
      { key: "client_users", label: "Customer users (excl. owner)", kind: "num" },
      { key: "active_hub_users_30d", label: "Users active in last 30d", kind: "num" },
      { key: "session_count", label: "Tracked activity sessions", kind: "num" },
      { key: "login_count", label: "Logins", kind: "num" },
      { key: "videos_watched_count", label: "Videos watched", kind: "num" },
      { key: "watch_minutes", label: "Watch minutes", kind: "num" },
      { key: "ai_questions_count", label: "AI questions", kind: "num" },
      { key: "days_to_last_login", label: "Days since last login", kind: "num" },
      { key: "payment_failure_count", label: "Payment failures", kind: "num" },
    ];

    const signalsFor = (u?: Row) => {
      const watchMin = round((u?.total_watch_time_seconds ?? 0) / 60, 1);
      const lastLogin = u?.last_login_at ?? u?.last_accessed;
      const act = activityFor(u);
      return {
        menu_link_installed: !!u?.install_confirmed_at,
        dynamic_installation: !!u?.dynamic_installation,
        branding_pushed: !!(u?.generated_css && String(u.generated_css).trim().length > 20),
        brand_colors_set: !!(u?.primary_color || u?.secondary_color),
        has_hub_users: act.hubUsers >= 1,
        has_client_users: act.hubUsers > 1,
        zero_hub_users: act.hubUsers === 0,
        install_confirmed: !!u?.install_confirmed_at,
        initial_questions_completed: !!u?.initial_questions_completed,
        onboarding_completed: !!u?.onboarding_completed,
        client_hub_enabled: !!u?.client_hub_enabled,
        knowledge_base_enabled: !!u?.knowledge_base_enabled,
        support_ticketing_enabled: !!u?.support_ticketing_enabled,
        custom_domain_live: !!u?.custom_domain_live,
        branding_tool_access: !!u?.branding_tool_access,
        has_agency_name: !!u?.agency_name,
        used_ai: (u?.ai_questions_count ?? 0) > 0,
        watched_video: (u?.videos_watched_count ?? 0) > 0,
        opened_ticket: (u?.tickets_opened_count ?? 0) > 0,
        tracked_session: act.sessionCount > 0,
        hub_users: act.hubUsers,
        client_users: act.clientUsers,
        active_hub_users_30d: act.activeHubUsers30d,
        session_count: act.sessionCount,
        login_count: u?.login_count ?? 0,
        videos_watched_count: u?.videos_watched_count ?? 0,
        watch_minutes: watchMin,
        ai_questions_count: u?.ai_questions_count ?? 0,
        days_to_last_login: lastLogin ? Math.round((Date.now() - new Date(lastLogin).getTime()) / 86400000) : 999,
        payment_failure_count: u?.payment_failure_count ?? 0,
      };
    };

    const buildRecord = (c: Cust) => {
      const u = c.email ? usersByEmail.get(c.email) : undefined;
      const ltv = netByCustomer.get(c.customerId) ?? 0;
      const ltvSaas = netByCustomerSaas.get(c.customerId) ?? 0;
      const start = c.startedAt ?? firstCharge.get(c.customerId) ?? null;
      const end = c.churned ? c.endedAt ?? lastCharge.get(c.customerId) ?? nowSec : nowSec;
      const tenure = days(start, end);
      const act = activityFor(u);
      return {
        segment: c.churned ? "churned" : "active",
        email: c.email,
        name: c.name ?? u?.full_name ?? null,
        appPlan: u?.plan ?? null,
        stripePlan: c.plan,
        products: c.products,
        status: c.status,
        ltv: round(ltv),
        ltvSaas: round(ltvSaas),
        ltvOther: round(ltv - ltvSaas),
        mrr: c.mrr,
        payments: chargeCount.get(c.customerId) ?? 0,
        paymentsSaas: chargeCountSaas.get(c.customerId) ?? 0,
        startedAt: start ? new Date(start * 1000).toISOString() : null,
        endedAt: c.churned && end ? new Date(end * 1000).toISOString() : null,
        tenureDays: tenure,
        tenureMonths: round(tenure / 30.44, 1),
        hasAccount: !!u,
        approval: u?.approval ?? null,
        agencyId: u?.agency_id ?? null,
        hubUsers: act.hubUsers,
        clientUsers: act.clientUsers,
        activitySessions: act.sessionCount,
        lastActivityAt: act.lastSessionAt,
        signals: signalsFor(u),
      };
    };


    const subscribers = [...custMap.values()].map(buildRecord);
    const paying = subscribers.filter((r) => r.payments > 0);
    const churned = paying.filter((r) => r.segment === "churned");
    const active = paying.filter((r) => r.segment === "active");
    const neverCharged = subscribers.filter((r) => r.payments === 0);

    // ---- affiliates: account, no SaaSSuite Stripe subscription ----
    const subEmails = new Set(subscribers.map((r) => r.email).filter(Boolean) as string[]);
    const affiliates = users
      .filter((u) => u.email && !subEmails.has(String(u.email).trim().toLowerCase()))
      .map((u) => {
        const created = u.created_at ? new Date(u.created_at).getTime() : Date.now();
        const tenureDays = Math.max(0, Math.round((Date.now() - created) / 86400000));
        const s = signalsFor(u);
        const activeAccount = !!u.approval && String(u.approval).toUpperCase() === "YES";
        return {
          segment: "affiliate_free" as const,
          email: String(u.email).trim().toLowerCase(),
          name: u.full_name ?? null,
          appPlan: u.plan ?? null,
          approval: u.approval ?? null,
          isAffiliateFlag: !!u.is_affiliate,
          imputedMonthlyValue: AFFILIATE_IMPUTED_VALUE,
          imputedLtv: round((tenureDays / 30.44) * AFFILIATE_IMPUTED_VALUE),
          createdAt: u.created_at ?? null,
          tenureDays,
          tenureMonths: round(tenureDays / 30.44, 1),
          activeAccount,
          signals: s,
        };
      });
    const affiliatesActive = affiliates.filter((a) => a.activeAccount);

    // ---- predictors: churned vs retained ----
    const rate = (rows: typeof paying, key: string) =>
      pct(rows.filter((r) => (r.signals as any)[key]).length, rows.length);
    const mean = (rows: typeof paying, key: string) => avg(rows.map((r) => Number((r.signals as any)[key] ?? 0)));

    const predictors = SIGNALS.map((s) => {
      if (s.kind === "bool") {
        const a = rate(active, s.key);
        const c = rate(churned, s.key);
        return { signal: s.label, kind: s.kind, retained: a, churned: c, delta: round(a - c, 1), unit: "%" };
      }
      const a = mean(active, s.key);
      const c = mean(churned, s.key);
      return { signal: s.label, kind: s.kind, retained: a, churned: c, delta: round(a - c), unit: "avg" };
    }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

    // ---- plan breakdown ----
    const planKeys = ["STARTER", "BASIC", "ADVANCED", "OTHER"];
    const planBreakdown = planKeys
      .map((p) => {
        const rows = paying.filter((r) => r.stripePlan === p);
        const ch = rows.filter((r) => r.segment === "churned");
        const ac = rows.filter((r) => r.segment === "active");
        return {
          plan: p,
          customers: rows.length,
          active: ac.length,
          churned: ch.length,
          churnRate: pct(ch.length, rows.length),
          avgLtv: avg(rows.map((r) => r.ltv)),
          medianLtv: median(rows.map((r) => r.ltv)),
          avgTenureMonths: avg(rows.map((r) => r.tenureMonths)),
          avgChurnedTenureMonths: avg(ch.map((r) => r.tenureMonths)),
          avgPayments: avg(rows.map((r) => r.payments)),
          activeMrr: round(ac.reduce((s, r) => s + r.mrr, 0)),
          installRate: rate(rows, "install_confirmed"),
          avgLogins: mean(rows, "login_count"),
        };
      })
      .filter((p) => p.customers > 0);

    // ---- tenure buckets for churned ----
    const buckets = [
      { label: "0-30d", min: 0, max: 30 },
      { label: "31-60d", min: 31, max: 60 },
      { label: "61-90d", min: 61, max: 90 },
      { label: "91-180d", min: 91, max: 180 },
      { label: "181-365d", min: 181, max: 365 },
      { label: "365d+", min: 366, max: 1e9 },
    ].map((b) => ({
      label: b.label,
      churned: churned.filter((r) => r.tenureDays >= b.min && r.tenureDays <= b.max).length,
      active: active.filter((r) => r.tenureDays >= b.min && r.tenureDays <= b.max).length,
    }));

    const monthlyRevenue = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => ({
        month,
        gross: m.revenue,
        refunds: m.refunds,
        net: round(m.revenue - m.refunds),
        charges: m.charges,
        grossSaas: m.revenueSaas,
        refundsSaas: m.refundsSaas,
        netSaas: round(m.revenueSaas - m.refundsSaas),
        chargesSaas: m.chargesSaas,
      }));


    // ---- month-by-month timeline: growth, churn and revenue over time ----
    const monthKey = (iso: string | null) => (iso ? iso.slice(0, 7) : null);
    const monthList: string[] = (() => {
      const keys = [
        ...monthlyRevenue.map((m) => m.month),
        ...paying.map((r) => monthKey(r.startedAt)).filter(Boolean) as string[],
      ].sort();
      if (!keys.length) return [];
      const [sy, sm] = keys[0].split("-").map(Number);
      const now = new Date();
      const out: string[] = [];
      let y = sy;
      let mo = sm;
      while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && mo <= now.getUTCMonth() + 1)) {
        out.push(`${y}-${String(mo).padStart(2, "0")}`);
        mo += 1;
        if (mo > 12) {
          mo = 1;
          y += 1;
        }
      }
      return out;
    })();

    const revByMonth = new Map(monthlyRevenue.map((m) => [m.month, m]));
    const timeline = monthList.map((month) => {
      const starts = paying.filter((r) => monthKey(r.startedAt) === month);
      const ends = paying.filter((r) => r.segment === "churned" && monthKey(r.endedAt) === month);
      // Customers paying at any point during this month
      const activeDuring = paying.filter((r) => {
        const s = monthKey(r.startedAt);
        if (!s || s > month) return false;
        const e = r.segment === "churned" ? monthKey(r.endedAt) : null;
        return !e || e >= month;
      });
      const activeStart = activeDuring.filter((r) => (monthKey(r.startedAt) ?? "") < month).length;
      const activeEnd = activeDuring.filter((r) => {
        const e = r.segment === "churned" ? monthKey(r.endedAt) : null;
        return !e || e > month;
      }).length;
      const rev = revByMonth.get(month);
      const base = activeStart + starts.length;
      return {
        month,
        newCustomers: starts.length,
        churnedCustomers: ends.length,
        activeStart,
        activeEnd,
        // Churn rate against everyone who was payingthat month (start + new)
        churnRate: pct(ends.length, base),
        churnRateOfStart: pct(ends.length, activeStart),
        netRevenue: rev?.net ?? 0,
        grossRevenue: rev?.gross ?? 0,
        refunds: rev?.refunds ?? 0,
        charges: rev?.charges ?? 0,
        netRevenueSaas: rev?.netSaas ?? 0,
        grossRevenueSaas: rev?.grossSaas ?? 0,
        refundsSaas: rev?.refundsSaas ?? 0,
        chargesSaas: rev?.chargesSaas ?? 0,
        newMrr: round(starts.reduce((s, r) => s + r.mrr, 0)),
        churnedLtv: avg(ends.map((r) => r.ltv)),
        churnedTenureMonths: avg(ends.map((r) => r.tenureMonths)),
        arpu: base ? round((rev?.net ?? 0) / base) : 0,
        arpuSaas: base ? round((rev?.netSaas ?? 0) / base) : 0,
      };
    });


    // ---- signup cohorts: how each month's intake has performed ----
    const cohortMonths = [...new Set(paying.map((r) => monthKey(r.startedAt)).filter(Boolean) as string[])].sort();
    const cohorts = cohortMonths.map((month) => {
      const rows = paying.filter((r) => monthKey(r.startedAt) === month);
      const ch = rows.filter((r) => r.segment === "churned");
      const retainedAt = (m: number) =>
        pct(rows.filter((r) => r.tenureDays >= m * 30.44).length, rows.length);
      return {
        month,
        size: rows.length,
        stillActive: rows.length - ch.length,
        churned: ch.length,
        churnRate: pct(ch.length, rows.length),
        avgLtv: avg(rows.map((r) => r.ltv)),
        medianLtv: median(rows.map((r) => r.ltv)),
        avgTenureMonths: avg(rows.map((r) => r.tenureMonths)),
        m1Retention: retainedAt(1),
        m3Retention: retainedAt(3),
        m6Retention: retainedAt(6),
        newMrr: round(rows.reduce((s, r) => s + r.mrr, 0)),
      };
    });


    const trimmedAvg = (xs: number[]) => {
      if (xs.length < 10) return avg(xs);
      const s = [...xs].sort((a, b) => a - b);
      const cut = Math.floor(s.length * 0.05);
      return avg(s.slice(cut, s.length - cut));
    };

    const payload = {
      generatedAt: new Date().toISOString(),
      affiliateImputedValue: AFFILIATE_IMPUTED_VALUE,
      summary: {
        subscriptionCustomers: subscribers.length,
        payingCustomers: paying.length,
        activeCustomers: active.length,
        churnedCustomers: churned.length,
        neverChargedTrials: neverCharged.length,
        churnRate: pct(churned.length, paying.length),
        activeMrr: round(active.reduce((s, r) => s + r.mrr, 0)),
        lifetimeNetRevenue: round(paying.reduce((s, r) => s + r.ltv, 0)),
        avgLtv: avg(paying.map((r) => r.ltv)),
        medianLtv: median(paying.map((r) => r.ltv)),
        trimmedAvgLtv: trimmedAvg(paying.map((r) => r.ltv)),
        avgLtvChurned: avg(churned.map((r) => r.ltv)),
        avgLtvActive: avg(active.map((r) => r.ltv)),
        avgTenureMonths: avg(paying.map((r) => r.tenureMonths)),
        avgTenureMonthsChurned: avg(churned.map((r) => r.tenureMonths)),
        medianTenureMonthsChurned: median(churned.map((r) => r.tenureMonths)),
        avgPaymentsChurned: avg(churned.map((r) => r.payments)),
        lifetimeNetRevenueSaas: round(paying.reduce((s, r) => s + r.ltvSaas, 0)),
        avgLtvSaas: avg(paying.map((r) => r.ltvSaas)),
        medianLtvSaas: median(paying.map((r) => r.ltvSaas)),
        affiliateAccounts: affiliates.length,
        affiliateActiveAccounts: affiliatesActive.length,
        affiliateAvgTenureMonths: avg(affiliatesActive.map((a) => a.tenureMonths)),
        affiliateAvgImputedLtv: avg(affiliatesActive.map((a) => a.imputedLtv)),
        affiliateImputedMrr: round(affiliatesActive.length * AFFILIATE_IMPUTED_VALUE),
      },
      predictors,
      planBreakdown,
      tenureBuckets: buckets,
      monthlyRevenue,
      timeline,
      cohorts,
      hubUserBuckets: [
        { label: "0 users (nobody logged in)", min: 0, max: 0 },
        { label: "1 user (just them)", min: 1, max: 1 },
        { label: "2-5 users", min: 2, max: 5 },
        { label: "6+ users", min: 6, max: 1e9 },
      ].map((b) => {
        const inB = (rows: typeof paying) =>
          rows.filter((r) => r.hubUsers >= b.min && r.hubUsers <= b.max);
        const ch = inB(churned);
        const ac = inB(active);
        return {
          label: b.label,
          churned: ch.length,
          active: ac.length,
          churnRate: pct(ch.length, ch.length + ac.length),
          avgLtv: avg([...ch, ...ac].map((r) => r.ltv)),
        };
      }),
      signalDefs: SIGNALS.map((x) => ({ key: x.key, label: x.label, kind: x.kind })),

      affiliateSignals: SIGNALS.filter((s) => s.kind === "bool").map((s) => ({
        signal: s.label,
        payingActive: rate(active, s.key),
        payingChurned: rate(churned, s.key),
        affiliates: pct(affiliatesActive.filter((a) => (a.signals as any)[s.key]).length, affiliatesActive.length),
      })),
      customers: paying,
      neverCharged,
      affiliates,
    };

    return json(payload);
  } catch (e) {
    console.error("revenue-analytics error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
