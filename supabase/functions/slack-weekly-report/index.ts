import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Install = {
  id: string;
  agency_id: string;
  slack_channel_id: string | null;
  bot_token: string | null;
  webhook_url?: string | null;
};

const WEEK_MS = 7 * 86400_000;

function isUnanswered(t: any) {
  return !t.responded_at && !(t.admin_response && String(t.admin_response).trim().length > 0);
}

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

/** All agency ids that belong to the same owner as this install. */
async function siblingAgencyIds(agencyId: string): Promise<string[]> {
  const clean = agencyId.replace(/NO$/i, "");
  const { data: owner } = await supabase
    .from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .or(
      `agency_id.eq.${clean},agency_id_basic.eq.${clean},agency_id_advanced.eq.${clean},agency_id_elite.eq.${clean}`,
    )
    .limit(1)
    .maybeSingle();
  return Array.from(
    new Set(
      [
        clean,
        owner?.agency_id,
        owner?.agency_id_basic,
        owner?.agency_id_advanced,
        owner?.agency_id_elite,
      ].filter(Boolean) as string[],
    ),
  );
}

async function buildReport(agencyIds: string[]) {
  const since = new Date(Date.now() - WEEK_MS).toISOString();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select(
      "id, ticket_number, issue_category, request_text, status, created_at, updated_at, responded_at, admin_response, customer_name, customer_email",
    )
    .in("agency_id", agencyIds)
    .order("created_at", { ascending: true })
    .limit(1000);

  const all = tickets || [];
  const open = all.filter((t) => t.status === "open" || t.status === "in_progress");
  const responded = all.filter((t) => t.status === "responded");
  const unanswered = open.filter(isUnanswered);
  const newThisWeek = all.filter((t) => t.created_at >= since);
  const closedThisWeek = all.filter(
    (t) => t.status === "completed" && (t.updated_at || t.created_at) >= since,
  );

  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id, user_identifier, handover_requested_at, handover_resolved_at, last_owner_message_at")
    .in("agency_id", agencyIds)
    .not("handover_requested_at", "is", null)
    .is("handover_resolved_at", null)
    .order("handover_requested_at", { ascending: true })
    .limit(200);

  const handovers = (threads || []).filter((t: any) => {
    if (!t.last_owner_message_at) return true;
    return (
      new Date(t.last_owner_message_at).getTime() < new Date(t.handover_requested_at).getTime()
    );
  });

  // "Needs your attention": unanswered for more than 2 days, oldest first
  const attention = unanswered.filter((t) => ageDays(t.created_at) >= 2).slice(0, 8);

  return {
    total: all.length,
    open: open.length,
    unanswered: unanswered.length,
    responded: responded.length,
    newThisWeek: newThisWeek.length,
    closedThisWeek: closedThisWeek.length,
    handovers,
    attention,
  };
}

function buildBlocks(r: Awaited<ReturnType<typeof buildReport>>) {
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: "🗓️ Weekly Support Report" } },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Last 7 days · ${new Date(Date.now() - WEEK_MS).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        },
      ],
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Open tickets*\n${r.open}` },
        { type: "mrkdwn", text: `*Awaiting your reply*\n${r.unanswered}` },
        { type: "mrkdwn", text: `*Responded (waiting on customer)*\n${r.responded}` },
        { type: "mrkdwn", text: `*New this week*\n${r.newThisWeek}` },
        { type: "mrkdwn", text: `*Closed this week*\n${r.closedThisWeek}` },
        { type: "mrkdwn", text: `*Human handovers pending*\n${r.handovers.length}` },
      ],
    },
  ];

  if (r.attention.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*⚠️ Needs your attention* — unanswered 2+ days" },
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: r.attention
          .map(
            (t) =>
              `• #${t.ticket_number} *${String(t.issue_category || t.request_text || "No subject").slice(0, 80)}* — ${
                t.customer_name || t.customer_email || "customer"
              } _(${ageDays(t.created_at)}d old)_`,
          )
          .join("\n")
          .slice(0, 2800),
      },
    });
  }

  if (r.handovers.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🚨 Waiting for a human:* ${r.handovers
          .map((t: any) => String(t.user_identifier || "unknown").trim())
          .filter(Boolean)
          .slice(0, 10)
          .join(", ")}`,
      },
    });
  }

  if (r.open === 0 && r.handovers.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "✅ Nothing open right now — you're all caught up." },
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `All-time tickets: *${r.total}*` }],
  });

  return blocks;
}

async function sendFor(install: Install) {
  if (!install.bot_token || !install.slack_channel_id) {
    return { agency_id: install.agency_id, sent: false, reason: "no_channel_or_token" };
  }
  const ids = await siblingAgencyIds(install.agency_id);
  const report = await buildReport(ids);
  const blocks = buildBlocks(report);

  const post = async () => {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${install.bot_token}`,
      },
      body: JSON.stringify({
        channel: install.slack_channel_id,
        text: `Weekly support report: ${report.open} open, ${report.unanswered} awaiting your reply, ${report.handovers.length} handovers pending`,
        blocks,
      }),
    });
    return { res, body: await res.json().catch(() => ({})) };
  };

  let { res, body } = await post();
  if (!body?.ok && (body?.error === "not_in_channel" || body?.error === "channel_not_found")) {
    // Bot isn't a member yet — join the channel (works for public channels) and retry.
    const join = await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${install.bot_token}`,
      },
      body: JSON.stringify({ channel: install.slack_channel_id }),
    }).then((r) => r.json()).catch(() => ({}));
    if (join?.ok) ({ res, body } = await post());
  }
  if (!body?.ok && install.webhook_url) {
    // Fallback: the incoming webhook chosen at install can post into private channels
    // even when the bot user isn't a member.
    const wr = await fetch(install.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Weekly support report: ${report.open} open`, blocks }),
    });
    if (wr.ok) { res = wr; body = { ok: true }; }
  }
  if (!res.ok || !body?.ok) {
    console.error("Slack post failed", install.agency_id, res.status, body?.error);
    const err = body?.error || null;
    const message =
      err === "channel_not_found" || err === "not_in_channel"
        ? "The SaaS Suite bot can't see your selected Slack channel. If it's private, type /invite @SaaS Suite in that channel, or pick a different channel under Slack → Connection."
        : err === "invalid_auth" || err === "token_revoked" || err === "account_inactive"
          ? "Your Slack connection has expired. Please reconnect Slack under Slack → Connection."
          : "Slack rejected the message. Please try again.";
    return {
      agency_id: install.agency_id,
      sent: false,
      status: res.status,
      slack_error: err,
      message,
    };
  }

  await supabase
    .from("slack_channel_agency_map")
    .update({ weekly_report_last_sent_at: new Date().toISOString() })
    .eq("id", install.id);

  return { agency_id: install.agency_id, sent: true, ...report, handovers: report.handovers.length, attention: report.attention.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    // Preview / "send now": one specific agency, regardless of the toggle
    if (typeof body?.agency_id === "string" && body.agency_id.trim()) {
      const ids = await siblingAgencyIds(body.agency_id.trim());
      const { data: install } = await supabase
        .from("slack_channel_agency_map")
        .select("id, agency_id, slack_channel_id, bot_token, webhook_url")
        .in("agency_id", ids)
        .eq("is_active", true)
        .not("bot_token", "is", null)
        .order("installed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (!install) return json({ error: "No active Slack connection for this agency." }, 404);
      return json(await sendFor(install as Install));
    }

    const { data: installs, error } = await supabase
      .from("slack_channel_agency_map")
      .select("id, agency_id, slack_channel_id, bot_token, webhook_url")
      .eq("is_active", true)
      .eq("weekly_report_enabled", true)
      .not("bot_token", "is", null);
    if (error) throw error;

    const results = [];
    for (const install of (installs || []) as Install[]) {
      try {
        results.push(await sendFor(install));
      } catch (e: any) {
        console.error("weekly report failed for", install.agency_id, e?.message);
        results.push({ agency_id: install.agency_id, sent: false, reason: e?.message });
      }
    }

    return json({ ok: true, installs: results.length, results });
  } catch (e: any) {
    console.error("slack-weekly-report error:", e?.message || e);
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
});
