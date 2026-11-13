import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

/**
 * Recalculates giveaway points/tickets from real platform activity.
 * POST {} -> rescore every entry (cron friendly)
 * POST { email } -> rescore one entry
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let email: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const raw = (body as { email?: unknown }).email;
    if (typeof raw === "string" && raw.includes("@") && raw.length <= 320) {
      email = raw.trim().toLowerCase();
    }
  } catch {
    // no body — full rescore
  }

  try {
    let emails: string[];
    if (email) {
      emails = [email];
    } else {
      const { data, error } = await supabase
        .from("giveaway_entries")
        .select("email")
        .order("opted_in_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      emails = (data ?? []).map((r: { email: string }) => r.email);
    }

    let scored = 0;
    const failed: string[] = [];
    for (const e of emails) {
      const { error } = await supabase.rpc("giveaway_recalculate", { _email: e });
      if (error) failed.push(e);
      else scored += 1;
    }

    return json({ ok: true, scored, failed_count: failed.length });
  } catch (e) {
    console.error("[giveaway-score]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
