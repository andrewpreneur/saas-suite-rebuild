import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Preloaded 30-day signup analytics for the admin dashboard. */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ---- admin-only (admin session OR machine key) ----
  const machineKey = Deno.env.get("ADMIN_DATA_API_KEY") || "";
  const providedKey = req.headers.get("x-api-key") || "";
  if (!(machineKey && providedKey && providedKey === machineKey)) {
    try {
      const auth = req.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const { data } = await admin.auth.getUser(auth.slice(7));
      if (!isPlatformAdminEmail(data.user?.email)) {
        return json({ error: "Unauthorized" }, 401);
      }
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Math.min(Math.max(Number(body?.days) || 30, 1), 120);
    // Default "improvement" cutoff: Thursday Aug 20 2026 (onboarding-first changes shipped).
    const cutoff = String(body?.cutoff || "2026-08-20T00:00:00Z");
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const { data: users, error } = await admin
      .from("saas_suite_users")
      .select(
        "email, full_name, created_at, plan, approval, billing_state, login_count, last_login_at, agency_name, onboarding_completed, onboarding_completed_at, install_confirmed_at, utm_source, utm_medium, utm_campaign, fbclid, fbc, source, landing_page, referrer, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = users || [];
    const agencyIds = new Set<string>();
    const idsByEmail = new Map<string, string[]>();
    for (const u of rows) {
      const ids = [u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]
        .filter(Boolean) as string[];
      idsByEmail.set(u.email, ids);
      ids.forEach((i) => agencyIds.add(i));
    }

    // Hub (software onboarding page) visitors = user_progress rows under any of their agency ids.
    const hubByAgency = new Map<string, number>();
    const idList = [...agencyIds];
    for (let i = 0; i < idList.length; i += 100) {
      const slice = idList.slice(i, i + 100);
      const { data: progress } = await admin
        .from("user_progress")
        .select("agency_id")
        .in("agency_id", slice);
      for (const p of progress || []) {
        if (!p.agency_id) continue;
        hubByAgency.set(p.agency_id, (hubByAgency.get(p.agency_id) || 0) + 1);
      }
    }

    const isPaid = (plan: string | null) => !!plan && plan.toUpperCase() !== "STARTER";
    const srcOf = (u: Record<string, unknown>) => {
      const utm = (u.utm_source as string | null)?.trim();
      if (utm) return utm.toLowerCase();
      if (u.fbclid) return "fb (fbclid only)";
      const lp = (u.landing_page as string | null) || "";
      const ref = (u.referrer as string | null) || "";
      if (/facebook|instagram|fb\./i.test(ref)) return "meta (referrer)";
      if (/google/i.test(ref)) return "google (referrer)";
      if (ref && !/saassuite/i.test(ref)) return "referral";
      if (lp) return "organic / direct";
      return "unknown";
    };

    const enriched = rows.map((u) => {
      const ids = idsByEmail.get(u.email) || [];
      const hubVisitors = ids.reduce((s, id) => s + (hubByAgency.get(id) || 0), 0);
      return {
        email: u.email,
        name: u.full_name,
        createdAt: u.created_at,
        plan: u.plan,
        paid: isPaid(u.plan),
        billingState: u.billing_state,
        loginCount: u.login_count ?? 0,
        returned: (u.login_count ?? 0) > 1,
        lastLoginAt: u.last_login_at,
        agencyName: u.agency_name,
        namedAgency: !!(u.agency_name || "").trim(),
        onboardingCompleted: !!u.onboarding_completed,
        installed: !!u.install_confirmed_at,
        hubVisitors,
        viewedHub: hubVisitors > 0,
        source: srcOf(u as Record<string, unknown>),
        utmSource: u.utm_source,
        utmCampaign: u.utm_campaign,
        landingPage: u.landing_page,
        recent: new Date(u.created_at as string) >= new Date(cutoff),
      };
    });

    const agg = (list: typeof enriched) => ({
      signups: list.length,
      paid: list.filter((r) => r.paid).length,
      returned: list.filter((r) => r.returned).length,
      namedAgency: list.filter((r) => r.namedAgency).length,
      onboardingCompleted: list.filter((r) => r.onboardingCompleted).length,
      installed: list.filter((r) => r.installed).length,
      viewedHub: list.filter((r) => r.viewedHub).length,
      hubVisitors: list.reduce((s, r) => s + r.hubVisitors, 0),
      attributed: list.filter((r) => !!r.utmSource).length,
    });

    // daily series
    const byDay = new Map<string, { day: string; signups: number; paid: number; returned: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay.set(d, { day: d, signups: 0, paid: 0, returned: 0 });
    }
    for (const r of enriched) {
      const d = String(r.createdAt).slice(0, 10);
      const row = byDay.get(d);
      if (!row) continue;
      row.signups++;
      if (r.paid) row.paid++;
      if (r.returned) row.returned++;
    }

    // source breakdown
    const bySourceMap = new Map<string, typeof enriched>();
    for (const r of enriched) {
      const k = r.source;
      if (!bySourceMap.has(k)) bySourceMap.set(k, []);
      bySourceMap.get(k)!.push(r);
    }
    const bySource = [...bySourceMap.entries()]
      .map(([source, list]) => ({ source, ...agg(list) }))
      .sort((a, b) => b.signups - a.signups);

    // landing page breakdown
    const byLpMap = new Map<string, typeof enriched>();
    for (const r of enriched) {
      const k = (r.landingPage || "(none captured)").replace(/^https?:\/\/(www\.)?/, "");
      if (!byLpMap.has(k)) byLpMap.set(k, []);
      byLpMap.get(k)!.push(r);
    }
    const byLandingPage = [...byLpMap.entries()]
      .map(([landingPage, list]) => ({ landingPage, ...agg(list) }))
      .sort((a, b) => b.signups - a.signups);

    return json({
      meta: { days, since, cutoff, generated_at: new Date().toISOString() },
      totals: agg(enriched),
      before: agg(enriched.filter((r) => !r.recent)),
      after: agg(enriched.filter((r) => r.recent)),
      daily: [...byDay.values()],
      bySource,
      byLandingPage,
      users: enriched,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SIGNUP-STATS]", msg);
    return json({ error: msg }, 500);
  }
});
