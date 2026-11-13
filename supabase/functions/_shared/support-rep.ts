// Shared logic for the support-rep hiring + 2-week training simulator.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export const REP_PASSWORD = () =>
  (Deno.env.get("SUPPORT_REP_PASSWORD") || "sas suite support 99").toLowerCase().replace(/\s+/g, " ").trim();

export function normalizePassword(input: unknown): string {
  return String(input || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The five non-negotiable standards shown on the form and used when grading. */
export const STANDARDS = [
  "90% or more of support requests answered within 10 minutes.",
  "The remaining 10% of support requests answered within 12 hours.",
  "100% kind, understanding, human-written replies. No AI-generated answers.",
  "100% escalation honesty: research first (help docs, Google, YouTube) and say so honestly when unsure.",
  "100% American English grammatical accuracy on every message sent.",
];

/* ---------------------------------------------------------------- privacy */

const SCRUB: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "the customer"],
  [/https?:\/\/\S+/g, "[link]"],
  [/\+?\d[\d\s().-]{8,}\d/g, "[phone]"],
];

export function scrub(text: string): string {
  let out = String(text || "");
  for (const [re, rep] of SCRUB) out = out.replace(re, rep);
  return out.replace(/\s{3,}/g, " ").trim();
}

/* ------------------------------------------------------- outbound webhook */

export async function notifyWebhook(event: string, payload: Record<string, unknown>) {
  const url = Deno.env.get("SUPPORT_REP_WEBHOOK_URL");
  if (!url) {
    console.error("[support-rep] SUPPORT_REP_WEBHOOK_URL not configured");
    return { ok: false, skipped: "webhook_not_configured" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("[support-rep] webhook failed", e);
    return { ok: false, error: String(e) };
  }
}

/* ------------------------------------------------------------- AI helpers */

const AI_MODEL = "google/gemini-3.8-flash";

export async function askAI(system: string, user: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content || "");
}

export function parseJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (lastBrace > start) {
      try {
        return JSON.parse(cleaned.slice(start, lastBrace + 1)) as T;
      } catch { /* fall through */ }
    }
    return null;
  }
}

/* ------------------------------------------------------- question sourcing */

/**
 * Seeds the practice question bank from REAL support requests already in the
 * database (support tickets + the questions customers asked the AI). Runs
 * cheaply and is idempotent thanks to the fingerprint unique index.
 */
export async function seedQuestionBank(supabase: SupabaseClient): Promise<number> {
  const rows: Array<{ question: string; category: string | null; source: string; fingerprint: string }> = [];
  const seen = new Set<string>();

  const push = (text: string, category: string | null, source: string) => {
    const q = scrub(text);
    if (q.length < 25 || q.length > 900) return;
    const fp = q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 160);
    if (!fp || seen.has(fp)) return;
    seen.add(fp);
    rows.push({ question: q, category, source, fingerprint: fp });
  };

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("request_text, issue_category, created_at")
    .not("request_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(400);
  for (const t of tickets || []) push(String(t.request_text || ""), t.issue_category || null, "ticket");

  const { data: chats } = await supabase
    .from("ai_chat_messages")
    .select("content, created_at, role")
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(800);
  for (const c of chats || []) push(String(c.content || ""), null, "ai_chat");

  if (!rows.length) return 0;
  const { error } = await supabase
    .from("support_rep_questions")
    .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
  if (error) console.error("[support-rep] seed error", error);

  const { count } = await supabase
    .from("support_rep_questions")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  return count || 0;
}

/* ----------------------------------------------------------- scheduling */

const CT_OFFSET_HOURS = 5; // America/Chicago (CDT). Central working window 8:00-21:00.

function utcFor(dayStart: Date, ctHour: number, ctMinute: number): Date {
  const d = new Date(dayStart);
  d.setUTCHours(ctHour + CT_OFFSET_HOURS, ctMinute, 0, 0);
  return d;
}

/**
 * Builds the 14-day practice queue: 3-5 requests per day, 90% of them landing
 * between 8:00am and 9:00pm Central, the other 10% at any random hour.
 */
export async function buildQueue(
  supabase: SupabaseClient,
  applicant: { id: string; training_starts_at: string; works_weekends: boolean },
): Promise<number> {
  const { data: bank } = await supabase
    .from("support_rep_questions")
    .select("id, question, category")
    .eq("active", true)
    .limit(600);
  const pool = [...(bank || [])];
  if (!pool.length) return 0;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const start = new Date(applicant.training_starts_at);
  const cases: Array<Record<string, unknown>> = [];
  let idx = 0;

  for (let day = 0; day < 14; day++) {
    const dayStart = new Date(start);
    dayStart.setUTCDate(dayStart.getUTCDate() + day);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dow = new Date(dayStart.getTime() - CT_OFFSET_HOURS * 3600_000).getUTCDay();
    if (!applicant.works_weekends && (dow === 0 || dow === 6)) continue;

    const perDay = 3 + Math.floor(Math.random() * 3); // 3-5
    for (let n = 0; n < perDay; n++) {
      const q = pool[idx % pool.length];
      idx++;
      const offHours = Math.random() < 0.1;
      const ctHour = offHours
        ? Math.floor(Math.random() * 24)
        : 8 + Math.floor(Math.random() * 13); // 8..20
      const scheduled = utcFor(dayStart, ctHour, Math.floor(Math.random() * 60));
      if (scheduled.getTime() < Date.now() - 60_000) continue;
      cases.push({
        applicant_id: applicant.id,
        question_id: q.id,
        question: q.question,
        mode: Math.random() < 0.35 ? "roleplay" : "single",
        scheduled_at: scheduled.toISOString(),
        status: "scheduled",
      });
    }
  }

  if (!cases.length) return 0;
  const { error } = await supabase.from("support_rep_cases").insert(cases);
  if (error) {
    console.error("[support-rep] queue insert error", error);
    return 0;
  }
  return cases.length;
}

/* ------------------------------------------------------------- scoring */

export type CaseGrade = {
  grammar_score: number;
  tone_score: number;
  accuracy_score: number;
  honesty_score: number;
  summary: string;
  suggestions: string[];
};

export function metricsFor(cases: Array<{
  status: string;
  response_minutes: number | null;
  score: number | null;
  grade: CaseGrade | null;
}>) {
  const answered = cases.filter((c) => c.response_minutes != null);
  const times = answered.map((c) => Number(c.response_minutes));
  const within10 = times.filter((m) => m <= 10).length;
  const within12h = times.filter((m) => m <= 720).length;
  const avg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;

  const grades = cases.map((c) => c.grade).filter(Boolean) as CaseGrade[];
  const grammar = avg(grades.map((g) => Number(g.grammar_score) || 0));
  const tone = avg(grades.map((g) => Number(g.tone_score) || 0));
  const accuracy = avg(grades.map((g) => Number(g.accuracy_score) || 0));
  const honesty = avg(grades.map((g) => Number(g.honesty_score) || 0));

  const pct10 = times.length ? Math.round((within10 / times.length) * 1000) / 10 : 0;
  const pct12h = times.length ? Math.round((within12h / times.length) * 1000) / 10 : 0;
  const missed = cases.filter((c) => c.status === "missed").length;

  // Speed target: 90% inside 10 minutes, 100% inside 12 hours.
  const speedScore = Math.max(0, Math.min(100, pct10 / 0.9 * 0.7 + pct12h * 0.3));
  const qualityScore = avg([tone, accuracy, honesty]);
  const finalScore = Math.round(speedScore * 0.4 + grammar * 0.25 + qualityScore * 0.35);

  return {
    total_cases: cases.length,
    answered: answered.length,
    missed,
    pending: cases.filter((c) => c.status === "delivered" || c.status === "in_progress").length,
    avg_response_minutes: avg(times),
    fastest_response_minutes: times.length ? Math.min(...times) : 0,
    pct_within_10_min: pct10,
    pct_within_12_hours: pct12h,
    grammar_score: grammar,
    tone_score: tone,
    accuracy_score: accuracy,
    honesty_score: honesty,
    speed_score: Math.round(speedScore),
    quality_score: Math.round(qualityScore),
    final_score: finalScore,
    meets_standard: pct10 >= 90 && pct12h >= 100 && grammar >= 90,
  };
}
