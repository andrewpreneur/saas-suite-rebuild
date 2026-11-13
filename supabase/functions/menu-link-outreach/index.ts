// Admin-only tool: find users who have NOT installed their custom menu link
// (no menu_link_id on file for any of their agency IDs) and push their install
// data to the LeadConnector webhook so we can email them their scripts.
import { requireAdmin, serviceClient, json, corsHeaders } from "../_shared/admin-auth.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { loadHubVersionMap } from "../_shared/hub-url.ts";
import { menuRemovalInstallCodes } from "../_shared/menuRemovalGuide.ts";

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/5fc964e8-0648-4c66-82ba-40ab19cd4863";

const DYNAMIC_BASE = "https://auth.saassuite.ai/functions/v1/dynamic-styles";

type UserRow = Record<string, any>;

function agencyIdsOf(u: UserRow): string[] {
  return [u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]
    .filter((v) => typeof v === "string" && v.trim().length > 0);
}

function onboardingUrl(u: UserRow, vmap: Map<string, number>): string | null {
  const id = agencyIdsOf(u)[0];
  if (!id) return null;
  if (u.custom_domain && u.custom_domain_live) {
    return `https://${String(u.custom_domain).replace(/^https?:\/\//, "").replace(/\/$/, "")}/v${vmap.get(id) ?? 2}/${id}`;
  }
  return `https://yoursoftwareonboarding.com/v${vmap.get(id) ?? 2}/${id}`;
}

async function fetchScript(agencyId: string, type: "css" | "js"): Promise<string> {
  try {
    const res = await fetch(`${DYNAMIC_BASE}?agency_id=${encodeURIComponent(agencyId)}&type=${type}`);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function loadCandidates(supabase: any) {
  const { data: users, error } = await supabase
    .from("saas_suite_users")
    .select(
      "email, full_name, agency_name, plan, approval, billing_state, bonuses_phone, custom_domain, custom_domain_live, created_at, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, generated_css, install_confirmed_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: configs, error: cErr } = await supabase
    .from("agency_menu_config")
    .select("agency_id, menu_link_id, menu_link_id_2");
  if (cErr) throw new Error(cErr.message);

  const withLink = new Set<string>();
  for (const c of configs ?? []) {
    if (c.menu_link_id || c.menu_link_id_2) withLink.add(String(c.agency_id));
  }

  // Many accounts finish the install without the ID ever landing in our table.
  // Treat any saved menu config or real client activity on the hub as installed
  // so outreach + stats aren't chasing people who are already live.
  for (const c of configs ?? []) withLink.add(String(c.agency_id));
  for (const table of ["user_progress", "ai_chat_messages", "hub_ip_sessions"]) {
    const { data: rows } = await supabase.from(table).select("agency_id").limit(50000);
    for (const r of rows ?? []) {
      if (r?.agency_id) withLink.add(String(r.agency_id));
    }
  }

  const vmap = await loadHubVersionMap(supabase);
  const rows = (users ?? []).map((u: UserRow) => {
    const ids = agencyIdsOf(u);
    const hasMenuLink = Boolean(u.install_confirmed_at) || ids.some((id) => withLink.has(id));
    return {
      email: String(u.email ?? "").toLowerCase(),
      name: u.full_name ?? null,
      phone: u.bonuses_phone ?? null,
      agency_name: u.agency_name ?? null,
      agency_id: ids[0] ?? null,
      plan: u.plan ?? null,
      approval: u.approval ?? null,
      billing_state: u.billing_state ?? null,
      created_at: u.created_at ?? null,
      onboarding_url: onboardingUrl(u, vmap),
      has_menu_link: hasMenuLink,
      has_custom_css: !!u.generated_css,
    };
  });

  return rows.filter((r: any) => r.email && r.agency_id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action ?? "list");
    const supabase = serviceClient();
    const all = await loadCandidates(supabase);

    if (action === "list") {
      return json({
        ok: true,
        total: all.length,
        missing: all.filter((r: any) => !r.has_menu_link).length,
        users: all,
      });
    }

    if (action === "send") {
      const requested: string[] = Array.isArray((body as any).emails)
        ? (body as any).emails.map((e: string) => String(e).toLowerCase())
        : [];
      const targets = requested.length
        ? all.filter((r: any) => requested.includes(r.email))
        : all.filter((r: any) => !r.has_menu_link);

      if (targets.length === 0) return json({ ok: true, sent: 0, failed: 0, results: [] });
      if (targets.length > 300) return json({ error: "Too many recipients (max 300)" }, 400);

      const results: any[] = [];
      let sent = 0;
      let failed = 0;

      for (const t of targets) {
        const [css, js] = await Promise.all([
          fetchScript(t.agency_id!, "css"),
          fetchScript(t.agency_id!, "js"),
        ]);
        const payload = {
          name: t.name,
          email: t.email,
          phone: t.phone,
          full_onboarding_url: t.onboarding_url,
          agency_name: t.agency_name,
          menu_link_id_on_file: t.has_menu_link ? "yes" : "no",
          custom_css: `${menuRemovalInstallCodes(t.agency_id).css}\n\n${css}`,
          custom_js: `${menuRemovalInstallCodes(t.agency_id).js}\n\n${js}`,
        };
        try {
          const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          await logCustomerMessage({
            userEmail: t.email,
            channel: "webhook",
            templateKey: "menu_link_outreach",
            provider: "ghl",
            status: res.ok ? "sent" : "failed",
            source: "menu-link-outreach",
            detail: res.ok ? null : `http_${res.status}`,
          });
          if (res.ok) {
            sent++;
            results.push({ email: t.email, ok: true });
          } else {
            failed++;
            results.push({ email: t.email, ok: false, status: res.status, body: (await res.text()).slice(0, 200) });
          }
        } catch (e) {
          failed++;
          results.push({ email: t.email, ok: false, error: String(e) });
          await logCustomerMessage({
            userEmail: t.email,
            channel: "webhook",
            templateKey: "menu_link_outreach",
            provider: "ghl",
            status: "failed",
            source: "menu-link-outreach",
            detail: "request_failed",
          });
        }
      }

      return json({ ok: true, sent, failed, results });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[menu-link-outreach]", e);
    return json({ error: String(e) }, 500);
  }
});
