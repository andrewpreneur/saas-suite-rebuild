import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Internal fan-out endpoint used by DB triggers and internal edge functions
// to deliver "always-on" default Slack notifications (new account, first
// AI support message, ticket updates). No caller-supplied auth — this
// function attaches SLACK_NOTIFY_TOKEN itself when calling slack-notify.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = Deno.env.get("SLACK_NOTIFY_TOKEN");
  if (!token) {
    console.warn("SLACK_NOTIFY_TOKEN not configured; skipping default Slack event");
    return json({ ok: true, skipped: "no token" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { agency_id, event_type, data } = body || {};
  if (!agency_id || !event_type) {
    return json({ error: "agency_id and event_type required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/slack-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ agency_id, event_type, data: data ?? {} }),
    });
    const text = await res.text();
    if (!res.ok) {
      // 404 = no Slack install for this agency; treat as expected skip.
      if (res.status === 404) return json({ ok: true, skipped: "no install" });
      console.error("slack-auto-notify -> slack-notify failed:", res.status, text);
      return json({ ok: false, status: res.status, details: text }, 502);
    }
    return json({ ok: true, forwarded: res.status });
  } catch (e) {
    console.error("slack-auto-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});