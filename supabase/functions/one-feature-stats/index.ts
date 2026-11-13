import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Password-gated, read-only stats for /onefeaturetraining-3 and -4. Returns only aggregates.
const PASSWORD = "saassuiterocks";
const TEST_EMAILS = ["test@test.com", "test@example.com", "metricsmania@gmail.com", "test-optin@saassuite.ai", "bcause@aol.com", "andrew@saassuite.com", "andrew@dna-media.net"];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Row = { session_id: string | null; event_type: string; label: string | null; duration_ms: number | null };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  if (body?.password !== PASSWORD) return json({ error: "Wrong password" }, 401);
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const load = async (path: string) => {
    const out: Row[] = [];
    for (let from = 0; from < 100_000; from += 1000) {
      const { data, error } = await db.from("site_analytics_events").select("session_id,event_type,label,duration_ms")
        .eq("path", path).gte("created_at", since).in("event_type", ["pageview", "exit", "click", "video_play"])
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };

  const sessionsWhere = (rows: Row[], fn: (r: Row) => boolean) => new Set(rows.filter(fn).map((r) => r.session_id).filter(Boolean)).size;
  const clicked = (rows: Row[], labels: string[]) => sessionsWhere(rows, (r) => r.event_type === "click" && labels.includes(r.label ?? ""));
  const PLAN = { "97": "$97/ month", "297": "$297/ month", "497": "$497/ month" };
  const NEXT = ["Start My FREE GHL Trial", "Upgrade to the $297 Plan", "Upgrade to the $497 Plan", "Sign up for SaaSSuite for FREE and our team will build this for you"];

  const base = (rows: Row[]) => {
    const visitors = sessionsWhere(rows, (r) => r.event_type === "pageview");
    const perSession = new Map<string, number>();
    for (const r of rows) if (r.event_type === "exit" && r.label === "time_on_page" && r.session_id) {
      perSession.set(r.session_id, Math.max(perSession.get(r.session_id) ?? 0, Number(r.duration_ms) || 0));
    }
    const times = [...perSession.values()].filter((t) => t > 0 && t < 3 * 3600_000).sort((a, b) => a - b);
    const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000) : 0;
    const median = times.length ? Math.round(times[Math.floor(times.length / 2)] / 1000) : 0;
    const video = sessionsWhere(rows, (r) => r.event_type === "video_play");
    const yes = clicked(rows, ["Yes"]), no = clicked(rows, ["No"]);
    const plans = Object.fromEntries(Object.entries(PLAN).map(([k, l]) => [k, clicked(rows, [l])]));
    const next = Object.fromEntries(NEXT.map((l) => [l, clicked(rows, [l])]));
    const nextAny = clicked(rows, NEXT);
    const checkout = clicked(rows, ["Continue to Secure Checkout"]);
    return { visitors, video, avg_seconds: avg, median_seconds: median, yes, no, answered: clicked(rows, ["Yes", "No"]), plans, plan_any: clicked(rows, Object.values(PLAN)), path_any: clicked(rows, [...Object.values(PLAN), "No"]), next, next_any: nextAny, checkout };
  };

  const [r3, r4, leadsRes, trials] = await Promise.all([
    load("/onefeaturetraining-3"), load("/onefeaturetraining-4"),
    db.from("one_feature_training_leads").select("email,has_highlevel,selected_plan,created_at").eq("page", "onefeaturetraining-4").gte("created_at", since),
    db.from("saas_suite_users").select("id", { count: "exact", head: true }).eq("trial_source", "onefeature_training_14day").gte("created_at", since),
  ]);
  const p3 = base(r3), p4 = base(r4);
  const leads = (leadsRes.data ?? []).filter((l) => !TEST_EMAILS.includes(String(l.email).toLowerCase()) && !/test/i.test(String(l.email)));
  const formStarted = sessionsWhere(r4, (r) => r.event_type === "click" && ["Name", "Email", "Phone"].includes(r.label ?? ""));
  const submitClicked = clicked(r4, ["Send My Bonuses"]);
  const withGhl = leads.filter((l) => l.has_highlevel).length;
  const savedPlans: Record<string, number> = {};
  for (const l of leads) if (l.selected_plan) savedPlans[l.selected_plan] = (savedPlans[l.selected_plan] ?? 0) + 1;

  const step = (label: string, raw: number, prev: number, first: number) => { const n = Math.min(raw, prev); return { label, count: n, pct_of_visitors: pct(n, first), pct_of_previous: pct(n, prev), dropoff: prev - n }; };

  const page3Funnel = [
    { label: "Visited page", count: p3.visitors, pct_of_visitors: 100, pct_of_previous: 100, dropoff: 0 },
    step("Answered \"Do you have GHL?\"", p3.answered, p3.visitors, p3.visitors),
    step("Picked a plan or got their next step", p3.path_any, p3.answered, p3.visitors),
    step("Clicked to the next page", p3.next_any, p3.path_any, p3.visitors),
  ];
  const page4Funnel = [
    { label: "Visited page", count: p4.visitors, pct_of_visitors: 100, pct_of_previous: 100, dropoff: 0 },
    step("Started the opt-in form", formStarted, p4.visitors, p4.visitors),
    step("Clicked \"Send My Bonuses\"", submitClicked, formStarted, p4.visitors),
    step("Opted in (saved lead)", leads.length, submitClicked, p4.visitors),
    step("Picked a plan or got their next step", p4.path_any, leads.length, p4.visitors),
    step("Clicked to the next page", p4.next_any, p4.path_any, p4.visitors),
  ];

  return json({
    days, generated_at: new Date().toISOString(), trial_signups: trials.count ?? 0,
    pages: {
      "3": { ...p3, funnel: page3Funnel },
      "4": { ...p4, funnel: page4Funnel, optins: leads.length, optin_rate: pct(leads.length, p4.visitors), with_ghl: withGhl, without_ghl: leads.length - withGhl, saved_plans: savedPlans },
    },
  });
});
