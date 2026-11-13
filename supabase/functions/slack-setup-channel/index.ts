import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("SLACK_NOTIFY_TOKEN");
  if (!expected) return json({ error: "Server not configured" }, 500);
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const apiKey = req.headers.get("x-api-key")?.trim() || "";
  const presented = bearer || apiKey;
  if (!presented || presented !== expected) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const agency_id_raw = typeof body.agency_id === "string" ? body.agency_id.trim() : "";
  const slack_channel_id =
    typeof body.slack_channel_id === "string" ? body.slack_channel_id.trim() : "";
  const slack_team_id =
    typeof body.slack_team_id === "string" ? body.slack_team_id.trim() : null;
  const label = typeof body.label === "string" ? body.label.trim() : null;
  const created_by_email =
    typeof body.created_by_email === "string" ? body.created_by_email.trim().toLowerCase() : null;

  if (!agency_id_raw) return json({ error: "agency_id is required" }, 400);
  const agency_id = agency_id_raw.replace(/NO$/i, "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // DELETE: remove mapping(s)
  if (req.method === "DELETE" || body.action === "delete") {
    let q = supabase.from("slack_channel_agency_map").delete().eq("agency_id", agency_id);
    if (slack_channel_id) q = q.eq("slack_channel_id", slack_channel_id);
    const { error } = await q;
    if (error) return json({ error: "Delete failed", details: error.message }, 500);
    return json({ ok: true, deleted: true, agency_id, slack_channel_id: slack_channel_id || null });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!slack_channel_id) return json({ error: "slack_channel_id is required" }, 400);
  if (!/^[CDG][A-Z0-9]{6,}$/i.test(slack_channel_id)) {
    return json(
      { error: "slack_channel_id looks invalid — expected a Slack channel ID like C0123ABCDEF (not a channel name)" },
      400,
    );
  }

  const { data, error } = await supabase
    .from("slack_channel_agency_map")
    .upsert(
      {
        agency_id,
        slack_channel_id,
        slack_team_id,
        label,
        created_by_email,
      },
      { onConflict: "agency_id,slack_channel_id" },
    )
    .select("id, agency_id, slack_channel_id, slack_team_id, label, created_at, updated_at")
    .maybeSingle();

  if (error) return json({ error: "Upsert failed", details: error.message }, 500);

  return json({ ok: true, mapping: data });
});