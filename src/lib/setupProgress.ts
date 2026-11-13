import { supabase } from "@/integrations/supabase/client";
import { ghl } from "@/components/highlevel/ghlApi";

export type SetupStepId = "highlevel" | "install" | "hub";

export interface SetupProgress {
  highlevel: boolean;
  install: boolean;
  hub: boolean;
}

const EMPTY: SetupProgress = { highlevel: false, install: false, hub: false };

/**
 * The three Getting Started steps. Checkboxes are read from account data.
 * This never writes, and a failed lookup leaves the step unchecked.
 */
export async function loadSetupProgress(email: string | null | undefined): Promise<SetupProgress> {
  const clean = email?.trim().toLowerCase();
  if (!clean) return EMPTY;
  try {
    const { data: user } = await supabase
      .from("saas_suite_users")
      .select(
        "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, install_confirmed_at",
      )
      .ilike("email", clean)
      .maybeSingle();
    const ids = Array.from(
      new Set(
        [
          user?.agency_id,
          user?.agency_id_basic,
          user?.agency_id_advanced,
          user?.agency_id_elite,
        ].filter(Boolean) as string[],
      ),
    );
    const primary = ids[0] ?? null;

    const [installedRpc, menu, home] = await Promise.all([
      supabase.rpc("is_hub_installed", { user_email: clean }),
      primary
        ? supabase
            .from("agency_menu_config")
            .select("menu_link_id")
            .eq("agency_id", primary)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      primary
        ? supabase
            .from("v2_home_settings")
            .select("welcome_headline, welcome_video_url")
            .eq("agency_id", primary)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    let highlevel = false;
    if (primary) {
      try {
        const status = await ghl<{ connection?: { connected?: boolean } }>("status", primary);
        highlevel = Boolean(status?.connection?.connected);
      } catch {
        highlevel = false;
      }
    }

    const homeRow = home.data as {
      welcome_headline?: string | null;
      welcome_video_url?: string | null;
    } | null;
    const hub = Boolean(homeRow && (homeRow.welcome_headline || homeRow.welcome_video_url));
    const install =
      Boolean(installedRpc.data) ||
      Boolean((menu.data as { menu_link_id?: string | null } | null)?.menu_link_id) ||
      Boolean(user?.install_confirmed_at);

    return { highlevel, install, hub };
  } catch {
    return EMPTY;
  }
}
