import { corsHeaders, json, serviceClient, notifyWebhook } from "../_shared/support-rep.ts";

/**
 * Cron worker for the training simulator. Runs every 15 minutes:
 *  - releases practice requests whose scheduled time has arrived
 *  - marks anything unanswered after 12 hours as missed
 *  - closes out finished two-week trials
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = serviceClient();
    const nowIso = new Date().toISOString();

    // 1. Deliver due requests.
    const { data: due } = await supabase
      .from("support_rep_cases")
      .select("id, applicant_id, question, mode, scheduled_at")
      .eq("status", "scheduled")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    let delivered = 0;
    for (const c of due || []) {
      const { data: applicant } = await supabase
        .from("support_rep_applicants")
        .select("email, name, slack_notify, status, training_ends_at")
        .eq("id", c.applicant_id)
        .maybeSingle();
      if (!applicant || applicant.status === "withdrawn") continue;

      await supabase
        .from("support_rep_cases")
        .update({ status: "delivered", delivered_at: nowIso, updated_at: nowIso })
        .eq("id", c.id);
      await supabase.from("support_rep_case_messages").insert({
        case_id: c.id,
        role: "customer",
        content: c.question,
      });
      await notifyWebhook("support_rep_practice_request", {
        email: applicant.email,
        name: applicant.name || "",
        slack_notify: applicant.slack_notify,
        case_id: c.id,
        mode: c.mode,
        question: c.question,
        portal_url: "https://saassuite.ai/support-rep/portal",
      });
      delivered++;
    }

    // 2. Missed anything sitting unanswered past the 12-hour ceiling.
    const cutoff = new Date(Date.now() - 12 * 3600_000).toISOString();
    const { data: stale } = await supabase
      .from("support_rep_cases")
      .select("id")
      .eq("status", "delivered")
      .is("first_response_at", null)
      .lt("delivered_at", cutoff)
      .limit(200);
    if (stale?.length) {
      await supabase
        .from("support_rep_cases")
        .update({ status: "missed", closed_at: nowIso, updated_at: nowIso })
        .in("id", stale.map((s) => s.id));
    }

    // 3. Flag finished trials for review.
    const { data: finished } = await supabase
      .from("support_rep_applicants")
      .select("id, email, name")
      .eq("status", "training")
      .lt("training_ends_at", nowIso)
      .limit(50);
    for (const a of finished || []) {
      await supabase
        .from("support_rep_applicants")
        .update({ status: "awaiting_review", updated_at: nowIso })
        .eq("id", a.id);
      await notifyWebhook("support_rep_training_finished", { email: a.email, name: a.name || "" });
    }

    return json({
      ok: true,
      delivered,
      missed: stale?.length || 0,
      finished: finished?.length || 0,
    });
  } catch (e) {
    console.error("[support-rep-dispatch]", e);
    return json({ error: String(e) }, 500);
  }
});
