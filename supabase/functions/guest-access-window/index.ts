import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Public read-only endpoint for the client-hub platform.
 * Given an agency_id, reports whether guest (no-login) sessions should be
 * allowed right now — true only during the owner's first 24 hours.
 *
 *   GET /guest-access-window?agency_id=acme-media
 *   -> { agency_id, guest_allowed: true, guest_access_until: "..." , seconds_remaining: 42111 }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let agencyId = (url.searchParams.get("agency_id") || "").trim();

    if (!agencyId && req.method === "POST") {
      const raw = await req.text();
      const body = raw ? JSON.parse(raw) : {};
      agencyId = String(body.agency_id || "").trim();
    }

    if (!agencyId || agencyId.length > 100 || !/^[a-z0-9-]+$/i.test(agencyId)) {
      return json({ error: "Valid agency_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, guest_access_until")
      .or(
        [
          `agency_id.eq.${agencyId}`,
          `agency_id_basic.eq.${agencyId}`,
          `agency_id_advanced.eq.${agencyId}`,
          `agency_id_elite.eq.${agencyId}`,
        ].join(","),
      )
      .limit(5);

    if (error) throw error;

    const until = (data || [])
      .map((r) => r.guest_access_until)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;

    if (!until) {
      return json({ agency_id: agencyId, guest_allowed: false, guest_access_until: null, seconds_remaining: 0 });
    }

    const ms = new Date(until).getTime() - Date.now();
    return json({
      agency_id: agencyId,
      guest_allowed: ms > 0,
      guest_access_until: until,
      seconds_remaining: Math.max(0, Math.floor(ms / 1000)),
    });
  } catch (e) {
    console.error("[guest-access-window]", e);
    return json({ error: String(e) }, 500);
  }
});
