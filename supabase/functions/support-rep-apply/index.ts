import {
  corsHeaders,
  json,
  serviceClient,
  normalizePassword,
  REP_PASSWORD,
  notifyWebhook,
  seedQuestionBank,
  buildQueue,
  STANDARDS,
} from "../_shared/support-rep.ts";

/** Public application endpoint for the password-protected /support-rep page. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    if (normalizePassword(body.password) !== REP_PASSWORD()) {
      return json({ error: "Incorrect password" }, 401);
    }
    // Password-only check used by the gate before showing the form.
    if (body.check_only === true) return json({ ok: true, standards: STANDARDS });

    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const name = String(body.name || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "A valid email is required" }, 400);
    if (phone.replace(/\D/g, "").length < 7) return json({ error: "A valid phone number is required" }, 400);
    if (body.agreed !== true) return json({ error: "You must agree to all five standards" }, 400);

    const supabase = serviceClient();
    const now = new Date();
    const ends = new Date(now.getTime() + 14 * 86400_000);

    const record = {
      name: name || null,
      email,
      phone,
      slack_notify: body.slack_notify === true,
      works_weekends: body.works_weekends === true,
      hours: body.hours && typeof body.hours === "object" ? body.hours : {},
      agreed_at: now.toISOString(),
      training_starts_at: now.toISOString(),
      training_ends_at: ends.toISOString(),
      status: "training",
      updated_at: now.toISOString(),
    };

    const { data: applicant, error } = await supabase
      .from("support_rep_applicants")
      .upsert(record, { onConflict: "email" })
      .select("id, email, name, training_starts_at, training_ends_at, works_weekends")
      .single();
    if (error) throw error;

    // Fresh queue for this training period.
    await supabase.from("support_rep_cases").delete().eq("applicant_id", applicant.id).eq("status", "scheduled");
    const bankSize = await seedQuestionBank(supabase);
    const queued = await buildQueue(supabase, applicant as never);

    await notifyWebhook("support_rep_signup", {
      email,
      name: name || "",
      phone,
      slack_notify: body.slack_notify === true,
      works_weekends: body.works_weekends === true,
      hours: record.hours,
      training_starts_at: record.training_starts_at,
      training_ends_at: record.training_ends_at,
      queued_requests: queued,
      portal_url: "https://saassuite.ai/support-rep/portal",
    });

    return json({
      ok: true,
      training_starts_at: record.training_starts_at,
      training_ends_at: record.training_ends_at,
      queued_requests: queued,
      question_bank: bankSize,
    });
  } catch (e) {
    console.error("[support-rep-apply]", e);
    return json({ error: String(e) }, 500);
  }
});
