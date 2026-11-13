import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { SAAS_PARTNER_BUCKET, saasPartnerClientIp } from "../_shared/saasPartnerWaitlist.ts";
import { handleSaasPartnerWaitlist, type SaasPartnerStore } from "./handler.ts";

function storeFrom(admin: ReturnType<typeof createClient>): SaasPartnerStore {
  return {
    async countRecent(ipHash, sinceIso) {
      const { count, error } = await admin
        .from("saas_partner_waitlist")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", sinceIso);
      if (error) return { count: 0, error: error.message };
      return { count: count ?? 0 };
    },
    async insert(row) {
      const { data, error } = await admin.from("saas_partner_waitlist").insert(row).select("id").single();
      const id = data && typeof data.id === "string" ? data.id : "";
      if (error || !id) return { error: error?.message || "insert failed", code: error?.code };
      return { id };
    },
    async uploadLogo(path, bytes, contentType) {
      const { error } = await admin.storage.from(SAAS_PARTNER_BUCKET).upload(path, bytes, {
        contentType,
        upsert: false,
      });
      if (error) return { error: error.message };
      return {};
    },
    async removeLogo(path) {
      await admin.storage.from(SAAS_PARTNER_BUCKET).remove([path]);
    },
  };
}

Deno.serve((req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const store =
    supabaseUrl && serviceKey
      ? storeFrom(createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }))
      : null;
  return handleSaasPartnerWaitlist(
    req,
    {
      nowMs: Date.now(),
      webhookUrl: Deno.env.get("GHL_SAAS_PARTNER_WEBHOOK_URL") ?? null,
      ip: saasPartnerClientIp(req.headers),
      userAgent: req.headers.get("user-agent") || "",
      store,
    },
    async (url, body) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(3000),
      });
      return { ok: response.ok };
    },
  );
});
