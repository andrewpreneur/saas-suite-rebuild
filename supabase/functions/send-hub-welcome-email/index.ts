import { corsHeaders, json, serviceClient, requireAuthedUser } from "../_shared/user-auth.ts";
import { sendHubWelcomeEmail, publicHubAgencyId } from "../_shared/hub-welcome-email.ts";

/**
 * Manual / retry endpoint for the "your onboarding portal is live" AI email.
 * Normal sends happen automatically inside provision-hub the moment the user
 * enters their agency name. Pass { force: true } to re-send.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    // Platform-owner override: admin key can send the welcome again for any account.
    const adminKey = Deno.env.get("USER_360_API_KEY") || "";
    const isAdmin = adminKey && req.headers.get("x-api-key") === adminKey;

    let targetEmail = "";
    if (isAdmin) {
      targetEmail = String(body.email || "").trim().toLowerCase();
      if (!targetEmail) return json({ error: "email required" }, 400);
    } else {
      const auth = await requireAuthedUser(req);
      if (!auth.ok) return auth.res;
      targetEmail = auth.email;
    }

    const supabase = serviceClient();

    const { data: user, error } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, plan")
      .ilike("email", targetEmail)
      .maybeSingle();
    if (error) throw error;
    if (!user) return json({ error: "User profile not found" }, 404);


    const result = await sendHubWelcomeEmail(supabase, user.email, {
      agencyId: publicHubAgencyId(user) || user.agency_id || "",
      agencyName: user.agency_name,
      fullName: user.full_name,
      plan: user.plan,
      force: body.force === true,
    });

    return json(result, result.ok ? 200 : 500);
  } catch (e) {
    console.error("[send-hub-welcome-email]", e);
    return json({ error: String(e) }, 500);
  }
});
