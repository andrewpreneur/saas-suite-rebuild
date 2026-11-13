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

function extractToken(req: Request): string | null {
  const url = new URL(req.url);
  const qp = url.searchParams.get("token");
  if (qp) return qp.trim();
  // Path forms:
  // - https://auth.saassuite.ai/functions/v1/slack-inbound-webhook/<token>
  // - /slack-inbound-webhook/<token>
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("slack-inbound-webhook");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].trim();
  const tail = parts[parts.length - 1];
  if (tail && tail !== "slack-inbound-webhook") return tail.trim();
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = extractToken(req);
  if (!token) return json({ error: "Missing token" }, 400);

  // Parse body — accept JSON, form, or raw text
  const contentType = req.headers.get("content-type") || "";
  let payload: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      form.forEach((v, k) => (payload[k] = typeof v === "string" ? v : String(v)));
    } else {
      const text = await req.text();
      if (text.trim().startsWith("{")) {
        try { payload = JSON.parse(text); } catch { payload = { message: text }; }
      } else {
        payload = { message: text };
      }
    }
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const message = typeof payload.message === "string"
    ? payload.message
    : typeof payload.text === "string"
      ? payload.text
      : "";
  const source = typeof payload.source === "string" ? payload.source.trim() : "";
  const fields = payload.fields && typeof payload.fields === "object" && !Array.isArray(payload.fields)
    ? payload.fields as Record<string, unknown>
    : null;

  if (!message.trim() && !title && !fields) {
    return json({ error: "Provide at least one of: title, message, fields" }, 400);
  }

  // Look up install by token
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: install, error: lookupErr } = await supabase
    .from("slack_channel_agency_map")
    .select("agency_id, slack_channel_id, bot_token, is_active")
    .eq("inbound_webhook_token", token)
    .maybeSingle();

  if (lookupErr) {
    console.error("inbound token lookup failed:", lookupErr.message);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!install || !install.is_active || !install.bot_token || !install.slack_channel_id) {
    return json({ error: "Invalid or inactive webhook token" }, 404);
  }

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: title || "📨 SaaSSuite Custom Slack Message" },
    },
  ];

  if (message.trim()) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: String(message).slice(0, 2800) },
    });
  }

  if (fields) {
    const entries = Object.entries(fields).slice(0, 10);
    if (entries.length) {
      blocks.push({
        type: "section",
        fields: entries.map(([k, v]) => ({
          type: "mrkdwn",
          text: `*${k}:*\n${String(v).slice(0, 400)}`,
        })),
      });
    }
  }

  const contextBits: string[] = ["SaaSSuite Custom Slack Message"];
  if (source) contextBits.push(source);
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: contextBits.join("  •  ") }],
  });

  const fallback = title || (message.trim().slice(0, 140)) || "SaaSSuite Custom Slack Message";

  const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${install.bot_token}`,
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
      { error: "Slack post failed", slack_error: slackJson?.error || null },
      502,
    );
  }

  return json({ ok: true, ts: slackJson.ts });
});