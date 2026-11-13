import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

const topics = new Set([
  "Account access",
  "Installation",
  "Client Hub",
  "Support and ticketing",
  "Billing",
  "Other",
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashValue(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (String(body.website || "").trim()) return json({ ok: true });

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const agencyName = String(body.agency_name || "").trim();
    const topic = String(body.topic || "").trim();
    const question = String(body.question || "").trim();

    if (name.length < 2 || name.length > 120) return json({ error: "Enter your name." }, 400);
    if (!emailPattern.test(email) || email.length > 320) return json({ error: "Enter a valid email address." }, 400);
    if (agencyName.length > 160) return json({ error: "Agency name is too long." }, 400);
    if (!topics.has(topic)) return json({ error: "Choose a support topic." }, 400);
    if (question.length < 10 || question.length > 5000) {
      return json({ error: "Your question must be between 10 and 5,000 characters." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Support submission service is not configured");

    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await hashValue(forwarded);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count, error: countError } = await admin
      .from("public_support_submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count || 0) >= 5) return json({ error: "Too many requests. Please wait and try again." }, 429);

    const { data, error } = await admin
      .from("public_support_submissions")
      .insert({
        name,
        email,
        agency_name: agencyName || null,
        topic,
        question,
        ip_hash: ipHash,
        user_agent: String(req.headers.get("user-agent") || "").slice(0, 500) || null,
      })
      .select("id")
      .single();
    if (error) throw error;

    return json({ ok: true, id: data.id });
  } catch (error) {
    console.error("[public-support-submit]", error);
    return json({ error: "We couldn't send your question. Please try again." }, 500);
  }
});
