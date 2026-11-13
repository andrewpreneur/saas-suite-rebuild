import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CANCELLATION_WEBHOOK_URL, corsHeaders, handleSuspendUserAccess, type SuspendUserRow } from "./handler.ts";

async function postCancellationWebhook(email: string): Promise<void> {
  try {
    const webhookResponse = await fetch(CANCELLATION_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!webhookResponse.ok) {
      console.error("Webhook notification failed:", webhookResponse.status, await webhookResponse.text());
    } else {
      console.log("Webhook notification sent successfully for:", email);
    }
  } catch (webhookError) {
    console.error("Error sending webhook notification:", webhookError);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? null;

  return handleSuspendUserAccess(req, {
    nowMs: Date.now(),
    webhookSecret,
    async findUser(email) {
      const { data, error } = await supabase
        .from("saas_suite_users")
        .select("approval, billing_state, cancel_access_until")
        .ilike("email", email)
        .maybeSingle();
      if (error) return { row: null, error: error.message };
      return { row: (data as SuspendUserRow | null) ?? null };
    },
    async suspendUser(email) {
      const { data, error } = await supabase.rpc("suspend_user_access", { user_email: email });
      if (error) return { suspended: false, error: error.message };
      return { suspended: Boolean(data) };
    },
    postCancellation: postCancellationWebhook,
    async getUser(token) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anonKey) return { user: null, error: true };
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data, error } = await userClient.auth.getUser(token);
        if (error || !data.user) return { user: null, error: true };
        return { user: { email: data.user.email }, error: false };
      } catch {
        return { user: null, error: true };
      }
    },
  });
});
