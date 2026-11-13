// Slack OAuth install-start endpoint.
// GET/POST /slack-install?agency_id=...  ->  302 redirect to Slack authorize URL.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") ?? "";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/slack-oauth`;
const SCOPES = [
  "chat:write",
  "chat:write.public",
  "commands",
  "channels:read",
  "groups:read",
  "users:read",
  "incoming-webhook",
  // Needed so owners can just talk to the CoPilot in Slack (mentions, DMs,
  // and replies in the thread of a proactive check-in).
  "app_mentions:read",
  "channels:history",
  "groups:history",
  "im:history",
  "im:write",
].join(",");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!CLIENT_ID) {
    return new Response("SLACK_CLIENT_ID not configured", { status: 500, headers: corsHeaders });
  }

  let agencyId = "";
  let createdByEmail: string | null = null;
  const url = new URL(req.url);
  agencyId = (url.searchParams.get("agency_id") ?? "").trim();
  createdByEmail = url.searchParams.get("email");

  if (!agencyId && req.method === "POST") {
    try {
      const body = await req.json();
      agencyId = String(body?.agency_id ?? "").trim();
      createdByEmail = createdByEmail ?? (body?.email ?? null);
    } catch { /* ignore */ }
  }

  if (!agencyId) {
    return new Response(JSON.stringify({ error: "agency_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const state = randomState();
  const { error: insertErr } = await supabase.from("slack_oauth_states").insert({
    state,
    agency_id: agencyId.replace(/NO$/i, ""),
    created_by_email: createdByEmail,
  });
  if (insertErr) {
    console.error("state insert failed:", insertErr.message);
    return new Response("Failed to start install", { status: 500, headers: corsHeaders });
  }

  const authorizeUrl = new URL("https://slack.com/oauth/v2/authorize");
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);

  return Response.redirect(authorizeUrl.toString(), 302);
});