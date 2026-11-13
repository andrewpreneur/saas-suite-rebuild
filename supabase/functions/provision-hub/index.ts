import { corsHeaders, json, serviceClient, requireAuthedUser } from "../_shared/user-auth.ts";
import { publicHubAgencyId } from "../_shared/hub-welcome-email.ts";
import { resolveHubUrl } from "../_shared/hub-url.ts";

const HUB_BASE = "https://yoursoftwareonboarding.com/v2";

/** Default onboarding checklist seeded for Starter accounts. */
const STARTER_CHECKLIST_ITEMS = [
  {
    title: "Create your first contact",
    description: "Add your first contact so you can start messaging, booking and tracking them.",
    item_order: 1,
    link_to: "video",
    linked_video: "foundational-setup:new-contact",
    link_url: null,
  },
  {
    title: "Book appointments with our calendars",
    description: "Set up your calendar and start booking appointments automatically.",
    item_order: 2,
    link_to: "video",
    linked_video: "foundational-setup:scheduling",
    link_url: null,
  },
  {
    title: "Configure your profile and billing",
    description: "Finish your profile details and add billing so everything is ready to go.",
    item_order: 3,
    link_to: "video",
    linked_video: "foundational-setup:configure-profile-billing",
    link_url: null,
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const COMPANY_HINTS = [
  "agency", "media", "marketing", "group", "labs", "studio", "studios", "solutions",
  "digital", "consulting", "co", "llc", "inc", "ltd", "systems", "partners", "collective",
  "ventures", "works", "creative", "crm", "software", "tech",
];

/** Company-style names get "Welcome to X"; personal names get a software-flavoured line. */
function buildHeadline(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  const lower = clean.toLowerCase();
  const words = clean.split(" ");
  const looksCompany = COMPANY_HINTS.some((h) => lower.split(/[^a-z]+/).includes(h)) || words.length > 3;
  if (looksCompany) return `Welcome to ${clean}`;
  const possessive = /s$/i.test(clean) ? `${clean}'` : `${clean}'s`;
  return `Welcome to ${possessive} CRM & Marketing Software`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuthedUser(req);
    if (!auth.ok) return auth.res;
    const email = auth.email;

    const supabase = serviceClient();

    const { data: user, error: userErr } = await supabase
      .from("saas_suite_users")
      .select("email, full_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, agency_name, guest_access_until, primary_color, plan")
      .ilike("email", email)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return json({ error: "User profile not found" }, 404);

    const displayName = (user.agency_name || user.full_name || "").trim();
    if (!displayName) {
      return json({ error: "No name on file — cannot provision hub" }, 400);
    }

    const mintUnique = async (base: string): Promise<string> => {
      let candidate = base;
      for (let i = 2; i < 40; i++) {
        const { data: taken } = await supabase
          .from("saas_suite_users")
          .select("email")
          .eq("agency_id", candidate)
          .neq("email", user.email)
          .maybeSingle();
        if (!taken) break;
        candidate = `${base}-${i}`;
      }
      return candidate;
    };

    const HEX_ID = /^[0-9a-f]{24,}$/i;
    const agencyNameSlug = slugify((user.agency_name || "").trim());
    const fullNameSlug = slugify((user.full_name || "").trim());

    // The agency NAME is the source of truth for the public hub URL. Anything
    // auto-derived (raw hex ids from Stripe provisioning, or a slug built from
    // the person's own name before they told us their agency) gets replaced the
    // moment a real agency name exists.
    const isPlaceholder = (id: string) =>
      !id || HEX_ID.test(id) || (!!fullNameSlug && id.replace(/-\d+$/, "") === fullNameSlug && id !== agencyNameSlug);

    let agencyId = (user.agency_id || "").trim();
    if (isPlaceholder(agencyId)) {
      const base = agencyNameSlug || fullNameSlug || `agency-${Date.now().toString(36)}`;
      agencyId = await mintUnique(base);
    }

    const headline = buildHeadline(displayName);

    // Keep the plan-scoped slug (what the app and the welcome email link) in
    // sync with the agency name too.
    const plan = String(user.plan || "STARTER").toUpperCase();
    const planColumn =
      plan === "ELITE" ? "agency_id_elite" : plan === "ADVANCED" ? "agency_id_advanced" : plan === "BASIC" ? "agency_id_basic" : null;

    const patch: Record<string, unknown> = {
      agency_id: agencyId,
      agency_name: user.agency_name || displayName,
      login_welcome_headline: headline,
    };
    if (planColumn) {
      const current = String((user as Record<string, unknown>)[planColumn] || "").trim();
      if (isPlaceholder(current)) {
        patch[planColumn] = agencyNameSlug ? await mintUnique(agencyNameSlug) : agencyId;
      }
    }

    const { error: updErr } = await supabase
      .from("saas_suite_users")
      .update(patch)
      .ilike("email", email);
    if (updErr) throw updErr;

    // Seed the hub so the live URL renders immediately with their name on it.
    const { data: existingHub } = await supabase
      .from("v2_home_settings")
      .select("agency_id, welcome_headline")
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (!existingHub) {
      const { error: hubErr } = await supabase.from("v2_home_settings").insert({
        agency_id: agencyId,
        welcome_enabled: true,
        welcome_headline: headline,
        welcome_subheadline: "Everything you need to get up and running, all in one place.",
      });
      if (hubErr) throw hubErr;
    }

    // Starter accounts get a ready-made 3-item onboarding checklist so the hub is useful day one.
    if ((user.plan ?? "STARTER") === "STARTER") {
      const { data: existingItems } = await supabase
        .from("agency_onboarding_checklist")
        .select("id")
        .eq("agency_id", agencyId)
        .limit(1);

      if (!existingItems || existingItems.length === 0) {
        const { error: checklistErr } = await supabase
          .from("agency_onboarding_checklist")
          .insert(STARTER_CHECKLIST_ITEMS.map((item) => ({ ...item, agency_id: agencyId })));
        if (checklistErr) throw checklistErr;
      }
    }



    // 24-hour guest-preview window so they can open their own hub with no login.
    const { data: guest, error: guestErr } = await supabase.rpc("start_guest_access_window", {
      user_email: email,
    });
    if (guestErr) throw guestErr;

    // The moment their agency name (and therefore their hub URL) exists, send the
    // AI welcome email containing the full onboarding URL + the customise link.
    // Always link the readable, plan-correct hub id the app shows them.
    const emailAgencyId = publicHubAgencyId({ ...user, ...patch } as Record<string, string>) || agencyId;

    // Make sure the hub the email links actually renders.
    if (emailAgencyId && emailAgencyId !== agencyId) {
      const { data: planHub } = await supabase
        .from("v2_home_settings")
        .select("agency_id")
        .eq("agency_id", emailAgencyId)
        .maybeSingle();
      if (!planHub) {
        await supabase.from("v2_home_settings").insert({
          agency_id: emailAgencyId,
          welcome_enabled: true,
          welcome_headline: headline,
          welcome_subheadline: "Everything you need to get up and running, all in one place.",
        });
      }
    }
    // Do NOT send the welcome email now — queue it. send-pending-hub-welcome
    // ships it only once the user has been signed out / idle for 1+ minute so
    // the AI copy can reflect their whole first session.
    const { error: queueErr } = await supabase
      .from("saas_suite_users")
      .update({ hub_welcome_email_queued_at: new Date().toISOString() })
      .ilike("email", email)
      .is("hub_welcome_email_sent_at", null);
    if (queueErr) console.error("[provision-hub] failed to queue welcome email", queueErr);

    return json({
      ok: true,
      welcome_email: { queued: !queueErr },
      agency_id: agencyId,
      hub_url: await resolveHubUrl(supabase, agencyId),
      headline,
      guest_access_until: (guest as { guest_access_until?: string } | null)?.guest_access_until ?? null,
    });
  } catch (e) {
    console.error("[provision-hub]", e);
    return json({ error: String(e) }, 500);
  }
});
