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
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("external-platform-ingest");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].trim();
  const tail = parts[parts.length - 1];
  if (tail && tail !== "external-platform-ingest") return tail.trim();
  return null;
}

const str = (v: unknown, max = 300) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = extractToken(req);
  if (!token) return json({ error: "Missing token" }, 400);

  let payload: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim().startsWith("{")) payload = JSON.parse(text);
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const email = str(payload.email ?? payload.user_email, 320)?.toLowerCase() ?? null;
  const name = str(payload.name ?? payload.user_name ?? payload.full_name, 200);
  const externalUserId = str(payload.user_id ?? payload.external_user_id, 200);
  const pageUrl = str(payload.page ?? payload.page_url ?? payload.url, 1000);
  const eventType = str(payload.event ?? payload.event_type, 60) ?? "user_login";
  const userAgent = str(req.headers.get("user-agent"), 500);

  if (!email && !externalUserId) {
    return json({ error: "Provide at least email or user_id" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: conn } = await supabase
    .from("external_platform_connections")
    .select("id, agency_id, platform_name, enabled, slack_notify")
    .eq("token", token)
    .maybeSingle();

  if (!conn) return json({ error: "Invalid token" }, 401);
  if (!conn.enabled) return json({ ok: true, skipped: "connection_disabled" });

  // Dedupe: ignore repeat logins from the same user within 30 minutes
  if (email) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("external_platform_events")
      .select("id")
      .eq("connection_id", conn.id)
      .eq("event_type", eventType)
      .ilike("user_email", email)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return json({ ok: true, deduped: true });
    }
  }

  await supabase.from("external_platform_events").insert({
    connection_id: conn.id,
    agency_id: conn.agency_id,
    event_type: eventType,
    user_email: email,
    user_name: name,
    external_user_id: externalUserId,
    page_url: pageUrl,
    user_agent: userAgent,
    metadata: {
      platform: str(payload.platform, 120) ?? conn.platform_name,
      source: "external_platform",
    },
  });

  await supabase
    .from("external_platform_connections")
    .update({
      last_event_at: new Date().toISOString(),
      event_count: ((conn as any).event_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  // Merge into the agency's user dashboards
  let isNewUser = false;
  if (email) {
    const { data: existing } = await supabase
      .from("user_progress")
      .select("id, name")
      .ilike("email", email)
      .eq("agency_id", conn.agency_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_progress")
        .update({ last_accessed: new Date().toISOString(), name: existing.name ?? name })
        .eq("id", existing.id);
    } else {
      isNewUser = true;
      await supabase.from("user_progress").insert({
        email,
        name,
        agency_id: conn.agency_id,
        approval: "YES",
        last_accessed: new Date().toISOString(),
      });
    }
  }

  // Ping Slack
  if (conn.slack_notify) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          agency_id: conn.agency_id,
          event_type: eventType === "user_login" ? "user_login" : eventType,
          data: {
            user_email: email,
            user_name: name,
            is_new_user: isNewUser,
            platform: str(payload.platform, 120) ?? conn.platform_name,
            page_url: pageUrl,
          },
        }),
      });
    } catch (e) {
      console.error("slack-notify failed", e);
    }
  }

  return json({ ok: true });
});
