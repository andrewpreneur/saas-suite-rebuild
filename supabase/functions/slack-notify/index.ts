import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getInstallByAgency } from "../_shared/slack-workspace.ts";
import { missingSlackInstallResult } from "./missingInstall.ts";
import { kitOnboardingSlackMessage } from "../_shared/kit-onboarding-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type EventType =
  | "user_login"
  | "video_watched"
  | "video_completed"
  | "support_started"
  | "human_handover"
  | "ticket_created"
  | "ticket_updated"
  | "ticket_assigned"
  | "chat_assigned"
  | "assigned_chat_message"
  | "assigned_ticket_reply"
  | "one_feature_kit_purchase"
  | "one_feature_kit_onboarding";

interface NotifyBody {
  agency_id?: string;
  event_type?: string;
  data?: Record<string, any>;
}

const userLine = (d: Record<string, any>) => {
  const name = d.user_name || d.name || d.full_name;
  const email = d.user_email || d.email;
  if (name && email) return `*${name}* (${email})`;
  return `*${name || email || "Unknown user"}*`;
};

function buildMessage(event_type: string, d: Record<string, any>) {
  const blocks: any[] = [];
  let fallback = "";

  switch (event_type as EventType) {
    case "user_login": {
      fallback = `👤 User login: ${d.user_email || d.email || "unknown"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "👤 User Login" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${userLine(d)} just logged in.${d.is_new_user ? "  _(first-time login)_" : ""}`,
          },
        },
      );
      break;
    }
    case "video_watched": {
      fallback = `▶️ ${d.user_email || "user"} watched "${d.video_title || "a video"}"`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "▶️ Video Watched" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${userLine(d)} started *${d.video_title || "a video"}*${d.video_category ? `  _(${d.video_category})_` : ""}`,
          },
        },
      );
      if (d.progress_percent != null) {
        blocks.push({
          type: "context",
          elements: [{ type: "mrkdwn", text: `Progress: *${d.progress_percent}%*` }],
        });
      }
      break;
    }
    case "video_completed": {
      fallback = `✅ ${d.user_email || "user"} completed "${d.video_title || "a video"}"`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "✅ Video Completed" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${userLine(d)} finished *${d.video_title || "a video"}*${d.video_category ? `  _(${d.video_category})_` : ""}`,
          },
        },
      );
      break;
    }
    case "support_started": {
      fallback = `💬 Support started with ${d.user_email || "a user"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "💬 Support Conversation Started" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${userLine(d)} opened an AI support chat.`,
          },
        },
      );
      if (d.first_message) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `>${String(d.first_message).slice(0, 500)}` },
        });
      }
      break;
    }
    case "human_handover": {
      fallback = `🚨 Human handover requested by ${d.user_email || "a user"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "🚨 Human Handover Requested" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${userLine(d)} escalated their AI chat and needs a human.`,
          },
        },
      );
      if (d.reason) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*Reason:* ${d.reason}` },
        });
      }
      if (d.last_message) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `>${String(d.last_message).slice(0, 500)}` },
        });
      }
      break;
    }
    case "ticket_created": {
      fallback = `🎫 New ticket #${d.ticket_id || "?"} from ${d.user_email || "user"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "🎫 New Support Ticket" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Ticket:* ${d.ticket_id ? `#${d.ticket_id}` : "(no id)"}${d.subject ? `\n*Subject:* ${d.subject}` : ""}\n*From:* ${userLine(d)}${d.assigned_to ? `\n*Assigned to:* ${d.assigned_to}` : "\n*Assigned to:* Unassigned"}`,
          },
        },
      );
      if (d.message || d.description) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `>${String(d.message || d.description).slice(0, 800)}`,
          },
        });
      }
      if (d.status || d.priority) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: [
                d.status ? `Status: *${d.status}*` : null,
                d.priority ? `Priority: *${d.priority}*` : null,
              ]
                .filter(Boolean)
                .join("  •  "),
            },
          ],
        });
      }
      break;
    }
    case "ticket_updated": {
      fallback = `🔄 Ticket #${d.ticket_id || "?"} updated`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "🔄 Ticket Updated" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Ticket:* ${d.ticket_id ? `#${d.ticket_id}` : "(no id)"}${d.subject ? `\n*Subject:* ${d.subject}` : ""}${d.user_email || d.user_name ? `\n*User:* ${userLine(d)}` : ""}`,
          },
        },
      );
      const changeParts: string[] = [];
      if (d.previous_status && d.status) changeParts.push(`Status: *${d.previous_status}* → *${d.status}*`);
      else if (d.status) changeParts.push(`Status: *${d.status}*`);
      if (d.updated_by) changeParts.push(`Updated by: *${d.updated_by}*`);
      if (changeParts.length) {
        blocks.push({
          type: "context",
          elements: [{ type: "mrkdwn", text: changeParts.join("  •  ") }],
        });
      }
      if (d.note || d.admin_response) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `>${String(d.note || d.admin_response).slice(0, 800)}` },
        });
      }
      break;
    }
    case "ticket_assigned": {
      fallback = `👤 Ticket #${d.ticket_id || "?"} assigned to ${d.assigned_to || "someone"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "👤 Ticket Assigned" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Ticket:* ${d.ticket_id ? `#${d.ticket_id}` : "(no id)"}${d.subject ? `\n*Subject:* ${d.subject}` : ""}${d.user_email || d.user_name ? `\n*From:* ${userLine(d)}` : ""}\n*Assigned to:* ${d.assigned_to || "Unknown"}${d.previous_assignee ? ` (was ${d.previous_assignee})` : ""}`,
          },
        },
      );
      break;
    }
    case "chat_assigned": {
      fallback = `👤 Chat with ${d.user_email || "a customer"} assigned to ${d.assigned_to || "someone"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "👤 Chat Assigned" } },
        { type: "section", text: { type: "mrkdwn", text: `*Customer:* ${userLine(d)}\n*Assigned to:* ${d.assigned_to || "Unknown"}${d.assigned_by ? `\n*Assigned by:* ${d.assigned_by}` : ""}` } },
      );
      break;
    }
    case "assigned_chat_message": {
      fallback = `💬 New message from ${d.user_email || "a customer"} (assigned to ${d.assigned_to || "someone"})`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "💬 New Message on Assigned Chat" } },
        { type: "section", text: { type: "mrkdwn", text: `*Customer:* ${userLine(d)}\n*Assigned to:* ${d.assigned_to || "Unknown"}` } },
      );
      if (d.message) blocks.push({ type: "section", text: { type: "mrkdwn", text: `>${String(d.message).slice(0, 500)}` } });
      break;
    }
    case "assigned_ticket_reply": {
      fallback = `💬 Customer replied to ticket #${d.ticket_id || "?"}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "💬 Customer Replied to Assigned Ticket" } },
        { type: "section", text: { type: "mrkdwn", text: `*Ticket:* #${d.ticket_id || "?"}${d.subject ? `\n*Subject:* ${d.subject}` : ""}\n*From:* ${userLine(d)}\n*Assigned to:* ${d.assigned_to || "Unknown"}` } },
      );
      if (d.message) blocks.push({ type: "section", text: { type: "mrkdwn", text: `>${String(d.message).slice(0, 800)}` } });
      break;
    }
    case "one_feature_kit_onboarding": {
      const built = kitOnboardingSlackMessage(d);
      fallback = built.fallback;
      blocks.push(...built.blocks);
      break;
    }
    case "one_feature_kit_purchase": {
      const lines = Array.isArray(d.lines) ? d.lines.filter(Boolean).join(", ") : "";
      const who = d.name || d.email || "A buyer";
      fallback = `One Feature Kit purchase: ${who} ${d.total || ""}`.trim();
      blocks.push(
        { type: "header", text: { type: "plain_text", text: "One Feature Kit purchase" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${who}*${d.email ? ` (${d.email})` : ""}${d.phone ? `\n*Phone:* ${d.phone}` : ""}\n*Total:* ${d.total || "unknown"}${lines ? `\n*Items:* ${lines}` : ""}${d.offer_id ? `\n*Add-on:* ${d.offer_id}` : ""}\n*Checkout:* ${d.checkout_id || ""}`,
          },
        },
      );
      break;
    }
    default: {
      fallback = `📣 Event: ${event_type}`;
      blocks.push(
        { type: "header", text: { type: "plain_text", text: `📣 ${event_type}` } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "```" + JSON.stringify(d, null, 2).slice(0, 2800) + "```",
          },
        },
      );
    }
  }

  return { blocks, fallback };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ---- Auth ----
  const expected = Deno.env.get("SLACK_NOTIFY_TOKEN");
  if (!expected) {
    console.error("SLACK_NOTIFY_TOKEN not configured");
    return json({ error: "Server not configured" }, 500);
  }
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const apiKey = req.headers.get("x-api-key")?.trim() || "";
  const presented = bearer || apiKey;
  if (!presented || presented !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ---- Body ----
  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { agency_id, event_type, data = {} } = body || {};
  if (!agency_id || typeof agency_id !== "string") {
    return json({ error: "agency_id is required" }, 400);
  }
  if (!event_type || typeof event_type !== "string") {
    return json({ error: "event_type is required" }, 400);
  }

  const cleanAgencyId = agency_id.replace(/NO$/i, "");

  // ---- Lookup channel ----
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const install = await getInstallByAgency(cleanAgencyId);
  if (!install) {
    const skipped = missingSlackInstallResult(cleanAgencyId);
    console.info("slack-notify no install", JSON.stringify({ agency_id: cleanAgencyId, event_type, skipped: skipped.body.skipped }));
    return json(skipped.body, skipped.status);
  }
  if (!install.slack_channel_id) {
    console.error("slack-notify no channel", JSON.stringify({ agency_id: cleanAgencyId, team: install.slack_team_id, event_type }));
    return json({ error: "Slack install has no channel mapped.", agency_id: cleanAgencyId }, 404);
  }
  const botToken = install.bot_token;

  // ---- Per-agency support alert toggles (Support → Slack tab) ----
  const d0: Record<string, any> = data || {};
  const isAssigned = !!String(d0.assigned_to || "").trim();
  let mode = "self";
  let chatAssigned = false;
  const SUPPORT_ALERTS = ["ticket_created", "support_started", "human_handover", "chat_assigned", "ticket_assigned", "assigned_chat_message", "assigned_ticket_reply", "ticket_updated"];
  if (SUPPORT_ALERTS.includes(event_type)) {
    const { data: o } = await supabase.from("saas_suite_users").select("human_chat_mode")
      .or(`agency_id.eq.${cleanAgencyId},agency_id_basic.eq.${cleanAgencyId},agency_id_advanced.eq.${cleanAgencyId},agency_id_elite.eq.${cleanAgencyId}`)
      .limit(1).maybeSingle();
    mode = (o as any)?.human_chat_mode || "self";
    if (event_type !== "ticket_created" && d0.user_email) {
      const { data: a } = await supabase.from("support_chat_assignments").select("assigned_to_email")
        .eq("agency_id", cleanAgencyId).ilike("user_identifier", String(d0.user_email)).maybeSingle();
      chatAssigned = !!(a as any)?.assigned_to_email;
    }
  }
  // "We Handle & Respond": SaaS Suite handles support, so the agency's Slack gets no support alerts.
  if (mode === "managed" && SUPPORT_ALERTS.includes(event_type)) {
    console.error("slack-notify skipped", JSON.stringify({ agency_id: cleanAgencyId, event_type, skipped: "managed support" }));
    return json({ ok: true, skipped: "managed support" });
  }
  const on = (k: keyof typeof install) => (install as any)[k] !== false;
  let allowed = true;
  switch (event_type) {
    case "chat_assigned": allowed = on("alert_assigned_chat"); break;
    case "ticket_assigned": allowed = on("alert_assigned_ticket"); break;
    case "assigned_chat_message":
    case "assigned_ticket_reply": allowed = on("alert_assigned_updates"); break;
    case "ticket_updated": allowed = isAssigned ? on("alert_assigned_updates") : true; break;
    case "ticket_created":
      allowed = isAssigned ? on("alert_assigned_ticket") : (mode === "self" && on("alert_new_unassigned_tickets"));
      break;
    case "support_started":
    case "human_handover":
      allowed = !chatAssigned && mode === "self" && on("alert_new_unassigned_chats");
      break;
  }
  if (!allowed) {
    console.error("slack-notify skipped", JSON.stringify({ agency_id: cleanAgencyId, event_type, channel: install.slack_channel_id, skipped: "disabled by agency alert settings" }));
    return json({ ok: true, skipped: "disabled by agency alert settings", event_type });
  }

  const { blocks, fallback } = buildMessage(event_type, data || {});

  const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: install.slack_channel_id,
      text: fallback,
      blocks,
    }),
  });

  const slackJson = await slackRes.json().catch(() => ({}));
  if (!slackRes.ok || !slackJson?.ok) {
    console.error("Slack post failed:", slackRes.status, slackJson);
    return json(
      {
        error: "Slack post failed",
        status: slackRes.status,
        slack_error: slackJson?.error || null,
        details: slackJson,
      },
      502,
    );
  }

  console.log("slack-notify posted", JSON.stringify({
    agency_id: cleanAgencyId,
    event_type,
    channel: install.slack_channel_id,
    team: install.slack_team_id,
    team_domain: install.team_domain,
    ts: slackJson.ts,
  }));
  return json({
    ok: true,
    channel: install.slack_channel_id,
    team: install.slack_team_id,
    team_domain: install.team_domain,
    ts: slackJson.ts,
    event_type,
  });
});