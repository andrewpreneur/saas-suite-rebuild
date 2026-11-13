// Saves and reads a HighLevel theme for one agency and sub-account.
// Reads stay public. A write needs a signed-in SaaS Suite owner or branding admin,
// or a HighLevel user confirmed with that agency's stored token plus a THEME_SAVE_SECRET grant.
// A grant for another plan id of the same owner is the same account. An expired grant,
// another owner's grant, and a location-scoped grant for a different sub-account are not.
// When the page sends no user id, the same grant is enough if the location belongs to the agency.
// A claimed type or role is not enough. A user HighLevel rejects stays rejected.
// Not deployed from this change. Set THEME_SAVE_SECRET, apply
// supabase/migrations/20261022185601_theme_save_audit.sql, then deploy location-theme,
// theme-logo, and dynamic-styles together with the site.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  MAX_LOCATION_THEMES_PER_AGENCY,
  hintUserEmail,
  hintUserId,
  normalizeAgencyKey,
  normalizeLocationId,
  sanitizeLocationTheme,
} from "../_shared/locationTheme.ts";
import { themeOwnerAgencyIds } from "../_shared/themeSaveAuth.ts";
import { authorizeThemeWrite, recordThemeSave } from "../_shared/themeSaveGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const COOLDOWN_MS = 2000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function coolingDown(updatedAt: string | null | undefined) {
  if (!updatedAt) return false;
  const then = Date.parse(updatedAt);
  return Number.isFinite(then) && Date.now() - then < COOLDOWN_MS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Shared themes aren't available yet." }, 500);

  try {
    const url = new URL(req.url);
    let agencyRaw = url.searchParams.get("agencyKey") || "";
    let locationRaw = url.searchParams.get("locationId") || "";
    let themeInput: unknown = null;
    let userId = "";
    let userEmail = "";
    let saveToken = "";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      agencyRaw = String(body.agencyKey || "");
      locationRaw = String(body.locationId || "");
      themeInput = body.theme;
      userId = String(body.userId || "");
      userEmail = String(body.userEmail || "");
      saveToken = String(body.saveToken || "");
    }

    const agencyId = normalizeAgencyKey(agencyRaw);
    const locationId = normalizeLocationId(locationRaw);
    if (!agencyId || !locationId) return json({ error: "That account could not be matched." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: owners, error: ownerError } = await admin
      .from("saas_suite_users")
      .select("id, email, white_label_domain, custom_domain, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
      .limit(1);
    if (ownerError) throw ownerError;
    if (!owners?.length) return json({ error: "That agency was not found." }, 404);

    const { data: existing, error: existingError } = await admin
      .from("location_themes")
      .select("theme, updated_at")
      .eq("agency_id", agencyId)
      .eq("location_id", locationId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (req.method === "GET") {
      const theme = sanitizeLocationTheme(existing?.theme) || null;
      let locationName: string | null = null;
      if (locationId !== "agency") {
        const row = owners[0];
        const ids = [row.agency_id, row.agency_id_basic, row.agency_id_advanced, row.agency_id_elite].filter(Boolean);
        if (ids.length) {
          const { data: locs } = await admin
            .from("ghl_locations_cache")
            .select("name")
            .eq("location_id", locationId)
            .in("agency_id", ids)
            .limit(1);
          const name = String(locs?.[0]?.name || "").replace(/\s+/g, " ").trim();
          if (name && name.length <= 80 && name !== locationId && !/^[A-Za-z0-9_-]{12,}$/.test(name)) locationName = name;
        }
      }
      return json({ theme, locationName });
    }

    const theme = sanitizeLocationTheme(themeInput);
    if (!theme) return json({ error: "That theme could not be saved." }, 400);

    const owner = owners[0];
    const decision = await authorizeThemeWrite({
      admin,
      req,
      agencyId,
      locationId,
      saveToken,
      claimedUserId: userId,
      claimedUserEmail: userEmail,
      action: "theme_save",
      ownerAgencyIds: themeOwnerAgencyIds(agencyId, owner),
      ownerEmail: owner.email || null,
      whiteLabelDomain: owner.white_label_domain || null,
      customDomain: owner.custom_domain || null,
    });
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    if (coolingDown(existing?.updated_at)) {
      return json({ error: "Please wait a moment before saving the theme again." }, 429);
    }

    if (!existing) {
      const { count, error: countError } = await admin
        .from("location_themes")
        .select("agency_id", { count: "exact", head: true })
        .eq("agency_id", agencyId);
      if (countError) throw countError;
      if ((count || 0) >= MAX_LOCATION_THEMES_PER_AGENCY) {
        return json({ error: "This agency has too many saved themes." }, 429);
      }
    }

    const { error: upsertError } = await admin.from("location_themes").upsert({
      agency_id: agencyId,
      location_id: locationId,
      theme,
      user_id: hintUserId(decision.userId),
      user_email: hintUserEmail(decision.email),
      updated_at: new Date().toISOString(),
    });
    if (upsertError) throw upsertError;
    await recordThemeSave(admin, {
      agencyId,
      locationId,
      action: "theme_save",
      via: decision.via,
      userId: decision.userId,
      email: decision.email,
      origin: req.headers.get("Origin"),
      ok: true,
    });
    return json({ theme });
  } catch (error) {
    console.error("[location-theme]", error instanceof Error ? error.message : "save failed");
    return json({ error: "We couldn't save that theme. Please try again." }, 500);
  }
});
