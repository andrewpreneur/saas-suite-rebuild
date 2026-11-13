import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { publicAccountState, type AuthAccountState } from "../_shared/auth-account-state.ts";
import { authCodeSetPasswordUrl, postAuthCodeWebhook } from "../_shared/auth-code-mail.ts";
import {
  AUTH_RATE_LIMITS,
  AUTH_RATE_WINDOW_MS,
  PASSWORD_CODE_TTL_MS,
  amrFromToken,
  clientIp,
  hashPasswordCode,
  newNumericCode,
  proofForPasswordSet,
  rateLimitAllows,
  sessionCanSetPassword,
  safeAuthNext,
  sha256Hex,
  verifyStoredCode,
} from "../_shared/password-proof.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Admin = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@") || email.length > 320) return json({ error: "A valid email is required." }, 400);
    if (action !== "send_code" && action !== "set_password") {
      return json({ status: "proof_required", error: "Enter the one-time code from your email, or open the sign-in link we already sent." }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const ipHash = await sha256Hex(clientIp(req.headers.get("x-forwarded-for")));
    const emailHash = await sha256Hex(email);
    const bucket = action === "send_code" ? "send_code" : "set_password";
    if (!(await underRateLimit(admin, bucket, emailHash, ipHash))) {
      return json({ error: "Too many attempts. Please wait and try again." }, 429);
    }

    const account = await lookupAccount(admin, email);
    if (!account) return json({ error: "Could not verify your account. Please try again." }, 500);

    if (action === "send_code") return await sendCode(admin, email, account, body.next, ipHash);
    return await setPassword(admin, req, email, account, String(body.password ?? ""), String(body.code ?? ""));
  } catch (error) {
    console.error("set-initial-password error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
});

async function lookupAccount(admin: Admin, email: string): Promise<{ userId: string | null; state: AuthAccountState } | null> {
  const { data, error } = await admin.rpc("lookup_auth_account_for_service", { user_email: email });
  if (error) {
    console.error("auth account lookup failed");
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const pub = publicAccountState(row?.state);
  if (!pub) return null;
  const userId = typeof row?.user_id === "string" ? row.user_id : null;
  return { userId, state: pub.state };
}

async function sendCode(
  admin: Admin,
  email: string,
  account: { userId: string | null; state: AuthAccountState },
  next: unknown,
  ipHash: string,
) {
  if (account.state === "password") {
    return json({ status: "has_password", error: "This account already has a password. Please log in instead." }, 409);
  }
  if (account.state === "new") return json({ status: "sent" });

  const pepper = Deno.env.get("AUTH_CODE_PEPPER") ?? "";
  if (pepper.length < 16) {
    return json({ status: "not_sent", error: "We couldn't email a code. Use the sign-in link from your kit email, or try again." }, 503);
  }
  const nextPath = safeAuthNext(next);
  if (!authCodeSetPasswordUrl(email, nextPath)) {
    return json({ status: "not_sent", error: "We couldn't email a code. Use the sign-in link from your kit email, or try again." }, 503);
  }
  const salt = crypto.randomUUID();
  const code = newNumericCode((max) => crypto.getRandomValues(new Uint32Array(1))[0] % max);
  const codeHash = await hashPasswordCode(salt, code, pepper);
  const expiresAt = new Date(Date.now() + PASSWORD_CODE_TTL_MS).toISOString();
  const stored = await admin.from("auth_password_codes").insert({
    email,
    code_hash: codeHash,
    salt,
    expires_at: expiresAt,
    ip_hash: ipHash,
  }).select("id").single();
  if (stored.error || !stored.data?.id) return json({ error: "Could not send a code. Please try again." }, 500);

  const names = await buyerNames(admin, account.userId, email);
  const delivery = await postAuthCodeWebhook({
    fetchImpl: fetch,
    webhookUrl: Deno.env.get("GHL_AUTH_CODE_WEBHOOK_URL"),
    mail: {
      email,
      code,
      storedFirstName: names.storedFirstName,
      fullName: names.fullName,
      nextPath,
      requestId: String(stored.data.id),
      requestedAt: new Date().toISOString(),
    },
  });
  if (delivery !== "sent") {
    await admin.from("auth_password_codes").update({ used_at: new Date().toISOString() }).eq("id", stored.data.id);
    const status = delivery === "skipped" ? 503 : 502;
    return json({ status: "not_sent", error: "We couldn't email a code. Use the sign-in link from your kit email, or try again." }, status);
  }
  return json({ status: "sent" });
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return clean || null;
}

/** Reads a stored first name and a full name. Does not select a phone or write the account. */
async function buyerNames(
  admin: Admin,
  userId: string | null,
  email: string,
): Promise<{ storedFirstName: string | null; fullName: string | null }> {
  try {
    const [userResult, onboardResult, profileResult] = await Promise.all([
      userId ? admin.auth.admin.getUserById(userId) : Promise.resolve({ data: { user: null }, error: null }),
      admin.from("funnel_onboarding").select("first_name").ilike("email", email).order("created_at", { ascending: false }).limit(1),
      admin.from("saas_suite_users").select("full_name").ilike("email", email).limit(1),
    ]);
    const meta = (userResult.data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const onboard = Array.isArray(onboardResult.data) ? onboardResult.data[0] : null;
    const profile = Array.isArray(profileResult.data) ? profileResult.data[0] : null;
    return {
      storedFirstName: textOrNull(meta.first_name) ?? textOrNull(onboard?.first_name),
      fullName: textOrNull(meta.full_name) ?? textOrNull(profile?.full_name),
    };
  } catch {
    return { storedFirstName: null, fullName: null };
  }
}

async function setPassword(
  admin: Admin,
  req: Request,
  email: string,
  account: { userId: string | null; state: AuthAccountState },
  password: string,
  code: string,
) {
  if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
  const token = bearerToken(req);
  const sessionEmail = account.userId ? await magicLinkSession(admin, req, email) : null;
  const amr = sessionEmail ? amrFromToken(token) : null;
  const magicLink = sessionCanSetPassword({ sessionEmail, targetEmail: email, amr });
  const codeAccepted = magicLink ? false : await consumeCode(admin, email, code);
  const proof = proofForPasswordSet({
    targetEmail: email,
    state: account.state,
    sessionEmail,
    amr,
    codeAccepted,
  });
  if (!proof.ok) {
    const body = proof.error ? { status: proof.status, error: proof.error } : { status: proof.status };
    return json(body, proof.httpStatus);
  }
  if (!account.userId) return json({ error: "Could not set your password." }, 400);

  const { error } = await admin.auth.admin.updateUserById(account.userId, {
    password,
    email_confirm: true,
  });
  if (error) return json({ error: "Could not set your password." }, 400);
  return json({ status: "password_set" });
}

function bearerToken(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function magicLinkSession(admin: Admin, req: Request, email: string): Promise<string | null> {
  const token = bearerToken(req);
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!token || token === anon) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) return null;
  if (data.user.email.trim().toLowerCase() !== email) return null;
  return data.user.email.trim().toLowerCase();
}

async function consumeCode(admin: Admin, email: string, code: string): Promise<boolean> {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const { data, error } = await admin
    .from("auth_password_codes")
    .select("id, code_hash, salt, expires_at, used_at, attempts")
    .eq("email", email)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;
  const pepper = Deno.env.get("AUTH_CODE_PEPPER") ?? "";
  if (pepper.length < 16) return false;
  const expected = await hashPasswordCode(String(data.salt ?? ""), clean, pepper);
  const verdict = verifyStoredCode({
    stored: {
      codeHash: String(data.code_hash ?? ""),
      expiresAt: Date.parse(String(data.expires_at ?? "")),
      used: Boolean(data.used_at),
      attempts: Number(data.attempts ?? 0),
    },
    expectedHash: expected,
    now: Date.now(),
  });
  if (!verdict.ok) {
    const attempts = Number(data.attempts ?? 0) + 1;
    await admin.from("auth_password_codes").update({
      attempts,
      used_at: attempts >= 5 ? new Date().toISOString() : null,
    }).eq("id", data.id);
    return false;
  }
  const claimed = await admin
    .from("auth_password_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("used_at", null)
    .select("id");
  return !claimed.error && Array.isArray(claimed.data) && claimed.data.length === 1;
}

async function underRateLimit(admin: Admin, bucket: "send_code" | "set_password", emailHash: string, ipHash: string) {
  const since = new Date(Date.now() - AUTH_RATE_WINDOW_MS).toISOString();
  const limits = AUTH_RATE_LIMITS[bucket];
  const [byEmail, byIp] = await Promise.all([
    admin.from("auth_account_attempts").select("id", { count: "exact", head: true }).eq("bucket", bucket).eq("email_hash", emailHash).gte("created_at", since),
    admin.from("auth_account_attempts").select("id", { count: "exact", head: true }).eq("bucket", bucket).eq("ip_hash", ipHash).gte("created_at", since),
  ]);
  if (byEmail.error || byIp.error) return false;
  const allowed = rateLimitAllows(byEmail.count ?? 0, limits.email) && rateLimitAllows(byIp.count ?? 0, limits.ip);
  if (!allowed) return false;
  const inserted = await admin.from("auth_account_attempts").insert({ bucket, email_hash: emailHash, ip_hash: ipHash });
  return !inserted.error;
}
