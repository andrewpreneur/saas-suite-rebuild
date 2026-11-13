// Generates a one-time Slack link token bound to the calling agency owner.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.email) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const email = userData.user.email.toLowerCase();

  const admin = createClient(SUPABASE_URL, SERVICE);
  const { data: profile, error: profErr } = await admin
    .from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, email")
    .ilike("email", email)
    .maybeSingle();
  if (profErr || !profile) {
    return new Response(JSON.stringify({ error: "SaaSSuite account not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const rawIds = [
    profile.agency_id,
    profile.agency_id_basic,
    profile.agency_id_advanced,
    profile.agency_id_elite,
  ].filter((x): x is string => !!x && x.length > 0)
   .map((x) => x.replace(/NO$/i, ""));
  const agencyIds = Array.from(new Set(rawIds));
  const agencyId = agencyIds[0];
  if (!agencyId) {
    return new Response(JSON.stringify({ error: "No agency ID on this account" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = randomToken(24);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: insertErr } = await admin
    .from("slack_link_tokens")
    .insert({
      agency_id: agencyId,
      agency_ids: agencyIds,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
  if (insertErr) {
    console.error("insert failed:", insertErr);
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ token, expires_at: expiresAt, agency_id: agencyId, agency_ids: agencyIds, email }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
