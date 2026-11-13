import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendHubWelcomeEmail, publicHubAgencyId } from "../_shared/hub-welcome-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The email only goes out once the user has been signed out / idle this long,
// so the AI copy can reflect everything they did in their first session.
const QUIET_MINUTES = 1;

async function run() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - QUIET_MINUTES * 60 * 1000).toISOString();

  const { data: queued, error } = await supabase
    .from("saas_suite_users")
    .select(
      "email, full_name, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, plan, hub_welcome_email_queued_at",
    )
    .not("hub_welcome_email_queued_at", "is", null)
    .is("hub_welcome_email_sent_at", null)
    .lt("hub_welcome_email_queued_at", cutoff)
    .limit(25);

  if (error) throw error;

  let sent = 0;
  let waiting = 0;

  for (const user of queued ?? []) {
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) continue;

    // Still active? Any session touched within the quiet window means they
    // haven't been signed out long enough — wait for the next run.
    const { data: live } = await supabase
      .from("user_activity_sessions")
      .select("id, updated_at, session_ended_at")
      .ilike("user_email", email)
      .gt("updated_at", cutoff)
      .limit(1);

    if (live && live.length > 0) {
      waiting++;
      continue;
    }

    const agencyId = publicHubAgencyId(user) || String(user.agency_id || "");
    if (!agencyId) {
      waiting++;
      continue;
    }

    const result = await sendHubWelcomeEmail(supabase, email, {
      agencyId,
      agencyName: user.agency_name,
      fullName: user.full_name,
      plan: user.plan,
    });

    if (result.ok) {
      sent++;
      // This IS their AI welcome email. Stamp the shared markers so
      // analyze-user-session never sends a second "Your Custom Onboarding".
      await supabase
        .from("saas_suite_users")
        .update({
          welcome_ai_email_sent_at: new Date().toISOString(),
          last_followup_email_sent_at: new Date().toISOString(),
        })
        .ilike("email", email)
        .is("welcome_ai_email_sent_at", null);
    } else console.error("[send-pending-hub-welcome] failed for", email, result);
  }

  console.log(`pending hub welcome: queued ${queued?.length ?? 0}, sent ${sent}, still waiting ${waiting}`);
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // @ts-ignore EdgeRuntime is provided by the Supabase runtime
  EdgeRuntime.waitUntil(run().catch((e) => console.error("[send-pending-hub-welcome]", e)));

  return new Response(JSON.stringify({ ok: true, started: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
