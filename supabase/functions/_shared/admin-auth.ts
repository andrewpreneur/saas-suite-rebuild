import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_EMAILS } from "./platformAdmins.ts";

export { isPlatformAdminEmail, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_EMAILS };

/** Original platform admin. Access checks use isPlatformAdminEmail. */
export const ADMIN_EMAIL = PLATFORM_ADMIN_EMAIL;

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function requireAdmin(req: Request): Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, res: json({ error: "Missing auth" }, 401) };
  }
  const token = auth.slice("Bearer ".length);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    return { ok: false, res: json({ error: "Invalid session" }, 401) };
  }
  const email = data.user.email.toLowerCase();
  if (!isPlatformAdminEmail(email)) {
    return { ok: false, res: json({ error: "Admin only" }, 403) };
  }
  return { ok: true, email };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}