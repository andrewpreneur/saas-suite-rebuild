// Channel-agnostic proactive CoPilot outreach ("nudges").
//
// This module holds ALL the logic that is not specific to a delivery channel:
//   - account snapshot building
//   - preferred send-time inference (from the owner's own login history)
//   - working-hours + frequency scheduling
//   - AI generation of the digest + recommendations
//   - topic memory (declined / snoozed suggestions are never re-suggested)
//   - delivery through pluggable channel adapters (slack, sms, email)
//
// Adding a new channel = adding one adapter in `deliver()`. Nothing else changes.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getInstallByAgency } from "./slack-workspace.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

export type Channel = "slack" | "sms" | "email";

export interface NudgeSettings {
  owner_email: string;
  enabled: boolean;
  channels: Channel[];
  frequency: "daily" | "weekly" | "biweekly";
  tz_offset_minutes: number;
  work_hour_start: number;
  work_hour_end: number;
  preferred_hour_local: number | null;
  preferred_dow: number | null;
  sms_outbound_webhook_url: string | null;
  email_outbound_webhook_url: string | null;
  paused_until: string | null;
  last_sent_at: string | null;
  next_due_at: string | null;
}

export interface Snapshot {
  plan: string;
  agency_name: string | null;
  first_name: string | null;
  agency_ids: string[];
  hub_users_total: number;
  hub_users_active_7d: number;
  hub_users_new_7d: number;
  hub_users_added_since_last_nudge: number;
  seat_limit: number | null;
  workflows_configured: number;
  branding_set: boolean;
  support_ticketing_set: boolean;
  ai_chat_enabled: boolean;
  install_confirmed: boolean;
  open_tickets: number;
  ai_messages_7d: number;
  owner_logins_7d: number;
  owner_last_login_at: string | null;
  slack_connected: boolean;
  declined_topics: string[];
  snoozed_topics: string[];
  last_nudge_at: string | null;
  last_nudge_headline: string | null;
  last_nudge_body: string | null;
  last_nudge_recommendations: string[];
  last_owner_reply: string | null;
  /** How many of the most recent check-ins went unanswered (0 = they replied). */
  unanswered_nudges: number;
  /** True when the last check-in asked something and never got a reply. */
  awaiting_reply: boolean;
  challenge: ChallengeStanding | null;
}

/** Where this owner stands in the Move Your SaaS Challenge. */
export interface ChallengeStanding {
  name: string;
  entered: boolean;
  starts_on: string;
  ends_on: string;
  winners_announced: string;
  ticket_bonus_cutoff: string;
  prizes: string;
  points: number;
  rank: number | null;
  entrants: number;
  points_behind_first: number | null;
  points_behind_third: number | null;
  points_to_next_rank: number | null;
  days_remaining: number;
  breakdown: Record<string, unknown> | null;
  point_rules: string[];
}

// ---------------------------------------------------------------- settings ---

export function normalizeSettings(row: any): NudgeSettings {
  const rawChannels = Array.isArray(row?.channels) ? row.channels : ["slack"];
  const channels = rawChannels
    .map((c: unknown) => String(c).toLowerCase())
    .filter((c: string): c is Channel => c === "slack" || c === "sms" || c === "email");
  return {
    owner_email: String(row.owner_email).toLowerCase(),
    enabled: row.enabled !== false,
    channels: channels.length ? channels : ["slack"],
    frequency: (row.frequency ?? "weekly") as NudgeSettings["frequency"],
    tz_offset_minutes: Number.isFinite(row.tz_offset_minutes) ? row.tz_offset_minutes : -300,
    work_hour_start: Number.isFinite(row.work_hour_start) ? row.work_hour_start : 9,
    work_hour_end: Number.isFinite(row.work_hour_end) ? row.work_hour_end : 17,
    preferred_hour_local: row.preferred_hour_local ?? null,
    preferred_dow: row.preferred_dow ?? 1,
    sms_outbound_webhook_url: row.sms_outbound_webhook_url ?? null,
    email_outbound_webhook_url: row.email_outbound_webhook_url ?? null,
    paused_until: row.paused_until ?? null,
    last_sent_at: row.last_sent_at ?? null,
    next_due_at: row.next_due_at ?? null,
  };
}

// ------------------------------------------------------------- send timing ---

/** Local wall-clock parts for an instant, using a fixed UTC offset. */
export function localParts(at: Date, tzOffsetMinutes: number) {
  const shifted = new Date(at.getTime() + tzOffsetMinutes * 60_000);
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    dow: shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(), // 1=Mon .. 7=Sun
    date: shifted,
  };
}

/**
 * Infer the hour of day (owner-local) when this owner is most often at their
 * computer, from their own platform login history. Falls back to last login,
 * then to 10am. Always clamped inside the working-hours window.
 */
export async function inferPreferredHourLocal(
  ownerEmail: string,
  s: Pick<NudgeSettings, "tz_offset_minutes" | "work_hour_start" | "work_hour_end" | "preferred_hour_local">,
): Promise<number> {
  const clamp = (h: number) => Math.min(Math.max(h, s.work_hour_start), Math.max(s.work_hour_start, s.work_hour_end - 1));
  if (s.preferred_hour_local != null) return clamp(s.preferred_hour_local);

  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("platform_events")
    .select("created_at")
    .eq("user_email", ownerEmail)
    .in("trigger_type", ["existing_user_login", "new_user_login"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const buckets = new Map<number, number>();
  for (const row of data ?? []) {
    const { hour } = localParts(new Date(row.created_at), s.tz_offset_minutes);
    if (hour < s.work_hour_start || hour >= s.work_hour_end) continue; // only count working-hours activity
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  }
  if (buckets.size) {
    const best = [...buckets.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    return clamp(best);
  }

  const { data: user } = await supabase
    .from("saas_suite_users")
    .select("last_login_at")
    .ilike("email", ownerEmail)
    .maybeSingle();
  if (user?.last_login_at) {
    const { hour } = localParts(new Date(user.last_login_at), s.tz_offset_minutes);
    return clamp(hour);
  }
  return clamp(10);
}

/** Next send instant (UTC) after `from`, honoring frequency, day and hour. */
export function computeNextDueAt(s: NudgeSettings, preferredHourLocal: number, from = new Date()): Date {
  const stepDays = s.frequency === "daily" ? 1 : s.frequency === "biweekly" ? 14 : 7;
  const targetDow = s.frequency === "daily" ? null : (s.preferred_dow ?? 1);

  // Walk forward day by day (max 30) until we land on an allowed slot in the future.
  for (let i = 0; i <= 30; i++) {
    const probe = new Date(from.getTime() + i * 86_400_000);
    const parts = localParts(probe, s.tz_offset_minutes);
    if (parts.dow >= 6) continue;                       // never weekends
    if (targetDow != null && i > 0 && parts.dow !== targetDow) continue;
    if (targetDow != null && i === 0 && parts.dow !== targetDow) continue;

    // Build the instant for that local date at the preferred local hour.
    const localMidnight = Date.UTC(
      parts.date.getUTCFullYear(),
      parts.date.getUTCMonth(),
      parts.date.getUTCDate(),
    );
    const candidate = new Date(localMidnight + preferredHourLocal * 3_600_000 - s.tz_offset_minutes * 60_000);
    if (candidate.getTime() > from.getTime() + 60_000) return candidate;
  }
  return new Date(from.getTime() + stepDays * 86_400_000);
}

/** Is now an acceptable moment to reach out? (working hours, weekday, not paused) */
export function withinSendWindow(s: NudgeSettings, now = new Date()): { ok: boolean; reason?: string } {
  if (!s.enabled) return { ok: false, reason: "disabled" };
  if (s.paused_until && new Date(s.paused_until) > now) return { ok: false, reason: "paused" };
  const { hour, dow } = localParts(now, s.tz_offset_minutes);
  if (dow >= 6) return { ok: false, reason: "weekend" };
  if (hour < s.work_hour_start || hour >= s.work_hour_end) return { ok: false, reason: "outside working hours" };
  return { ok: true };
}

// --------------------------------------------------------------- challenge ---

// Keep in sync with src/constants/giveaway.ts (GIVEAWAY_END_ISO) and public.giveaway_recalculate().
// Deno cannot import the Vite constant, so these literals must match 2026-10-26T04:59:00Z.
// winners_announced keeps the pre-#72 nudge wording ("October 26, 2026"); the UI label adds the weekday.
const CHALLENGE = {
  name: "Move Your SaaS Challenge",
  starts_on: "August 17, 2026",
  ends_on: "Sunday, October 25, 2026 at 11:59 p.m. CT",
  end_iso: "2026-10-26T04:59:00Z",
  winners_announced: "October 26, 2026",
  ticket_bonus_cutoff: "Sunday, October 25, 2026 at 11:59 p.m. CT",
  prizes: "1st $5,000 · 2nd $3,000 · 3rd $2,000 (plus a shot at a free LevelUp ticket for the top 3 when the challenge ends)",
  point_rules: [
    "1 pt for every net-new end user you onboard after entering",
    "1 pt per training video an end user completes",
    "1 pt per onboarding checklist an end user finishes",
    "1 pt per end user per day they log into your hub",
    "20 pts one-time for installing the SaaSSuite Slack app",
  ],
};

async function buildChallengeStanding(ownerEmail: string): Promise<ChallengeStanding | null> {
  const [{ data: mine }, { data: board }] = await Promise.all([
    supabase
      .from("giveaway_entries")
      .select("points, breakdown, rules_accepted_at")
      .ilike("email", ownerEmail)
      .maybeSingle(),
    supabase.from("giveaway_entries").select("email, points").order("points", { ascending: false }).limit(1000),
  ]);

  const rows = (board ?? []) as { email: string; points: number }[];
  const days = Math.max(0, Math.ceil((new Date(CHALLENGE.end_iso).getTime() - Date.now()) / 86_400_000));
  const base = {
    name: CHALLENGE.name,
    starts_on: CHALLENGE.starts_on,
    ends_on: CHALLENGE.ends_on,
    winners_announced: CHALLENGE.winners_announced,
    ticket_bonus_cutoff: CHALLENGE.ticket_bonus_cutoff,
    prizes: CHALLENGE.prizes,
    entrants: rows.length,
    days_remaining: days,
    point_rules: CHALLENGE.point_rules,
  };

  if (!mine) {
    return {
      ...base,
      entered: false,
      points: 0,
      rank: null,
      points_behind_first: rows[0]?.points ?? null,
      points_behind_third: rows[2]?.points ?? null,
      points_to_next_rank: null,
      breakdown: null,
    };
  }

  const points = Number(mine.points ?? 0);
  const idx = rows.findIndex((r) => (r.email ?? "").toLowerCase() === ownerEmail.toLowerCase());
  const rank = idx >= 0 ? idx + 1 : null;
  const ahead = rank && rank > 1 ? rows[rank - 2] : null;
  return {
    ...base,
    entered: true,
    points,
    rank,
    points_behind_first: rows[0] ? Math.max(0, rows[0].points - points) : null,
    points_behind_third: rows[2] ? Math.max(0, rows[2].points - points) : null,
    points_to_next_rank: ahead ? Math.max(0, ahead.points - points) + 1 : null,
    breakdown: (mine.breakdown as Record<string, unknown>) ?? null,
  };
}

// ---------------------------------------------------------------- snapshot ---


export async function buildSnapshot(ownerEmail: string): Promise<Snapshot> {
  const { data: me } = await supabase
    .from("saas_suite_users")
    .select(
      "full_name, agency_name, plan, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, support_webhook_url, generated_css, primary_color, max_onboarding_users, last_login_at, install_confirmed_at",
    )
    .ilike("email", ownerEmail)
    .maybeSingle();

  const agencyIds = Array.from(
    new Set(
      [me?.agency_id, me?.agency_id_basic, me?.agency_id_advanced, me?.agency_id_elite]
        .filter(Boolean) as string[],
    ),
  );

  const iso7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [progress, workflows, tickets, aiMsgs, ownerLogins, slackInstall, topics, recentNudges, homeSettings, challenge] =
    await Promise.all([
      agencyIds.length
        ? supabase.from("user_progress").select("email, last_accessed, created_at").in("agency_id", agencyIds)
        : Promise.resolve({ data: [] as any[] }),
      agencyIds.length
        ? supabase.from("workflows").select("enabled, webhook_url").in("agency_id", agencyIds)
        : Promise.resolve({ data: [] as any[] }),
      agencyIds.length
        ? supabase.from("support_tickets").select("status").in("agency_id", agencyIds).limit(5000)
        : Promise.resolve({ data: [] as any[] }),
      agencyIds.length
        ? supabase
            .from("ai_chat_messages")
            .select("*", { count: "exact", head: true })
            .in("agency_id", agencyIds)
            .gte("created_at", iso7)
        : Promise.resolve({ count: 0 } as any),
      supabase
        .from("platform_events")
        .select("*", { count: "exact", head: true })
        .eq("user_email", ownerEmail)
        .in("trigger_type", ["existing_user_login", "new_user_login"])
        .gte("created_at", iso7),
      agencyIds.length ? getInstallByAgency(agencyIds[0]) : Promise.resolve(null),
      supabase.from("copilot_nudge_topics").select("topic, stance, snooze_until").eq("owner_email", ownerEmail),
      supabase
        .from("copilot_nudges")
        .select("created_at, headline, body, recommendations, response_text")
        .eq("owner_email", ownerEmail)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(5),
      agencyIds.length
        ? supabase.from("v2_home_settings").select("ai_chat_enabled").in("agency_id", agencyIds).limit(10)
        : Promise.resolve({ data: [] as any[] }),
      buildChallengeStanding(ownerEmail),
    ]);


  const rows = (progress as any).data ?? [];
  const nudgeHistory = (((recentNudges as any).data ?? []) as any[]);
  const lastNudge = nudgeHistory[0] ?? null;
  const lastNudgeAt = lastNudge?.created_at ?? null;
  // How many of the most recent check-ins in a row went unanswered.
  let unanswered = 0;
  for (const n of nudgeHistory) {
    if (n?.response_text && String(n.response_text).trim()) break;
    unanswered++;
  }
  const declined: string[] = [];
  const snoozed: string[] = [];
  for (const t of ((topics as any).data ?? []) as any[]) {
    if (t.stance === "declined") declined.push(t.topic);
    else if (t.stance === "snoozed" && (!t.snooze_until || new Date(t.snooze_until) > new Date())) snoozed.push(t.topic);
  }
  const lastReply = nudgeHistory.find((n) => n?.response_text && String(n.response_text).trim())?.response_text ?? null;


  return {
    plan: (me?.plan ?? "STARTER").toString().toUpperCase(),
    agency_name: me?.agency_name ?? null,
    first_name: ((me?.full_name ?? "").trim().split(/\s+/)[0]) || null,
    agency_ids: agencyIds,
    hub_users_total: rows.length,
    hub_users_active_7d: rows.filter((u: any) => u.last_accessed && u.last_accessed >= iso7).length,
    hub_users_new_7d: rows.filter((u: any) => u.created_at && u.created_at >= iso7).length,
    hub_users_added_since_last_nudge: lastNudgeAt
      ? rows.filter((u: any) => u.created_at && u.created_at >= lastNudgeAt).length
      : rows.length,
    seat_limit: me?.max_onboarding_users ?? null,
    workflows_configured: (((workflows as any).data ?? []) as any[]).filter((w: any) => w.enabled && w.webhook_url).length,
    branding_set: !!(me?.generated_css || me?.primary_color),
    support_ticketing_set: !!me?.support_webhook_url,
    ai_chat_enabled: (((homeSettings as any).data ?? []) as any[]).some((r: any) => r.ai_chat_enabled),
    install_confirmed: !!me?.install_confirmed_at,
    open_tickets: (((tickets as any).data ?? []) as any[]).filter((t: any) =>
      ["open", "new", "waiting"].includes(String(t.status ?? "").toLowerCase())
    ).length,
    ai_messages_7d: (aiMsgs as any).count ?? 0,
    owner_logins_7d: (ownerLogins as any).count ?? 0,
    owner_last_login_at: me?.last_login_at ?? null,
    slack_connected: !!slackInstall,
    declined_topics: declined,
    snoozed_topics: snoozed,
    last_nudge_at: lastNudgeAt,
    last_nudge_headline: lastNudge?.headline ?? null,
    last_nudge_body: lastNudge?.body ?? null,
    last_nudge_recommendations: Array.isArray(lastNudge?.recommendations)
      ? lastNudge.recommendations.map((r: any) => r?.title ?? String(r))
      : [],
    last_owner_reply: lastReply,
    unanswered_nudges: unanswered,
    awaiting_reply: unanswered > 0 && !!lastNudge,
    challenge: challenge as ChallengeStanding | null,
  };
}

// -------------------------------------------------------------- generation ---

export interface Recommendation {
  topic: string;   // stable slug used for topic memory, e.g. "enable-ai-chat"
  title: string;
  why: string;
  link?: string;
}

export interface GeneratedNudge {
  headline: string;
  body: string;
  recommendations: Recommendation[];
}

const NUDGE_SYSTEM = `You are the SaaSSuite AI CoPilot, messaging a SaaSSuite agency owner like a friendly teammate who
actually knows their account. SaaSSuite lets agencies white-label a GoHighLevel onboarding hub for their clients.

Sound like a person, not software. Short. Warm. Positive first.

How to write it:
- Open like a human would: "Hey {first_name}, hope your week's going well" / "What's up {first_name}" / "Morning {first_name}!" — vary it, keep it one short line.
- Then something GENUINELY POSITIVE and real from the snapshot (progress, a number that moved, users active, points earned, anything working). Always lead with a win before any gap.
- Never open with a problem, a warning, or something they haven't done. If something needs fixing, frame it as the next easy win, never as criticism.
- Then 1-2 concrete next steps, most impactful first. Max 2. Keep each to a single line.
- End with ONE short question so they can just reply here.
- 70 words MAX for the body. It must fit on a phone screen with no scrolling. Short sentences, no bullet walls, no headings, at most 1 emoji.
- Never invent numbers or facts that aren't in the snapshot.
- NEVER suggest anything whose topic is in declined_topics or snoozed_topics.
- Don't repeat a recommendation from last_nudge_recommendations unless it's still undone AND it's clearly the top item.

Following up on silence (important):
- If awaiting_reply is true, this message is a FOLLOW-UP, not a fresh pitch. Start friendly and reference the last one: "Hey, did you get a chance to look at my last note about X?" — name the actual thing from last_nudge_headline / last_nudge_recommendations. Stay light and never guilt-trip them.
- If unanswered_nudges is 2 or more, keep it even shorter and easier to answer — a single yes/no question is ideal, and offer to drop the topic if it isn't a priority.

The Move Your SaaS Challenge (use snapshot.challenge when it's present):
- If challenge.entered is true: they're in it. You know their points, rank, entrant count, and how far they are from 1st/3rd/the next spot. Mention where they stand positively, then give them the fastest realistic way to earn more points from challenge.point_rules — tie it to their own breakdown (e.g. Slack app not installed = 20 pts, more end users logging in = 1 pt per user per day). Mention days_remaining or the key dates only when it's genuinely motivating.
- If challenge.entered is false: mention the challenge, the prizes, and that entering starts their scoring clock — but only when it's the most useful thing to say.
- Never state challenge facts, dates, or point values not in snapshot.challenge.

Useful links: dashboard https://saassuite.ai/app · branding https://saassuite.ai/app/branding · support setup https://saassuite.ai/app/support · workflows https://saassuite.ai/app/workflows · install guide https://saassuite.ai/app/install · challenge https://saassuite.ai/challenge

Return ONLY JSON:
{"headline":"short friendly subject line","body":"...","recommendations":[{"topic":"kebab-case-slug","title":"...","why":"one short line","link":"optional url"}]}`;

export async function generateNudge(snapshot: Snapshot, variantHint?: string): Promise<GeneratedNudge> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: NUDGE_SYSTEM },
        {
          role: "user",
          content:
            `Account snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\n` +
            (variantHint ? `Tone/angle for this message: ${variantHint}\n\n` : "") +
            `Write this check-in now.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  let parsed: any = {};
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    const m = String(raw).match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }

  const blocked = new Set([...snapshot.declined_topics, ...snapshot.snoozed_topics]);
  const recommendations: Recommendation[] = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
    .map((r: any) => ({
      topic: String(r?.topic ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: String(r?.title ?? "").trim(),
      why: String(r?.why ?? "").trim(),
      link: r?.link ? String(r.link) : undefined,
    }))
    .filter((r: Recommendation) => r.topic && r.title && !blocked.has(r.topic))
    .slice(0, 2);

  return {
    headline: String(parsed.headline ?? "Your SaaSSuite check-in").trim().slice(0, 140),
    body: String(parsed.body ?? "").trim(),
    recommendations,
  };
}

// ---------------------------------------------------------------- delivery ---

export function renderPlainText(n: GeneratedNudge): string {
  const lines = [n.body.trim()];
  if (n.recommendations.length) {
    lines.push("");
    n.recommendations.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.title}${r.why ? ` — ${r.why}` : ""}${r.link ? ` (${r.link})` : ""}`);
    });
  }
  lines.push("");
  lines.push("Just reply here — happy to help, or tell me to skip it.");
  return lines.join("\n");
}

function slackBlocks(n: GeneratedNudge) {
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: `👋 ${n.headline}`.slice(0, 150), emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: n.body.slice(0, 2800) } },
  ];
  if (n.recommendations.length) {
    blocks.push({ type: "divider" });
    for (const r of n.recommendations) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${r.title}*${r.why ? `\n${r.why}` : ""}${r.link ? `\n<${r.link}|Open>` : ""}`.slice(0, 2800),
        },
      });
    }
  }
  blocks.push({
    type: "context",
    elements: [{
      type: "mrkdwn",
      text: "_Reply in this thread (or `/copilot <message>`) — I read replies and remember what you don't want._",
    }],
  });
  return blocks;
}

export interface DeliveryResult {
  channel: Channel;
  ok: boolean;
  error?: string;
  slack_channel_id?: string;
  slack_ts?: string;
}

export async function deliver(
  channel: Channel,
  s: NudgeSettings,
  snapshot: Snapshot,
  n: GeneratedNudge,
): Promise<DeliveryResult> {
  const text = renderPlainText(n);

  if (channel === "slack") {
    const agencyId = snapshot.agency_ids[0];
    const install = agencyId ? await getInstallByAgency(agencyId) : null;
    if (!install?.slack_channel_id) return { channel, ok: false, error: "No active Slack install/channel" };
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${install.bot_token}`,
      },
      body: JSON.stringify({
        channel: install.slack_channel_id,
        text: `${n.headline}\n\n${text}`.slice(0, 3000),
        blocks: slackBlocks(n),
      }),
    });
    const j = await res.json().catch(() => ({} as any));
    if (!res.ok || !j?.ok) {
      return { channel, ok: false, error: `slack ${res.status}: ${j?.error ?? "unknown"}` };
    }
    return { channel, ok: true, slack_channel_id: install.slack_channel_id, slack_ts: j.ts };
  }

  // sms / email: generic outbound webhook so the transport can be swapped
  // (e.g. a GoHighLevel inbound webhook that sends the text or the email).
  const url = channel === "sms" ? s.sms_outbound_webhook_url : s.email_outbound_webhook_url;
  if (!url) return { channel, ok: false, error: `No outbound ${channel} webhook configured` };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel,
      owner_email: s.owner_email,
      first_name: snapshot.first_name,
      agency_name: snapshot.agency_name,
      subject: n.headline,
      message: text,
      recommendations: n.recommendations,
      reply_hint: "Reply to this message to talk to your AI CoPilot.",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { channel, ok: false, error: `${channel} webhook ${res.status}: ${body.slice(0, 300)}` };
  }
  return { channel, ok: true };
}

// ------------------------------------------------------------ topic memory ---

const DECLINE_RE = /\b(no thanks|not interested|don'?t want|do not want|skip (it|that|this)|stop suggesting|not now|leave it|already did|already done|drop it|never mind|pass)\b/i;
const SNOOZE_RE = /\b(later|next (week|month)|remind me|not (this|right) (week|now)|busy|after)\b/i;

/**
 * Record how the owner reacted to the recommendations in a nudge, so declined
 * ideas are never suggested again and snoozed ones come back later.
 */
export async function recordReplyStance(
  ownerEmail: string,
  recommendations: Recommendation[],
  replyText: string,
) {
  const text = String(replyText || "");
  if (!text.trim() || !recommendations.length) return;

  const declined = DECLINE_RE.test(text);
  const snoozed = !declined && SNOOZE_RE.test(text);
  if (!declined && !snoozed) return;

  // Which topics is the reply about? If they name one, only that one.
  const named = recommendations.filter((r) => {
    const words = r.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return words.some((w) => text.toLowerCase().includes(w)) || text.toLowerCase().includes(r.topic.replace(/-/g, " "));
  });
  const targets = named.length ? named : recommendations;

  const rows = targets.map((r) => ({
    owner_email: ownerEmail,
    topic: r.topic,
    stance: declined ? "declined" : "snoozed",
    note: text.slice(0, 500),
    snooze_until: snoozed ? new Date(Date.now() + 21 * 86_400_000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("copilot_nudge_topics").upsert(rows, { onConflict: "owner_email,topic" });
  if (error) console.error("recordReplyStance failed:", error.message);
}

// ------------------------------------------------------------------- locks ---

export async function acquireLock(job: string, ttlSeconds = 300): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const { data: existing } = await supabase
    .from("copilot_nudge_locks")
    .select("locked_until")
    .eq("job", job)
    .maybeSingle();
  if (existing && new Date(existing.locked_until) > now) return false;
  const { error } = await supabase
    .from("copilot_nudge_locks")
    .upsert({ job, locked_until: until, locked_at: now.toISOString() }, { onConflict: "job" });
  if (error) {
    console.error("acquireLock failed:", error.message);
    return false;
  }
  return true;
}

export async function releaseLock(job: string) {
  await supabase.from("copilot_nudge_locks").update({ locked_until: new Date().toISOString() }).eq("job", job);
}
