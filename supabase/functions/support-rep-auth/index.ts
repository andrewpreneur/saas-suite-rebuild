import { ghlEmailClaims, type GhlEmailClaimClient } from "../_shared/ghl-email-claim.ts";
import { ghlEmailDedupeKey, postGhlEmailEvent } from "../_shared/ghl-email-webhook.ts";
import { corsHeaders, json, serviceClient } from "../_shared/support-rep.ts";

function sixDigit(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function token(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function emailCode(
  email: string,
  code: string,
  name: string,
  dedupeKey: string | null,
  claims: GhlEmailClaimClient,
) {
  // One post: the GoHighLevel support_rep_login hook. GHL_SUPPORT_REP_LOGIN_WEBHOOK_URL overrides it; a blank value skips.
  // Do not also POST SUPPORT_REP_WEBHOOK_URL. Signup, practice, and training still use that URL.
  // The code is created and checked in this function; the webhook only carries it.
  // support_rep_login:<rep id>:<code id> stops a retry of this same code from sending twice.
  await postGhlEmailEvent("support_rep_login", {
    email,
    full_name: name,
    code,
    login_url: "https://saassuite.ai/support-rep/portal",
    subject: "Your SaaSSuite support portal code",
    expires_minutes: 15,
  }, { source: "support-rep-auth", dedupeKey, claims });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json({ error: "Email is required" }, 400);

    const supabase = serviceClient();
    const { data: applicant } = await supabase
      .from("support_rep_applicants")
      .select("id, email, name")
      .eq("email", email)
      .maybeSingle();
    if (!applicant) return json({ error: "No training account found for that email" }, 404);

    if (body.action === "request") {
      const code = sixDigit();
      const { data: inserted, error } = await supabase.from("support_rep_login_codes").insert({
        email,
        code,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      }).select("id").single();
      if (error) throw error;
      await emailCode(
        email,
        code,
        applicant.name || "",
        ghlEmailDedupeKey("support_rep_login", String(applicant.id ?? ""), String(inserted?.id ?? "")),
        ghlEmailClaims(supabase),
      );
      return json({ ok: true, sent: true });
    }

    if (body.action === "verify") {
      const code = String(body.code || "").trim();
      const { data: row } = await supabase
        .from("support_rep_login_codes")
        .select("id, code, expires_at, used_at")
        .eq("email", email)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!row || row.code !== code) return json({ error: "That code is not valid or has expired" }, 401);

      await supabase.from("support_rep_login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      const t = token();
      const { error } = await supabase.from("support_rep_sessions").insert({
        token: t,
        applicant_id: applicant.id,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      });
      if (error) throw error;
      return json({ ok: true, token: t, email, name: applicant.name || "" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[support-rep-auth]", e);
    return json({ error: String(e) }, 500);
  }
});
