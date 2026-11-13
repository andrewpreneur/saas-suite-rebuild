// Best-effort first name for emails: DB full_name -> Google/OAuth metadata -> email local part.

const GENERIC_LOCALS = new Set([
  "info", "team", "admin", "administrator", "hello", "hi", "support", "contact", "sales",
  "mail", "email", "office", "me", "agency", "help", "billing", "accounts", "accounting",
  "marketing", "service", "services", "no-reply", "noreply", "owner", "founder", "ceo",
  "hey", "inbox", "biz", "business", "web", "webmaster", "leads", "media", "studio",
]);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** "john@x.com" -> "John", "john.smith@x.com" -> "John". Returns "" when it can't tell. */
export function nameFromEmail(email: string): string {
  const local = (email || "").trim().toLowerCase().split("@")[0] || "";
  if (!local) return "";
  const first = local.split(/[._+\-0-9]+/).filter(Boolean)[0] || "";
  if (!first || first.length < 3 || first.length > 14) return "";
  if (GENERIC_LOCALS.has(first) || GENERIC_LOCALS.has(local)) return "";
  if (!/^[a-z]+$/.test(first)) return "";
  return cap(first);
}

/** Pull a name off the auth user record (Google sign-ins carry full_name / name). */
export async function nameFromAuthMetadata(email: string): Promise<string> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return "";
    const res = await fetch(
      `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email.trim().toLowerCase())}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return "";
    const data = await res.json();
    const u = (data?.users || [])[0];
    const m = u?.user_metadata || {};
    const raw = String(m.full_name || m.name || m.given_name || "").trim();
    return raw;
  } catch {
    return "";
  }
}

/**
 * Resolve the best available name for an email. Returns both the full name we
 * found (may be empty) and a usable first name for greetings.
 */
export async function resolveName(
  email: string,
  dbFullName?: string | null,
): Promise<{ fullName: string; firstName: string }> {
  let full = (dbFullName || "").trim();
  if (!full) full = await nameFromAuthMetadata(email);
  let first = full.split(/\s+/)[0] || "";
  if (!first) first = nameFromEmail(email);
  return { fullName: full, firstName: first };
}
