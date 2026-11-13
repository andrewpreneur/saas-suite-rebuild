import { corsHeaders, json, requireAdmin, serviceClient } from "../_shared/admin-auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-flash";

type Window = "24h" | "7d" | "30d" | "all";
function since(w: Window | undefined): string {
  const now = Date.now();
  const map: Record<Window, number> = {
    "24h": 24 * 3600 * 1000,
    "7d": 7 * 24 * 3600 * 1000,
    "30d": 30 * 24 * 3600 * 1000,
    all: 365 * 24 * 3600 * 1000, // cap "all" at 1 year for perf
  };
  const ms = map[w ?? "7d"] ?? map["7d"];
  return new Date(now - ms).toISOString();
}

const windowSchema = {
  type: "string",
  enum: ["24h", "7d", "30d", "all"],
  description: "Time window. Defaults to 7d.",
};

const tools = [
  { type: "function", function: { name: "get_platform_summary", description: "Quick topline: signups, active users, warmup queue, free-leads queue, tickets in the last 7 days.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_warmup_requests", description: "Email warmup requests that need attention (pending/in-progress). Includes days_waiting.", parameters: { type: "object", properties: { status: { type: "string", description: "Filter status (default: pending)" } } } } },
  { type: "function", function: { name: "get_free_leads_requests", description: "Recent free-leads requests, pending or fulfilled.", parameters: { type: "object", properties: { window: windowSchema, status: { type: "string" } } } } },
  { type: "function", function: { name: "get_new_signups", description: "New SaaSSuite users created in the window.", parameters: { type: "object", properties: { window: windowSchema } } } },
  { type: "function", function: { name: "get_recent_logins", description: "Distinct users who logged activity in the window with session counts.", parameters: { type: "object", properties: { window: windowSchema } } } },
  { type: "function", function: { name: "get_most_active_users", description: "Top users by session count in the window, split into new (<30 days) vs existing.", parameters: { type: "object", properties: { window: windowSchema, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_onboarding_progress", description: "New or updated user_progress rows (SaaSSuite user records) in the window.", parameters: { type: "object", properties: { window: windowSchema } } } },
  { type: "function", function: { name: "get_adoption_themes", description: "Top platform_events trigger_types in the window with unique-user counts.", parameters: { type: "object", properties: { window: windowSchema } } } },
];

async function runTool(name: string, args: Record<string, unknown>) {
  const sb = serviceClient();
  const w = args.window as Window | undefined;
  const iso = since(w);

  switch (name) {
    case "get_platform_summary": {
      const iso7 = since("7d");
      const iso1 = since("24h");
      const [signups, active, warmup, leads, tickets] = await Promise.all([
        sb.from("saas_suite_users").select("id", { count: "exact", head: true }).gte("created_at", iso7),
        sb.from("user_activity_sessions").select("user_email", { count: "exact", head: true }).gte("session_started_at", iso1),
        sb.from("email_warmup_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
        sb.from("free_leads").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("support_tickets").select("id", { count: "exact", head: true }).gte("created_at", iso7),
      ]);
      return {
        new_signups_7d: signups.count ?? 0,
        active_users_24h: active.count ?? 0,
        warmup_queue: warmup.count ?? 0,
        free_leads_queue: leads.count ?? 0,
        support_tickets_7d: tickets.count ?? 0,
      };
    }
    case "get_warmup_requests": {
      const status = (args.status as string) ?? "pending";
      const { data } = await sb
        .from("email_warmup_requests")
        .select("user_email, agency_name, sender_email, warmed_domain, status, created_at")
        .eq("status", status)
        .order("created_at", { ascending: true })
        .limit(50);
      const now = Date.now();
      return (data ?? []).map((r: any) => ({
        ...r,
        days_waiting: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
      }));
    }
    case "get_free_leads_requests": {
      const status = args.status as string | undefined;
      let q = sb
        .from("free_leads")
        .select("user_email, business_keywords, city, country, status, created_at")
        .gte("created_at", iso)
        .order("created_at", { ascending: false })
        .limit(50);
      if (status) q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    }
    case "get_new_signups": {
      const { data } = await sb
        .from("saas_suite_users")
        .select("email, full_name, plan, source, created_at, approval, onboarding_completed")
        .gte("created_at", iso)
        .order("created_at", { ascending: false })
        .limit(50);
      return { count: data?.length ?? 0, users: data ?? [] };
    }
    case "get_recent_logins": {
      const { data } = await sb
        .from("user_activity_sessions")
        .select("user_email, session_started_at")
        .gte("session_started_at", iso)
        .limit(1000);
      const map = new Map<string, { sessions: number; last: string }>();
      for (const row of data ?? []) {
        const cur = map.get(row.user_email) ?? { sessions: 0, last: row.session_started_at };
        cur.sessions += 1;
        if (row.session_started_at > cur.last) cur.last = row.session_started_at;
        map.set(row.user_email, cur);
      }
      const rows = [...map.entries()].map(([email, v]) => ({ email, sessions: v.sessions, last_session_at: v.last }));
      rows.sort((a, b) => b.sessions - a.sessions);
      return { unique_users: rows.length, users: rows.slice(0, 50) };
    }
    case "get_most_active_users": {
      const limit = Math.min(Number(args.limit ?? 10), 25);
      const { data: sessions } = await sb
        .from("user_activity_sessions")
        .select("user_email, session_started_at")
        .gte("session_started_at", iso)
        .limit(2000);
      const counts = new Map<string, number>();
      for (const s of sessions ?? []) counts.set(s.user_email, (counts.get(s.user_email) ?? 0) + 1);
      const emails = [...counts.keys()];
      if (emails.length === 0) return { new_users: [], existing_users: [] };
      const { data: users } = await sb
        .from("saas_suite_users")
        .select("email, full_name, plan, created_at")
        .in("email", emails);
      const cutoff = Date.now() - 30 * 86400000;
      const enriched = (users ?? []).map((u: any) => ({
        email: u.email,
        name: u.full_name,
        plan: u.plan,
        sessions: counts.get(u.email) ?? 0,
        is_new: new Date(u.created_at).getTime() > cutoff,
      }));
      enriched.sort((a, b) => b.sessions - a.sessions);
      return {
        new_users: enriched.filter((u) => u.is_new).slice(0, limit),
        existing_users: enriched.filter((u) => !u.is_new).slice(0, limit),
      };
    }
    case "get_onboarding_progress": {
      const { data } = await sb
        .from("user_progress")
        .select("email, name, agency_id, approval, last_accessed, created_at")
        .or(`created_at.gte.${iso},last_accessed.gte.${iso}`)
        .order("last_accessed", { ascending: false, nullsFirst: false })
        .limit(50);
      return { count: data?.length ?? 0, records: data ?? [] };
    }
    case "get_adoption_themes": {
      const { data } = await sb
        .from("platform_events")
        .select("trigger_type, user_email, created_at")
        .gte("created_at", iso)
        .limit(5000);
      const themes = new Map<string, { count: number; users: Set<string> }>();
      for (const e of data ?? []) {
        const t = themes.get(e.trigger_type) ?? { count: 0, users: new Set() };
        t.count += 1;
        if (e.user_email) t.users.add(e.user_email);
        themes.set(e.trigger_type, t);
      }
      const rows = [...themes.entries()].map(([trigger_type, v]) => ({
        trigger_type,
        events: v.count,
        unique_users: v.users.size,
      }));
      rows.sort((a, b) => b.events - a.events);
      return { total_events: (data ?? []).length, themes: rows.slice(0, 25) };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

const SYSTEM = `You are the SaaSSuite admin voice briefing assistant, speaking to Andrew (the platform owner).

You have read-only tools to inspect the platform database. Rules:
- ALWAYS call at least one tool before answering a data question. Never guess numbers.
- Prefer get_platform_summary for open-ended "give me an update" asks.
- Time windows default to 7 days. If the user says "today" or "past 24 hours" use 24h.
- Reply in a conversational spoken tone, 2-5 short sentences.
- Include concrete numbers and 1-3 names/emails when relevant.
- End with a natural offer to drill deeper (e.g. "Want me to pull the specific warmup requests?").
- Never say "according to the data" or read raw JSON.
- If a tool returns an empty result, say so plainly and suggest a broader window.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages required" }, 400);

    const convo: any[] = [{ role: "system", content: SYSTEM }, ...messages];

    for (let round = 0; round < 5; round++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, messages: convo, tools, tool_choice: "auto" }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Gateway error:", resp.status, text);
        return json({ error: `AI gateway ${resp.status}`, details: text }, resp.status === 402 || resp.status === 429 ? resp.status : 502);
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return json({ error: "empty response" }, 502);

      const calls = msg.tool_calls;
      if (calls && calls.length > 0) {
        convo.push(msg);
        for (const c of calls) {
          let args = {};
          try { args = JSON.parse(c.function.arguments || "{}"); } catch {}
          console.log("tool", c.function.name, args);
          const result = await runTool(c.function.name, args as any);
          convo.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
        }
        continue;
      }

      return json({ text: msg.content ?? "" });
    }
    return json({ text: "I got stuck looking things up — try asking again." });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});