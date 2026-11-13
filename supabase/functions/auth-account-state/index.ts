import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { publicAccountState } from "../_shared/auth-account-state.ts";
import {
  AUTH_RATE_LIMITS,
  AUTH_RATE_WINDOW_MS,
  clientIp,
  rateLimitAllows,
  sha256Hex,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@") || email.length > 320) {
      return json({ error: "A valid email is required." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const ipHash = await sha256Hex(clientIp(req.headers.get("x-forwarded-for")));
    const emailHash = await sha256Hex(email);
    const allowed = await underRateLimit(admin, "lookup", emailHash, ipHash);
    if (!allowed) return json({ error: "Too many attempts. Please wait and try again." }, 429);

    const { data, error } = await admin.rpc("lookup_auth_account_for_service", { user_email: email });
    if (error) {
      console.error("auth account state lookup failed");
      return json({ error: "Could not verify your account. Please try again." }, 500);
    }
    const row = Array.isArray(data) ? data[0] : data;
    const pub = publicAccountState(row?.state);
    if (!pub) return json({ error: "Could not verify your account. Please try again." }, 500);
    // `{ state }` only. The caller already supplied the email. Echoing it, or any user id, would let a caller list accounts.
    return json(pub);
  } catch (error) {
    console.error("auth-account-state error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Could not verify your account. Please try again." }, 500);
  }
});

async function underRateLimit(
  admin: ReturnType<typeof createClient>,
  bucket: "lookup",
  emailHash: string,
  ipHash: string,
): Promise<boolean> {
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
