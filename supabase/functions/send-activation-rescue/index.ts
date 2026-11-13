import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const BLOCKED = ["example.com", "proton.me", "test.com", "mailinator.com"];

function isBlocked(email: string): boolean {
  const e = email.toLowerCase();
  return BLOCKED.some((d) => e.endsWith(`@${d}`)) || e.includes("+test") || e.startsWith("test@");
}

/**
 * Phase 2 rescue sweep: finds users who stalled before activation and fires the
 * one-off "book your 5-minute activation call" email through
 * ACTIVATION_RESCUE_WEBHOOK_URL. Safe to run on a schedule (idempotent per user).
 *
 * Stalled = created 24h-14d ago, no confirmed install, and either
 * intro questions unfinished or installed nothing after finishing them.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhookUrl = Deno.env.get("ACTIVATION_RESCUE_WEBHOOK_URL");
    if (!webhookUrl) {
      return json({ error: "ACTIVATION_RESCUE_WEBHOOK_URL is not configured" }, 503);
    }

    const raw = req.method === "POST" ? await req.text() : "";
    const body = raw ? JSON.parse(raw) : {};
    const dryRun = body.dry_run === true;
    const limit = Math.min(Number(body.limit) || 25, 100);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const now = Date.now();
    const { data: candidates, error } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, plan, agency_id, created_at, initial_questions_completed, install_confirmed_at, activation_rescue_sent_at, last_device")
      .is("install_confirmed_at", null)
      .is("activation_rescue_sent_at", null)
      .lt("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
      .gt("created_at", new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const targets = (candidates || []).filter((u) => u.email && !isBlocked(u.email));
    const sent: string[] = [];
    const failed: { email: string; status: number; details: string }[] = [];

    for (const u of targets) {
      const payload = {
        event: "activation_rescue",
        email: u.email,
        full_name: u.full_name || "",
        plan: u.plan || "",
        agency_id: u.agency_id || "",
        signed_up_at: u.created_at,
        stall_reason: u.initial_questions_completed ? "not_installed" : "questions_unfinished",
        last_device: u.last_device || "unknown",
      };

      if (dryRun) {
        sent.push(u.email);
        continue;
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const details = await res.text();
        console.error(`[send-activation-rescue] webhook failed for ${u.email} [${res.status}]: ${details}`);
        failed.push({ email: u.email, status: res.status, details });
        continue;
      }

      await supabase
        .from("saas_suite_users")
        .update({ activation_rescue_sent_at: new Date().toISOString() })
        .ilike("email", u.email);

      sent.push(u.email);
    }

    return json({ ok: true, dry_run: dryRun, considered: targets.length, sent: sent.length, failed });
  } catch (e) {
    console.error("[send-activation-rescue]", e);
    return json({ error: String(e) }, 500);
  }
});
