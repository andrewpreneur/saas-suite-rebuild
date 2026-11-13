import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sessions untouched for this long are considered over
const IDLE_MINUTES = 20;
// Never resurrect ancient sessions — only sweep recent ones
const MAX_AGE_HOURS = 24;

const isBlockedEmail = (raw: string): boolean => {
  const email = (raw || "").trim().toLowerCase();
  if (!email.includes("@")) return true;
  const [local, domain] = email.split("@");
  const blockedDomains = ["example.com", "example.org", "hmail.com", "test.com", "mailinator.com", "proton.me"];
  if (blockedDomains.includes(domain)) return true;
  return local.startsWith("test") || local.includes("+test") || local.includes("testing") || local.startsWith("escadmin");
};

async function sweep() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000).toISOString();
  const floor = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from("user_activity_sessions")
    .select("id, user_email, session_started_at, session_ended_at, status, updated_at, events")
    .in("status", ["active", "pending_analysis"])
    .eq("email_sent", false)
    .lt("updated_at", cutoff)
    .gt("session_started_at", floor)
    .limit(25);

  if (error) throw error;

  let analyzed = 0;
  let skipped = 0;
  // One send per user per sweep run — several stale sessions must not become several emails.
  const seen = new Set<string>();

  for (const session of stale ?? []) {
    const email = String(session.user_email || "").trim().toLowerCase();
    const events = Array.isArray(session.events) ? session.events : [];

    const retire = async (reason: string) => {
      skipped++;
      await supabase
        .from("user_activity_sessions")
        .update({ status: `skipped_${reason}`, updated_at: new Date().toISOString() })
        .eq("id", session.id);
    };

    if (isBlockedEmail(email)) {
      await retire("blocked_email");
      continue;
    }
    if (events.length === 0) {
      // analyze-user-session still handles the brand-new-account welcome case,
      // so only retire empty sessions for accounts that already got a welcome.
      const { data: user } = await supabase
        .from("saas_suite_users")
        .select("welcome_ai_email_sent_at")
        .ilike("email", email)
        .maybeSingle();
      if (user?.welcome_ai_email_sent_at) {
        await retire("empty");
        continue;
      }
    }
    if (seen.has(email)) {
      await retire("duplicate_in_run");
      continue;
    }
    seen.add(email);

    if (!session.session_ended_at) {
      await supabase
        .from("user_activity_sessions")
        .update({
          session_ended_at: new Date().toISOString(),
          status: "pending_analysis",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    }

    const res = await supabase.functions.invoke("analyze-user-session", {
      body: { sessionId: session.id },
    });
    if (!res.error) analyzed++;
    else console.error("analyze failed for", session.id, res.error);
  }

  console.log(`sweep complete: found ${stale?.length ?? 0}, analyzed ${analyzed}, retired ${skipped}`);
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Long-running work continues after the response is returned
  // @ts-ignore EdgeRuntime is provided by the Supabase runtime
  EdgeRuntime.waitUntil(sweep().catch((e) => console.error("sweep-user-sessions error:", e)));

  return new Response(JSON.stringify({ ok: true, started: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
