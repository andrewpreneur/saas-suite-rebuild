import {
  corsHeaders,
  json,
  serviceClient,
  askAI,
  parseJson,
  metricsFor,
  notifyWebhook,
  STANDARDS,
  type CaseGrade,
} from "../_shared/support-rep.ts";

const GRADER_SYSTEM = `You grade a trainee customer-support representative for a SaaS platform built on HighLevel.
Grade ONLY the representative's latest reply. Standards they are held to:
${STANDARDS.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Return STRICT JSON only, no markdown:
{
  "grammar_score": 0-100 (American English grammar, spelling, punctuation, capitalisation),
  "tone_score": 0-100 (kind, human, understanding, never robotic or AI-sounding),
  "accuracy_score": 0-100 (does the reply actually address the request usefully and correctly),
  "honesty_score": 0-100 (100 when they are honest about what they do not know and describe researching or escalating; lower when they bluff),
  "resolved": true|false (is the customer's issue fully handled),
  "customer_reply": "the customer's next message, or empty string if resolved",
  "summary": "one short sentence of feedback for the trainee",
  "suggestions": ["short actionable improvement", "..."]
}
Never invent product facts. Keep the customer_reply realistic, short, and in the customer's voice.`;

async function loadSession(supabase: ReturnType<typeof serviceClient>, req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const t = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!t) return null;
  const { data } = await supabase
    .from("support_rep_sessions")
    .select("applicant_id, expires_at")
    .eq("token", t)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  const { data: applicant } = await supabase
    .from("support_rep_applicants")
    .select("*")
    .eq("id", data.applicant_id)
    .maybeSingle();
  return applicant || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = serviceClient();
    const applicant = await loadSession(supabase, req);
    if (!applicant) return json({ error: "Session expired. Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "overview");

    const { data: allCases } = await supabase
      .from("support_rep_cases")
      .select("id, question, mode, status, scheduled_at, delivered_at, first_response_at, closed_at, response_minutes, score, grade")
      .eq("applicant_id", applicant.id)
      .order("scheduled_at", { ascending: false });
    const cases = allCases || [];
    const visible = cases.filter((c) => c.status !== "scheduled");

    if (action === "overview") {
      const metrics = metricsFor(visible as never);
      const done = new Date(applicant.training_ends_at).getTime() <= Date.now();
      return json({
        ok: true,
        applicant: {
          name: applicant.name,
          email: applicant.email,
          status: applicant.status,
          training_starts_at: applicant.training_starts_at,
          training_ends_at: applicant.training_ends_at,
          works_weekends: applicant.works_weekends,
          hours: applicant.hours,
          slack_notify: applicant.slack_notify,
          final_score: applicant.final_score,
          final_report: applicant.final_report,
        },
        standards: STANDARDS,
        metrics,
        training_complete: done,
        upcoming: cases.filter((c) => c.status === "scheduled").length,
        cases: visible,
      });
    }

    if (action === "case") {
      const caseId = String(body.case_id || "");
      const found = cases.find((c) => c.id === caseId);
      if (!found) return json({ error: "Not found" }, 404);
      const { data: messages } = await supabase
        .from("support_rep_case_messages")
        .select("id, role, content, grade, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      return json({ ok: true, case: found, messages: messages || [] });
    }

    if (action === "reply") {
      const caseId = String(body.case_id || "");
      const content = String(body.content || "").trim();
      if (content.length < 2) return json({ error: "Write a reply first" }, 400);
      const found = cases.find((c) => c.id === caseId);
      if (!found) return json({ error: "Not found" }, 404);
      if (found.status === "completed") return json({ error: "This case is already closed" }, 400);

      const { data: prior } = await supabase
        .from("support_rep_case_messages")
        .select("role, content, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      const history = prior || [];

      const now = new Date();
      const { data: repMessage } = await supabase
        .from("support_rep_case_messages")
        .insert({ case_id: caseId, role: "rep", content })
        .select("id")
        .single();


      // Response time is measured from delivery to the FIRST reply.
      const patch: Record<string, unknown> = { status: "in_progress", updated_at: now.toISOString() };
      if (!found.first_response_at) {
        patch.first_response_at = now.toISOString();
        const deliveredAt = new Date(found.delivered_at || found.scheduled_at).getTime();
        patch.response_minutes = Math.max(0, Math.round(((now.getTime() - deliveredAt) / 60_000) * 10) / 10);
      }

      const transcript = [
        `Customer's original request: ${found.question}`,
        ...history.map((m) => `${m.role === "rep" ? "Representative" : "Customer"}: ${m.content}`),
        `Representative (latest reply to grade): ${content}`,
      ].join("\n");

      let grade: (CaseGrade & { resolved?: boolean; customer_reply?: string }) | null = null;
      try {
        grade = parseJson(await askAI(GRADER_SYSTEM, transcript));
      } catch (e) {
        console.error("[support-rep-portal] grading failed", e);
      }

      if (grade && repMessage?.id) {
        await supabase.from("support_rep_case_messages").update({ grade }).eq("id", repMessage.id);
      }


      const repTurns = history.filter((m) => m.role === "rep").length + 1;
      const roleplay = found.mode === "roleplay";
      const resolved = grade?.resolved === true || !roleplay || repTurns >= 4;
      const followUp = roleplay && !resolved ? String(grade?.customer_reply || "").trim() : "";

      if (followUp) {
        await supabase.from("support_rep_case_messages").insert({
          case_id: caseId,
          role: "customer",
          content: followUp,
        });
      }

      if (resolved) {
        patch.status = "completed";
        patch.closed_at = now.toISOString();
        if (grade) {
          patch.grade = grade;
          patch.score = Math.round(
            ((Number(grade.grammar_score) || 0) +
              (Number(grade.tone_score) || 0) +
              (Number(grade.accuracy_score) || 0) +
              (Number(grade.honesty_score) || 0)) / 4,
          );
        }
      } else if (grade) {
        patch.grade = grade;
      }

      await supabase.from("support_rep_cases").update(patch).eq("id", caseId);

      return json({
        ok: true,
        grade,
        customer_reply: followUp,
        resolved,
        response_minutes: patch.response_minutes ?? found.response_minutes,
      });
    }

    if (action === "finalize") {
      if (new Date(applicant.training_ends_at).getTime() > Date.now()) {
        return json({ error: "Training is still in progress" }, 400);
      }
      const metrics = metricsFor(visible as never);
      let narrative = "";
      try {
        narrative = await askAI(
          "You write a short, fair, professional performance summary for a support representative trainee. 4-6 sentences. No exclamation marks. No invented facts.",
          `Metrics after a two-week trial: ${JSON.stringify(metrics)}`,
        );
      } catch { /* narrative optional */ }
      const report = { ...metrics, narrative: narrative.trim() };
      await supabase
        .from("support_rep_applicants")
        .update({
          status: metrics.meets_standard ? "passed" : "completed",
          final_score: metrics.final_score,
          final_report: report,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicant.id);
      await notifyWebhook("support_rep_training_complete", {
        email: applicant.email,
        name: applicant.name || "",
        final_score: metrics.final_score,
        meets_standard: metrics.meets_standard,
      });
      return json({ ok: true, final_score: metrics.final_score, report });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[support-rep-portal]", e);
    return json({ error: String(e) }, 500);
  }
});
