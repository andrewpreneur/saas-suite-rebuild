import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Public read-only check: does this email have the $49/month Agency Support
 * add-on switched on by their agency owner?
 *
 * GET /agency-support-access?email=someone@example.com
 * -> { email, has_access, owner_email, client_name }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let email = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!email && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      email = String(body?.email || "").trim().toLowerCase();
    }
    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("agency_support_clients")
      .select("owner_email, client_name, active, assigned_at")
      .ilike("client_email", email)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;

    return new Response(
      JSON.stringify({
        email,
        has_access: Boolean(data),
        owner_email: data?.owner_email ?? null,
        client_name: data?.client_name ?? null,
        assigned_at: data?.assigned_at ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[AGENCY-SUPPORT-ACCESS] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
