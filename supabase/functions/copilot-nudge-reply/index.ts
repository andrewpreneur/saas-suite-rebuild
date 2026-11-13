// Inbound side of proactive CoPilot outreach — channel agnostic.
//
// Any channel can hand a free-text reply to this endpoint:
//   Slack   -> slack-provision forwards `message` / `app_mention` events
//   SMS     -> point the provider's inbound webhook here (channel: "sms")
//   Email   -> point the parser webhook here (channel: "email")
//
// It resolves the owner, remembers how they reacted to the last set of
// recommendations (declined ideas are never suggested again), runs the same
// CoPilot brain used in the dashboard so the conversation stays in one thread,
// and replies back on the channel the message came from.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildSnapshot, recordReplyStance, supabase, type Channel } from "../_shared/nudge-core.ts";
import { getInstallByAgency, getInstallByTeam } from "../_shared/slack-workspace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-cron-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_TOKEN = Deno.env.get("NUDGE_CRON_TOKEN") ?? "";

function authorized(req: Request): boolean {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const key = (req.headers.get("x-cron-key") ?? req.headers.get("x-api-key") ?? "").trim();
  const presented = key || bearer;
  if (!presented) return false;
  return presented === SERVICE_ROLE || (!!CRON_TOKEN && presented === CRON_TOKEN);
}

interface Body {
  text?: string;
  message?: string;
  channel?: Channel;
  owner_email?: string;
  from?: string;              // sms: phone / email: sender — used for lookup fallback
  slack_team_id?: string;
  slack_channel_id?: string;
  slack_thread_ts?: string;
  slack_user_name?: string;
  nudge_id?: string;
}

async function resolveOwnerEmail(b: Body): Promise<string | null> {
  if (b.owner_email) return b.owner_email.toLowerCase().trim();
  if (b.from && b.from.includes("@")) {
    const { data } = await supabase
      .from("saas_suite_users")
      .select("email")
      .ilike("email", b.from.trim())
      .maybeSingle();
    if (data?.email) return data.email.toLowerCase();
  }
  if (b.slack_team_id) {
    const { data: link } = await supabase
      .from("slack_workspace_links")
      .select("linked_by_email")
      .eq("slack_team_id", b.slack_team_id)
      .maybeSingle();
    if (link?.linked_by_email) return String(link.linked_by_email).toLowerCase();

    const install = await getInstallByTeam(b.slack_team_id);
    if (install?.agency_id) {
      const { data: owner } = await supabase
        .from("saas_suite_users")
        .select("email")
        .or(
          [
            `agency_id.eq.${install.agency_id}`,
            `agency_id_basic.eq.${install.agency_id}`,
            `agency_id_advanced.eq.${install.agency_id}`,
            `agency_id_elite.eq.${install.agency_id}`,
          ].join(","),
        )
        .limit(1)
        .maybeSingle();
      if (owner?.email) return String(owner.email).toLowerCase();
    }
  }
  return null;
}

async function askCopilot(ownerEmail: string, userText: string, contextNote: string): Promise<string> {
  const { data: history } = await supabase
    .from("copilot_chat_messages")
    .select("role, content, created_at")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(20);
  const prior = (history ?? [])
    .reverse()
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({ role: m.role, content: m.content ?? "" }));

  const messages = [
    ...prior,
    { role: "user", content: `${contextNote}${userText}` },
  ];

  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    body: JSON.stringify({ messages, userEmail: ownerEmail, client: "nudge" }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`chat-copilot ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).filter(Boolean).join("\n");
    if (joined.trim()) return joined.trim();
  }
  return "I got your message but came back empty — mind rephrasing that?";
}

async function replyOnChannel(
  channel: Channel,
  ownerEmail: string,
  text: string,
  b: Body,
): Promise<{ ok: boolean; error?: string }> {
  if (channel === "slack") {
    // Prefer the workspace the message came from; fall back to the owner's own install.
    let install = b.slack_team_id ? await getInstallByTeam(b.slack_team_id) : null;
    if (!install?.bot_token) {
      const { data: owner } = await supabase
        .from("saas_suite_users")
        .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
        .ilike("email", ownerEmail)
        .maybeSingle();
      for (const id of [owner?.agency_id, owner?.agency_id_advanced, owner?.agency_id_elite, owner?.agency_id_basic]) {
        if (!id) continue;
        install = await getInstallByAgency(id as string);
        if (install?.bot_token) break;
      }
    }
    const channelId = b.slack_channel_id ?? install?.slack_channel_id;
    if (!install?.bot_token || !channelId) return { ok: false, error: "No Slack install/channel" };
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${install.bot_token}`,
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: b.slack_thread_ts ?? undefined,
        text: text.slice(0, 3000),
      }),
    });
    const j = await res.json().catch(() => ({} as any));
    if (!res.ok || !j?.ok) return { ok: false, error: `slack ${res.status}: ${j?.error ?? "unknown"}` };
    return { ok: true };
  }

  const { data: settings } = await supabase
    .from("copilot_nudge_settings")
    .select("sms_outbound_webhook_url, email_outbound_webhook_url")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  const url = channel === "sms" ? settings?.sms_outbound_webhook_url : settings?.email_outbound_webhook_url;
  if (!url) return { ok: false, error: `No outbound ${channel} webhook configured` };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel,
      owner_email: ownerEmail,
      subject: "Your AI CoPilot",
      message: text,
      is_reply: true,
    }),
  });
  if (!res.ok) return { ok: false, error: `${channel} webhook ${res.status}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const text = String(b.text ?? b.message ?? "").trim();
  if (!text) return json({ error: "text is required" }, 400);
  const channel: Channel = (b.channel ?? "slack") as Channel;

  const ownerEmail = await resolveOwnerEmail(b);
  if (!ownerEmail) {
    return json({ error: "Could not resolve the account for this reply", hint: "pass owner_email" }, 404);
  }

  // Which nudge is this replying to?
  let nudgeQuery = supabase
    .from("copilot_nudges")
    .select("id, recommendations, headline, slack_ts, created_at")
    .eq("owner_email", ownerEmail)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1);
  if (b.nudge_id) nudgeQuery = supabase
    .from("copilot_nudges")
    .select("id, recommendations, headline, slack_ts, created_at")
    .eq("id", b.nudge_id)
    .limit(1);
  else if (b.slack_thread_ts) nudgeQuery = supabase
    .from("copilot_nudges")
    .select("id, recommendations, headline, slack_ts, created_at")
    .eq("owner_email", ownerEmail)
    .eq("slack_ts", b.slack_thread_ts)
    .limit(1);
  const { data: nudgeRows } = await nudgeQuery;
  const nudge = nudgeRows?.[0] ?? null;

  const recs = Array.isArray(nudge?.recommendations) ? (nudge!.recommendations as any[]) : [];
  const isFresh = nudge?.created_at
    ? Date.now() - new Date(nudge.created_at).getTime() < 7 * 86_400_000
    : false;

  // Remember declines / snoozes before answering, so the answer respects them.
  if (nudge && isFresh) {
    await recordReplyStance(ownerEmail, recs as any, text);
    await supabase
      .from("copilot_nudges")
      .update({ response_text: text.slice(0, 2000), response_channel: channel, responded_at: new Date().toISOString() })
      .eq("id", nudge.id);
  }

  // Challenge standing, so Slack/SMS replies can coach them on points too.
  let challengeNote = "";
  try {
    const snap = await buildSnapshot(ownerEmail);
    const c = snap.challenge;
    if (c?.entered) {
      challengeNote =
        `[Move Your SaaS Challenge: they ARE entered. ${c.points} pts, rank ${c.rank ?? "?"} of ${c.entrants}, ` +
        `${c.points_behind_first ?? "?"} pts behind 1st, ${c.points_behind_third ?? "?"} behind 3rd, ` +
        `${c.days_remaining} days left (ends ${c.ends_on}, winners ${c.winners_announced}, LevelUp ticket cutoff ${c.ticket_bonus_cutoff}). ` +
        `Prizes: ${c.prizes}. Ways to earn: ${c.point_rules.join("; ")}. Breakdown: ${JSON.stringify(c.breakdown)}. ` +
        `If they ask about the challenge, or a point-earning idea fits naturally, use these real numbers — never invent any.]\n`;
    } else if (c) {
      challengeNote =
        `[Move Your SaaS Challenge: they are NOT entered yet. Prizes: ${c.prizes}. Ends ${c.ends_on}. ` +
        `Entering starts their scoring clock; nothing before entry is backfilled. Sign-up: https://saassuite.ai/challenge]\n`;
    }
  } catch (_e) { /* challenge context is optional */ }

  const toneNote =
    `[Tone: talk like a friendly human teammate, not a bot. Lead with something positive before any gap. ` +
    `Keep it under 90 words, plain sentences, no walls of text, at most 1 emoji.]\n`;

  const contextNote = (nudge && isFresh
    ? `[Replying via ${channel} to your proactive check-in "${nudge.headline}" which recommended: ${
      recs.map((r: any) => r?.title ?? r?.topic).filter(Boolean).join("; ") || "(none)"
    }. If they decline a recommendation, acknowledge it in one line and confirm you won't bring it up again.]\n`
    : `[Replying via ${channel}.]\n`) + challengeNote + toneNote + "\n";

  let reply: string;
  try {
    reply = await askCopilot(ownerEmail, text, contextNote);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("copilot-nudge-reply failed:", msg);
    return json({ error: "CoPilot failed", details: msg }, 502);
  }

  const delivered = await replyOnChannel(channel, ownerEmail, reply, b);
  return json({
    ok: delivered.ok,
    owner_email: ownerEmail,
    nudge_id: nudge?.id ?? null,
    reply,
    delivery_error: delivered.error ?? null,
  });
});
