import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("CUSTOM_DOMAIN_WEBHOOK_SECRET");
    if (!expected) throw new Error("Webhook secret not configured");

    const body = await req.json().catch(() => ({}));
    const provided =
      req.headers.get("x-webhook-secret") ||
      (body as any)?.secret ||
      "";

    if (provided !== expected) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String((body as any)?.email ?? "").trim().toLowerCase();
    const access = (body as any)?.access;
    if (!email) throw new Error("Missing email");

    const accessBool = access === undefined ? true : Boolean(access);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("saas_suite_users")
      .update({ custom_domain_access: accessBool })
      .ilike("email", email)
      .select("email, custom_domain_access");

    if (error) throw error;

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "User not found", email }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, email, custom_domain_access: accessBool }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});