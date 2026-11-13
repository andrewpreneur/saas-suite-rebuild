import { corsHeaders, json, serviceClient, requireAuthedUser } from "../_shared/user-auth.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";

/**
 * "Send the install guide to my desktop/email" action.
 * Fires the LeadConnector webhook stored in INSTALL_GUIDE_WEBHOOK_URL, which
 * sends the one-off install-guide email with the desktop link.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuthedUser(req);
    if (!auth.ok) return auth.res;
    const email = auth.email;

    const webhookUrl = Deno.env.get("INSTALL_GUIDE_WEBHOOK_URL");
    if (!webhookUrl) {
      await logCustomerMessage({
        userEmail: email,
        channel: "webhook",
        templateKey: "install_guide",
        provider: "ghl",
        status: "suppressed",
        source: "send-install-guide",
        detail: "webhook_not_configured",
      });
      return json({ error: "INSTALL_GUIDE_WEBHOOK_URL is not configured" }, 503);
    }

    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const device = ["mobile", "tablet", "desktop"].includes(body.device) ? body.device : null;

    const supabase = serviceClient();

    const { data: user, error: userErr } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, agency_id, plan, install_guide_sent_at, install_confirmed_at")
      .ilike("email", email)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!user) return json({ error: "User profile not found" }, 404);

    // Don't let a tap-happy user spam themselves — one send per hour.
    if (user.install_guide_sent_at) {
      const since = Date.now() - new Date(user.install_guide_sent_at).getTime();
      if (since < 60 * 60 * 1000) {
        await logCustomerMessage({
          userEmail: user.email,
          channel: "webhook",
          templateKey: "install_guide",
          provider: "ghl",
          status: "suppressed",
          source: "send-install-guide",
          detail: "throttled",
        });
        return json({ ok: true, throttled: true, sent_at: user.install_guide_sent_at });
      }
    }

    const payload = {
      event: "install_guide_requested",
      email: user.email,
      full_name: user.full_name || "",
      agency_id: user.agency_id || "",
      plan: user.plan || "",
      device: device || "unknown",
      install_guide_url: "https://saassuite.ai/app/client-hub?panel=installation-guide",
      requested_at: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`[send-install-guide] webhook failed [${res.status}]: ${details}`);
      await logCustomerMessage({
        userEmail: user.email,
        channel: "webhook",
        templateKey: "install_guide",
        provider: "ghl",
        status: "failed",
        source: "send-install-guide",
        detail: `http_${res.status}`,
      });
      return json({ error: "Install guide webhook failed", status: res.status, details }, res.status);
    }

    await logCustomerMessage({
      userEmail: user.email,
      channel: "webhook",
      templateKey: "install_guide",
      provider: "ghl",
      status: "sent",
      source: "send-install-guide",
    });

    await supabase
      .from("saas_suite_users")
      .update({ install_guide_sent_at: new Date().toISOString(), ...(device ? { last_device: device } : {}) })
      .ilike("email", email);

    return json({ ok: true, sent_at: payload.requested_at });
  } catch (e) {
    console.error("[send-install-guide]", e);
    return json({ error: String(e) }, 500);
  }
});
