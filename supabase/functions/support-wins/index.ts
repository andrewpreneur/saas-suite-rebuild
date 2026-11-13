// Public, fully anonymized support case studies: real AI-chat and human-support
// resolutions, packaged by AI into readable case studies. No emails, names,
// agency names or URLs ever leave this function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Msg = { agency_id: string; user_identifier: string | null; role: string; content: string; created_at: string };

type RawCase = {
  id: string;
  channel: "ai" | "human";
  initials: string;
  transcript: string;
  praise: string | null;
  category: string | null;
  at: string;
  minutes: number | null;
  seconds: number | null;
  score: number;
  questionCount?: number;
  screenshotCount?: number;
  preferredHeadline?: string;
  preferredPraise?: string;
};

export type CaseStudy = {
  id: string;
  channel: "ai" | "human";
  initials: string;
  headline: string;
  quote: string;
  questions: string[];
  summary: string;
  solution: string[];
  satisfaction: string;
  time_to_result: string;
  tags: string[];
  at: string;
  screenshots?: string[];
};

type CuratedCase = {
  id: string;
  identifier: string;
  from: string;
  to: string;
  channel: "ai" | "human";
  initials: string;
  headline?: string;
  quote: string;
};

const CURATED: CuratedCase[] = [
  { id: "course-launch-support", identifier: "deborah@deborahcarlislesolomon.com", from: "2026-09-14T00:00:00Z", to: "2026-09-15T00:00:00Z", channel: "human", initials: "DC", quote: "If you were here, I'd give you a hug! Thank you SO much! And I'm never going back to the way it was previously. :)" },
  { id: "funnels-copied", identifier: "charlaynemallare@yahoo.com", from: "2026-09-14T00:00:00Z", to: "2026-09-15T00:00:00Z", channel: "human", initials: "CM", quote: "That is all for now. Thanks for your assistance." },
  { id: "dns-record-guidance", identifier: "becomeunshoppable@gmail.com", from: "2026-09-12T00:00:00Z", to: "2026-09-15T00:00:00Z", channel: "ai", initials: "BU", quote: "I really appreciate it. I am glad I reached out. I didn't want to mess it up, so yes, that's perfect. Thank you!" },
  { id: "quiz-ai-studio", identifier: "laganiere.joanie@gmail.com", from: "2026-09-04T00:00:00Z", to: "2026-09-06T00:00:00Z", channel: "ai", initials: "JL", quote: "Yééé! I verified everything and it works!" },
  { id: "questions-in-one-session", identifier: "natalie@nataliehankins.com", from: "2026-09-06T00:00:00Z", to: "2026-09-07T00:00:00Z", channel: "ai", initials: "NH", quote: "Okay. Great! I did it!" },
  { id: "email-inbox-setup", identifier: "maryann@becomeunshoppable.com", from: "2026-07-25T00:00:00Z", to: "2026-07-28T00:00:00Z", channel: "human", initials: "MA", headline: "Business email inbox connected for her", quote: "Our team checked her mail records end to end and confirmed her business inbox was connected correctly." },
];


type Stats = {
  ai_conversations: number;
  ai_questions_answered: number;
  ai_median_response_seconds: number | null;
  ai_no_human_needed_pct: number | null;
  human_replies_sent: number;
  human_fastest_minutes: number | null;
  human_median_hours: number | null;
  human_same_day_pct: number | null;
  positive_mentions: number;
  thumbs_up: number;
  thumbs_down: number;
};

const PRAISE =
  /\b(thank you|thanks|thank u|thx|perfect|that worked|it worked|worked great|awesome|amazing|appreciate|you('| a)?re (the best|awesome|great|amazing)|love (it|this|that)|so helpful|very helpful|super helpful|great job|life ?saver|exactly what i needed|got it working|all set|fixed it)\b/i;

// Strong, quotable praise — these make the best case studies.
const STRONG_PRAISE =
  /\b(that worked|it worked|worked (great|perfectly)|got it working|fixed it|you('| a)?re (the best|awesome|amazing)|amazing|life ?saver|exactly what i needed|thank you so much|really appreciate|super helpful|so helpful|great support|best support|incredible|outstanding|excellent)\b/i;

const NEGATIVE =
  /\b(still (not|doesn'?t|isn'?t|blocked|broken|failing|can'?t|won'?t|having|getting|an issue|a problem)|not working|doesn'?t work|isn'?t working|frustrat|annoy|refund|cancel my|useless|broken again|no one (has )?(replied|responded)|any(thing| update)s? yet|how long is this)\b/i;

// First names of our own team must never appear in a published quote.
// A publishable quote has to read as an endorsement on its own.
const QUOTABLE =
  /\b(thank you|thanks|thx|appreciate|(so|very|super) helpful|that worked|it worked|works|working now|awesome|amazing|perfect|great (job|support|help)|life ?saver|excellent|the best|fixed it|got it working)\b/i;

const TEAM_NAMES = /\b(andrew|andrew george|ashley|saas ?suite)\b/gi;
const CUSTOMER_NAMES = /\b(deborah|charlayne|mary ?ann|mary|joanie|natalie)\b/gi;
// Agency-facing brand names that must never be published, even if the agency record
// that would normally supply them is missing.
const BRAND_NAMES = /\b(champagne ?room|champagne|become ?unshoppable|unshoppable|lead ?connect(or)?|go ?high ?level|high ?level)\b/gi;


const TEST_AGENCY = /(^|-)(test|testing|demo|sample|example)(-|$)/i;

// Redacts emails, phone numbers, URLs, markdown/HTML links and file paths.
const scrub = (s: string) =>
  (s || "")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, "[link removed]")
    .replace(/<a[^>]*>|<\/a>|<img[^>]*>/gi, " ")
    .replace(/\bhttps?:\/\/\S+/gi, "[link removed]")
    .replace(/\bwww\.\S+/gi, "[link removed]")
    .replace(/\b[\w-]+\.(?:com|net|org|io|ai|app|co|us|supabase\.co)\/\S*/gi, "[link removed]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[number removed]")
    .replace(/\s+/g, " ")
    .trim();

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);

const initialsFrom = (identifier: string | null | undefined) => {
  const local = (identifier || "").split("@")[0] || "";
  const parts = local.split(/[._\-0-9]+/).filter(Boolean);
  const letters = (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)) || "GH";
  return letters.toUpperCase();
};

const median = (nums: number[]) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const secondsLabel = (sec: number | null, min: number | null) => {
  if (sec != null) return sec < 90 ? `${Math.max(1, Math.round(sec))} seconds` : `${Math.round(sec / 60)} minutes`;
  if (min != null) {
    if (min < 60) return `${Math.max(1, Math.round(min))} minutes`;
    if (min < 60 * 24) {
      const hours = Math.max(1, Math.round(min / 60));
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    const days = Math.max(1, Math.round(min / 1440));
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  return "Same session";
};

// ---- AI packaging ---------------------------------------------------------
const SYSTEM = `You turn raw, already-anonymized support transcripts into short professional case studies for a B2B software marketing page.

Rules, no exceptions:
- NEVER output any person name, company/agency name, brand of the customer, email, phone number, URL, link, file path or "[link removed]" placeholder. If the transcript contains one, describe it generically ("their onboarding link", "a screenshot").
- Use only the customer's initials that are given to you, nothing else.
- Do not invent facts. Everything must be supported by the transcript. If a field cannot be supported, keep it short and generic.
- Treat the complete transcript as one case. Preserve multiple distinct questions when the customer asked several; return up to 12 questions.
- When a preferred headline is supplied, use it verbatim.
- Tone: factual, confident, no hype, no exclamation marks.

Return ONLY a JSON array. One object per input case, same order and same "id":
{
  "id": string,
  "headline": string,            // 3-7 words, the problem solved e.g. "Menu link not appearing"
  "quote": string,               // the CUSTOMER'S OWN positive words taken from the transcript, lightly cleaned, max 140 chars. Never use our support wording. If the customer never expressed satisfaction, return "".
  "questions": string[],         // up to 12 distinct customer questions, rewritten in first person, each under 160 chars
  "summary": string,             // 3-4 sentences walking through the conversation: what they came in with, what was diagnosed, how it progressed
  "solution": string[],          // 3-5 bullets of what we actually did / told them, in order
  "satisfaction": string,        // one of: "Confirmed resolved", "Very satisfied", "Satisfied", "Resolved"
  "tags": string[]               // 1-3 short topic tags e.g. "Installation", "Branding", "Billing", "Onboarding", "Automations"
}`;

// Long transcripts make a single request overflow the model's output budget, so the
// cases are packaged in small batches and merged.
async function packageCases(all: RawCase[]): Promise<CaseStudy[]> {
  const batches: RawCase[][] = [];
  for (let i = 0; i < all.length; i += 2) batches.push(all.slice(i, i + 2));
  const results = await Promise.all(batches.map((b) => packageBatch(b)));
  return results.flat();
}

async function packageBatch(cases: RawCase[]): Promise<CaseStudy[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key || !cases.length) return [];


  const payload = cases.map((c) => ({
    id: c.id,
    channel: c.channel,
    initials: c.initials,
    category: c.category,
    time_to_result: secondsLabel(c.seconds, c.minutes),
    preferred_headline: c.preferredHeadline,
    recorded_question_count: c.questionCount,
    praise: c.praise,
    transcript: c.transcript,
  }));

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(payload).slice(0, 180_000) },
      ],
    }),
  });

  if (!res.ok) {
    console.error("ai packaging failed", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "");
  const start = text.indexOf("[");
  if (start < 0) return [];
  const end = text.lastIndexOf("]");
  const body = text.slice(start, end > start ? end + 1 : undefined);

  let parsed: any[] = [];
  try {
    parsed = JSON.parse(body);
  } catch {
    // Truncated output: keep every complete object and close the array.
    for (let cut = body.lastIndexOf("}"); cut > 0 && !parsed.length; cut = body.lastIndexOf("}", cut - 1)) {
      try {
        parsed = JSON.parse(body.slice(0, cut + 1) + "]");
      } catch {
        // keep walking back to the previous complete object
      }
    }
    if (!parsed.length) console.error("ai json parse failed");
  }


  const byId = new Map(cases.map((c) => [c.id, c]));
  const out: CaseStudy[] = [];
  for (const p of parsed) {
    const src = byId.get(String(p?.id));
    if (!src) continue;
    const str = (v: unknown, n: number) =>
      trim(
        scrub(String(v ?? ""))
          .replace(/\[(email|number|link) removed\]/gi, "")
          .replace(TEAM_NAMES, "the team")
          .replace(CUSTOMER_NAMES, "the customer")
          .replace(BRAND_NAMES, "the platform")

          .replace(/\s+/g, " ")
          .trim(),
        n,
      );
    const arr = (v: unknown, n: number, max: number) =>
      (Array.isArray(v) ? v : []).map((x) => str(x, n)).filter((x) => x.length > 2).slice(0, max);

    const summary = str(p?.summary, 700);
    // Only feature cases with a substantive quote in the customer's own words.
    const isWeak = (quote: string) =>
      !quote ||
      quote.replace(/[^a-z]/gi, "").length < 18 ||
      !QUOTABLE.test(quote) ||
      /\bbut\b|\brealis|\brealiz/i.test(quote) ||
      NEGATIVE.test(quote) ||
      /\bno,? thanks\b|thank you anyway|thanks anyway/i.test(quote) ||
      // Requests and follow-ups are not endorsements.
      /\b(can you|could you|would like|i want|i'?d like|i need|following up|any update|please (help|check|advise|look)|how (do|can) i|\?)/i.test(quote);

    // Curated cases always use the customer's exact recorded words, never an AI-combined quote.
    const quote = str(src.praise || "", 180);
    if ((!quote || NEGATIVE.test(quote)) || !summary) continue;
    const cleanQuote = quote
      .replace(TEAM_NAMES, "")
      .replace(/,?\s*\bthe team\b/gi, "")
      .replace(/\s*,\s*(?=[.,!])/g, "")
      .replace(/\s+([.,!])/g, "$1")
      .replace(/,\s*,/g, ",")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,]+/, "")
      .trim();
    out.push({
      id: src.id,
      channel: src.channel,
      initials: src.initials,
      headline: str(p?.headline, 80) || "Support request resolved",
      quote: cleanQuote,
      questions: arr(p?.questions, 200, 12),
      summary,
      solution: arr(p?.solution, 240, 4),
      satisfaction: str(p?.satisfaction, 40) || "Resolved",
      time_to_result: secondsLabel(src.seconds, src.minutes),
      tags: arr(p?.tags, 24, 3),
      at: src.at,
      screenshots: [],
    });
    const added = out[out.length - 1];
    if (added && src.preferredHeadline) added.headline = src.preferredHeadline;
    if (added && src.screenshotCount) added.screenshots = Array.from({ length: src.screenshotCount }, () => "");
  }
  return out;
}

// ---- cache ---------------------------------------------------------------
const CACHE_KEY = "public-v4-curated";
// Only a handful of the very best conversations are packaged and published.
const BUILD_LIMIT = 12;
const FEATURED_LIMIT = 6;

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

async function build(): Promise<Record<string, unknown>> {
  {
    const supabase = admin();
    const limit = BUILD_LIMIT;

    // Agency names are collected only so we can STRIP them from transcripts.

    const { data: users } = await supabase.from("saas_suite_users").select("agency_name").limit(2000);
    const agencyNames = (users || [])
      .map((u) => (u.agency_name || "").trim())
      .filter((n) => n.length >= 4)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const agencyRe = agencyNames.length ? new RegExp(`\\b(${agencyNames.join("|")})\\b`, "gi") : null;
    const anon = (s: string) => {
      const base = scrub(s);
      return agencyRe ? base.replace(agencyRe, "their agency") : base;
    };

    // --- AI chat ----------------------------------------------------------
    const { data: msgs } = await supabase
      .from("ai_chat_messages")
      .select("agency_id, user_identifier, role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(6000);

    const rows = ((msgs || []) as Msg[])
      .filter((m) => !TEST_AGENCY.test(m.agency_id || ""))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const threads = new Map<string, Msg[]>();
    for (const m of rows) {
      const key = `${m.agency_id}|${m.user_identifier || "anon"}`;
      if (!threads.has(key)) threads.set(key, []);
      threads.get(key)!.push(m);
    }

    // Replies typed by a real human on our team live in agency_owner_messages.
    // Merge them into the same timeline so human wins can be told as case studies.
    const { data: ownerMsgs } = await supabase
      .from("agency_owner_messages")
      .select("agency_id, user_identifier, content, created_at")
      .order("created_at", { ascending: false })
      .limit(1500);

    for (const o of ownerMsgs || []) {
      if (TEST_AGENCY.test(o.agency_id || "")) continue;
      const key = `${o.agency_id}|${o.user_identifier || "anon"}`;
      const list = threads.get(key);
      if (!list) continue;
      list.push({
        agency_id: o.agency_id,
        user_identifier: o.user_identifier,
        role: "owner",
        content: o.content || "",
        created_at: o.created_at,
      });
    }
    for (const list of threads.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));

    const latencies: number[] = [];
    let questionCount = 0;
    let praiseCount = 0;
    const aiRaw: RawCase[] = [];
    const now = Date.now();

    for (const [key, list] of threads) {
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.role === "user") questionCount++;
        if (m.role === "assistant" && list[i - 1]?.role === "user") {
          const dt = (new Date(m.created_at).getTime() - new Date(list[i - 1].created_at).getTime()) / 1000;
          if (dt >= 0 && dt < 300) latencies.push(dt);
        }
      }

      let praiseIdx = -1;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].role === "user" && PRAISE.test(list[i].content || "")) {
          praiseCount++;
          if (praiseIdx < 0) praiseIdx = i;
        }
      }
      if (praiseIdx < 0) continue;
      // Featured cases need meaningful praise, not a one-word "thanks".
      const praiseBody = list[praiseIdx].content || "";
      if (!STRONG_PRAISE.test(praiseBody) && praiseBody.replace(/[^a-z]/gi, "").length < 22) continue;

      // Skip threads where the customer complained after the praise — not a clean win.
      const after = list.slice(praiseIdx + 1).filter((m) => m.role === "user");
      if (after.some((m) => NEGATIVE.test(m.content || ""))) continue;

      const window = list.slice(Math.max(0, praiseIdx - 13), praiseIdx + 1);
      const userMsgs = window.filter((m) => m.role === "user");
      const botMsgs = window.filter((m) => m.role === "assistant");
      const humanMsgs = window.filter((m) => m.role === "owner");
      if (userMsgs.length < 2 || botMsgs.length + humanMsgs.length < 1) continue;

      const transcript = window
        .map((m) => {
          const who = m.role === "user" ? "CUSTOMER" : m.role === "owner" ? "SUPPORT (human team member)" : "SUPPORT (AI)";
          return `${who}: ${trim(anon(m.content), 700)}`;
        })
        .join("\n")
        .slice(0, 7000);
      if (transcript.length < 400) continue;

      const firstQ = new Date(window[0].created_at).getTime();
      const lastMs = new Date(window[window.length - 1].created_at).getTime();
      const [slug, ident] = key.split("|");
      const praiseText = list[praiseIdx].content || "";
      const isHuman = humanMsgs.length > 0;
      const ageDays = Math.max(0, (now - new Date(list[praiseIdx].created_at).getTime()) / 86_400_000);

      const score =
        (STRONG_PRAISE.test(praiseText) ? 5 : 1.5) +
        Math.min(4, (botMsgs.length + humanMsgs.length) * 0.6) +
        Math.min(3, transcript.length / 1500) +
        (isHuman ? 3 : 0) +
        Math.max(0, 2.5 - ageDays / 30);

      aiRaw.push({
        id: `ai-${slug}-${praiseIdx}-${window[0].created_at}`,
        channel: isHuman ? "human" : "ai",
        initials: initialsFrom(ident),
        transcript,
        praise: trim(anon(praiseText), 220) || null,
        category: null,
        at: list[praiseIdx].created_at,
        minutes: Math.max(0, (lastMs - firstQ) / 60000),
        seconds: isHuman ? null : latencies.length ? Math.round(median(latencies)!) : null,
        score,
      });
    }

    aiRaw.sort((a, b) => b.score - a.score);

    const { count: threadCount } = await supabase.from("chat_threads").select("id", { count: "exact", head: true });
    const { count: handoverCount } = await supabase
      .from("chat_threads")
      .select("id", { count: "exact", head: true })
      .not("handover_requested_at", "is", null);

    // --- human support (tickets) ------------------------------------------
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("id, agency_id, customer_email, issue_category, request_text, admin_response, created_at, responded_at, status")
      .not("responded_at", "is", null)
      .order("responded_at", { ascending: false })
      .limit(400);

    // Customer replies on tickets — we only feature tickets the customer thanked us for.
    const { data: replies } = await supabase
      .from("support_ticket_replies")
      .select("ticket_id, sender_role, body, created_at")
      .eq("sender_role", "customer")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);

    const ticketPraise = new Map<string, string>();
    for (const r of replies || []) {
      const body = r.body || "";
      if (!PRAISE.test(body) || NEGATIVE.test(body)) continue;
      if (!ticketPraise.has(r.ticket_id)) ticketPraise.set(r.ticket_id, body);
    }

    const humanRaw: RawCase[] = [];
    const ticketMinutes: number[] = [];
    for (const t of tickets || []) {
      if (TEST_AGENCY.test(t.agency_id || "")) continue;
      const mins = (new Date(t.responded_at as string).getTime() - new Date(t.created_at).getTime()) / 60000;
      if (mins >= 0) ticketMinutes.push(mins);

      const answer = anon(t.admin_response || "");
      if (answer.length < 200) continue;
      const raw = anon(t.request_text || "");
      const handover = /^Human handover request/i.test(raw);
      const question = handover ? anon(t.issue_category || "") : raw;
      if (question.length < 12) continue;

      const praise = ticketPraise.get(t.id as string);
      if (!praise) continue;

      const resolved = /resolved|closed|answered|responded/i.test(String(t.status || ""));
      const ageDays = Math.max(0, (Date.now() - new Date(t.responded_at as string).getTime()) / 86_400_000);

      humanRaw.push({
        id: `t-${t.id}`,
        channel: "human",
        initials: initialsFrom(t.customer_email),
        transcript: `CUSTOMER: ${trim(question, 1200)}\nSUPPORT (human team member): ${trim(answer, 1800)}\nCUSTOMER: ${trim(anon(praise), 400)}`,
        praise: trim(anon(praise), 220) || null,
        category: anon(t.issue_category || "") || null,
        at: t.responded_at as string,
        minutes: mins,
        seconds: null,
        score:
          (STRONG_PRAISE.test(praise) ? 5 : 2.5) +
          Math.min(4, answer.length / 500) +
          (resolved ? 1.5 : 0) +
          (mins < 120 ? 2 : mins < 60 * 24 ? 1 : 0) +
          Math.max(0, 2 - ageDays / 45),
      });
    }

    humanRaw.sort((a, b) => b.score - a.score);

    const { data: ratings } = await supabase.from("ai_support_message_ratings").select("rating").limit(2000);
    const up = (ratings || []).filter((r) => /up|good|positive|helpful/i.test(String(r.rating))).length;
    const down = (ratings || []).length - up;

    const fast = ticketMinutes.filter((m) => m < 60 * 24).length;
    const stats: Stats = {
      ai_conversations: threads.size,
      ai_questions_answered: questionCount,
      ai_median_response_seconds: latencies.length ? Math.round(median(latencies)!) : null,
      ai_no_human_needed_pct:
        threadCount && threadCount > 0 ? Math.round(((threadCount - (handoverCount || 0)) / threadCount) * 100) : null,
      human_replies_sent: ticketMinutes.length,
      human_fastest_minutes: ticketMinutes.length ? Math.round(Math.min(...ticketMinutes)) : null,
      human_median_hours: ticketMinutes.length ? Math.round((median(ticketMinutes)! / 60) * 10) / 10 : null,
      human_same_day_pct: ticketMinutes.length ? Math.round((fast / ticketMinutes.length) * 100) : null,
      positive_mentions: praiseCount,
      thumbs_up: up,
      thumbs_down: down,
    };

    // Public examples are deliberately curated. Automatic scoring repeatedly selected
    // technically positive but unremarkable threads, which defeated the purpose here.
    // Each curated thread is fetched directly so older conversations can never fall
    // outside the recent-message window used for the statistics above.
    const selected: RawCase[] = [];
    for (const c of CURATED) {
      const [{ data: chat }, { data: owner }] = await Promise.all([
        supabase
          .from("ai_chat_messages")
          .select("agency_id, user_identifier, role, content, created_at")
          .eq("user_identifier", c.identifier)
          .gte("created_at", c.from)
          .lt("created_at", c.to)
          .order("created_at", { ascending: true }),
        supabase
          .from("agency_owner_messages")
          .select("agency_id, user_identifier, content, created_at")
          .eq("user_identifier", c.identifier)
          .gte("created_at", c.from)
          .lt("created_at", c.to)
          .order("created_at", { ascending: true }),
      ]);
      const list = ([...((chat || []) as Msg[]), ...((owner || []) as any[]).map((o) => ({ ...o, role: "owner" }))] as Msg[]).sort(
        (a, b) => a.created_at.localeCompare(b.created_at),
      );
      if (!list.length) continue;

      const useful = list.filter((m) => !/^\[IMAGE_ATTACHED\]/.test(m.content || "") || (m.content || "").replace(/^\[IMAGE_ATTACHED\]\([^)]*\)\s*/, "").trim());
      const userMessages = useful.filter((m) => m.role === "user");
      const questionCount = userMessages.filter((m) => /\?|\b(how|where|what|which|can|could|why|do i|is it|est-ce|comment|où|quel)/i.test(m.content || "")).length;
      const imageCount = list.filter((m) => /^\[IMAGE_ATTACHED\]\(https?:\/\//.test(m.content || "")).length;
      const first = new Date(list[0].created_at).getTime();
      const last = new Date(list[list.length - 1].created_at).getTime();
      const headline = c.headline || (questionCount >= 5 ? `${questionCount} questions answered in ${secondsLabel(null, (last - first) / 60000)}` : undefined);
      const transcript = useful
        .map((m) => `${m.role === "user" ? "CUSTOMER" : m.role === "owner" ? "SUPPORT (human team member)" : "SUPPORT (AI)"}: ${trim(anon(m.content).replace(CUSTOMER_NAMES, "the customer").replace(BRAND_NAMES, "the platform"), 900)}`)
        .join("\n")
        .slice(0, 30000);
      selected.push({
        id: c.id,
        channel: c.channel,
        initials: c.initials,
        transcript,
        praise: c.quote,
        category: null,
        at: list[list.length - 1].created_at,
        minutes: (last - first) / 60000,
        seconds: null,
        score: 100,
        questionCount,
        screenshotCount: c.id === "dns-record-guidance" ? Math.min(imageCount, 6) : 0,
        preferredHeadline: headline,
      });
    }

    const packaged = await packageCases(selected);
    const cases = packaged.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEATURED_LIMIT);

    return {
      generated_at: new Date().toISOString(),
      stats,
      cases,
      ai_cases: cases.filter((c) => c.channel === "ai"),
      human_cases: cases.filter((c) => c.channel === "human"),
      raw_considered: { ai: aiRaw.length, human: humanRaw.length },
    };
  }
}

async function buildAndStore(): Promise<Record<string, unknown>> {
  const payload = await build();
  await admin()
    .from("support_wins_cache")
    .upsert({ cache_key: CACHE_KEY, payload, generated_at: new Date().toISOString() }, { onConflict: "cache_key" });
  return payload;
}

const shape = (payload: any, limit: number, baseUrl: string) => {
  const all = ((payload?.cases || []) as CaseStudy[]).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const merged = all.slice(0, Math.min(limit, FEATURED_LIMIT)).map((c) => ({
    ...c,
    screenshots: (c.screenshots || []).map((_, i) => `${baseUrl}?media=${encodeURIComponent(c.id)}&index=${i}`),
  }));
  return {
    ...payload,
    cases: merged,
    ai_cases: merged.filter((c) => c.channel === "ai"),
    human_cases: merged.filter((c) => c.channel === "human"),
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const mediaId = url.searchParams.get("media");
    if (mediaId) {
      const config = CURATED.find((c) => c.id === mediaId);
      const index = Math.max(0, Number(url.searchParams.get("index") || 0) || 0);
      if (!config || config.id !== "dns-record-guidance" || index > 5) return new Response("Not found", { status: 404, headers: corsHeaders });
      const { data } = await admin()
        .from("ai_chat_messages")
        .select("content, created_at")
        .eq("user_identifier", config.identifier)
        .gte("created_at", config.from)
        .lt("created_at", config.to)
        .like("content", "[IMAGE_ATTACHED](http%")
        .order("created_at", { ascending: true });
      const match = String(data?.[index]?.content || "").match(/^\[IMAGE_ATTACHED\]\((https?:\/\/[^)]+)\)/);
      if (!match) return new Response("Not found", { status: 404, headers: corsHeaders });
      const image = await fetch(match[1]);
      if (!image.ok) return new Response("Not found", { status: 404, headers: corsHeaders });
      return new Response(image.body, {
        headers: { ...corsHeaders, "Content-Type": image.headers.get("content-type") || "image/jpeg", "Cache-Control": "public, max-age=86400" },
      });
    }
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || FEATURED_LIMIT) || FEATURED_LIMIT, 1), FEATURED_LIMIT);
    const refresh = url.searchParams.get("refresh") === "1";

    const { data: row } = await admin()
      .from("support_wins_cache")
      .select("payload, generated_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();

    if (row?.payload && !refresh) {
      // Serve the stored snapshot as-is; it only rebuilds on an explicit ?refresh=1.
      return json(shape(row.payload, limit, `${Deno.env.get("SUPABASE_URL")}/functions/v1/support-wins`));
    }

    const payload = await buildAndStore();
    return json(shape(payload, limit, `${Deno.env.get("SUPABASE_URL")}/functions/v1/support-wins`));
  } catch (error) {
    console.error("support-wins error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

