import { supabase } from "@/integrations/supabase/client";

/**
 * What the signed-in account can prove about kit onboarding.
 * Reads existing columns only. Nothing here writes, and nothing here
 * treats a missing read as "not done".
 */
export type KitTrackerSignals = {
  installConfirmedAt: string | null;
  hubInstalled: boolean;
  menuLinkId: string | null;
  menuLinkId2: string | null;
  /** Defaults to true on every account, so it is never confirmation by itself. */
  dynamicInstallation: boolean | null;
  /** Entitlement flag. It does not mean the snapshot was imported. */
  snapshotAccess: boolean | null;
  /** Total views. It is not tied to a specific kit video. */
  videosWatchedCount: number | null;
  adRequestCount: number;
  /** Landing page this buyer uses to sell the offer. */
  landingPageUrl: string | null;
};

export function emptyKitTrackerSignals(): KitTrackerSignals {
  return {
    installConfirmedAt: null,
    hubInstalled: false,
    menuLinkId: null,
    menuLinkId2: null,
    dynamicInstallation: null,
    snapshotAccess: null,
    videosWatchedCount: null,
    adRequestCount: 0,
    landingPageUrl: null,
  };
}

export type KitPurchaseRow = {
  line_id?: string | null;
  email?: string | null;
  comped?: boolean | null;
  user_id?: string | null;
};

/** Every line on the rows this login can read, including comped and email-only rows. */
export function kitLineIdsFromPurchaseRows(
  rows: readonly KitPurchaseRow[] | null | undefined,
): string[] {
  const ids: string[] = [];
  for (const row of rows ?? []) {
    const id = row.line_id?.trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

const HAS_URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** http(s) URL, adding https:// when the scheme was left off. */
export function normalizeKitLandingPageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000 || /\s/.test(trimmed)) return null;
  const candidate = HAS_URL_SCHEME.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/\//, "")}`;
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname || !/[a-z0-9]/i.test(parsed.hostname)) return null;
    return candidate;
  } catch {
    return null;
  }
}

/** Install is confirmed from a real install signal. The CSS flag defaults on, so it does not count. */
export function kitInstallConfirmed(signals: KitTrackerSignals): boolean {
  return Boolean(
    signals.installConfirmedAt ||
    signals.hubInstalled ||
    filled(signals.menuLinkId) ||
    filled(signals.menuLinkId2),
  );
}

/** Step ids SaaSSuite can mark confirmed from stored data. */
export function kitConfirmedStepIds(signals: KitTrackerSignals): string[] {
  const ids: string[] = [];
  if (kitInstallConfirmed(signals)) ids.push("install-saas");
  if (filled(signals.landingPageUrl)) ids.push("sales-page");
  if (signals.adRequestCount > 0) ids.push("launch-ads");
  return ids;
}

export function kitProgressIds(manual: Iterable<string>, confirmed: Iterable<string>): string[] {
  return [...new Set([...manual, ...confirmed])];
}

export type KitStepVisualStatus = "confirmed" | "marked" | "open";

export function kitStepVisualStatus(
  stepId: string,
  manual: Iterable<string>,
  confirmed: Iterable<string>,
): KitStepVisualStatus {
  if (new Set(confirmed).has(stepId)) return "confirmed";
  if (new Set(manual).has(stepId)) return "marked";
  return "open";
}

const UNVERIFIED_STEP_IDS = new Set([
  "replay",
  "install-snapshot",
  "customize-video",
  "saas-training",
  "menu-training",
]);

export function kitStepVerificationNote(
  stepId: string,
  status: KitStepVisualStatus,
  signals: KitTrackerSignals,
): string | null {
  if (status === "confirmed" && stepId === "install-saas") {
    return "Confirmed from the install record, the hub install check, or a saved menu link.";
  }
  if (status === "confirmed" && stepId === "launch-ads") {
    return "Confirmed. An ad customization request is saved on this account.";
  }
  if (status === "confirmed" && stepId === "sales-page") {
    return "Confirmed: your landing page is saved.";
  }
  if (status === "marked")
    return "Marked done in this browser. SaaSSuite has not confirmed it from saved data.";
  if (stepId === "install-saas") {
    return "Waiting on a saved install time, a hub install check, or a menu link on the account.";
  }
  if (stepId === "launch-ads") {
    return "An ad customization request is the part SaaSSuite can confirm. A live campaign is not stored.";
  }
  if (stepId === "sales-page") {
    return "Save the landing page you use to sell this offer.";
  }
  if (UNVERIFIED_STEP_IDS.has(stepId)) {
    const watch =
      typeof signals.videosWatchedCount === "number"
        ? ` Video views on the account: ${signals.videosWatchedCount}. That total is not matched to this step.`
        : "";
    return `SaaSSuite has no saved record for this step.${watch} Mark it done when you finish.`;
  }
  return null;
}

/** The onboarding table accepts inserts and does not allow this login to read them back. */
export const KIT_ONBOARDING_FORM_READABLE = false;

export type KitAccountCheck = {
  id: string;
  label: string;
  status: "confirmed" | "purchased" | "unverified" | "open";
  detail: string;
};

export function kitAccountChecks(
  lineIds: readonly string[],
  signals: KitTrackerSignals,
): KitAccountCheck[] {
  const owned = new Set(lineIds);
  const purchase = (id: string, label: string, purchasedDetail: string): KitAccountCheck =>
    owned.has(id)
      ? { id, label, status: "confirmed", detail: purchasedDetail }
      : { id, label, status: "open", detail: "Not purchased." };

  return [
    purchase("launch", "Launch Pack", "Confirmed. The Launch Pack purchase is on this account."),
    purchase(
      "webinar-system",
      "Webinar Sales System",
      "Confirmed. The webinar purchase is on this account.",
    ),
    owned.has("bump-video")
      ? {
          id: "bump-video",
          label: "Branded video request",
          status: "purchased",
          detail:
            "Purchased. The intake form is write-only, so the request itself stays unverified.",
        }
      : {
          id: "bump-video",
          label: "Branded video request",
          status: "open",
          detail: "Not purchased.",
        },
    owned.has("bump-install")
      ? {
          id: "bump-install",
          label: "DFY install request",
          status: "purchased",
          detail:
            "Purchased. The intake form is write-only, so the request itself stays unverified.",
        }
      : {
          id: "bump-install",
          label: "DFY install request",
          status: "open",
          detail: "Not purchased.",
        },
    {
      id: "onboarding-form",
      label: "Onboarding form",
      status: KIT_ONBOARDING_FORM_READABLE ? "confirmed" : "unverified",
      detail: "Unverified. This login cannot read the saved onboarding form.",
    },
    {
      id: "snapshot-import",
      label: "Snapshot import",
      status: "unverified",
      detail: signals.snapshotAccess
        ? "Unverified. Snapshot access is on, and that flag records entitlement rather than an import."
        : "Unverified. No import record is stored on the account.",
    },
  ];
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Read install, menu, watch, ad-request, and landing-page rows. Failures leave the signal empty
 * so the step list stays on screen.
 */
export async function loadKitTrackerSignals(
  email: string | null | undefined,
): Promise<KitTrackerSignals> {
  const signals = emptyKitTrackerSignals();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const clean = (email ?? auth.user?.email ?? "").trim().toLowerCase();
    const userId = auth.user?.id ?? null;
    const [userResult, hubResult, adResult, landingResult] = await Promise.all([
      clean
        ? supabase
            .from("saas_suite_users")
            .select(
              "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, install_confirmed_at, dynamic_installation, snapshot_access, videos_watched_count",
            )
            .ilike("email", clean)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      clean
        ? supabase.rpc("is_hub_installed", { user_email: clean })
        : Promise.resolve({ data: false, error: null }),
      supabase.from("kit_ad_requests").select("id"),
      userId
        ? supabase.from("kit_landing_pages").select("url").eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const user = userResult.data;
    if (user) {
      signals.installConfirmedAt = textOrNull(user.install_confirmed_at);
      signals.dynamicInstallation =
        typeof user.dynamic_installation === "boolean" ? user.dynamic_installation : null;
      signals.snapshotAccess =
        typeof user.snapshot_access === "boolean" ? user.snapshot_access : null;
      signals.videosWatchedCount =
        typeof user.videos_watched_count === "number" ? user.videos_watched_count : null;
      const agencyIds = [
        user.agency_id,
        user.agency_id_basic,
        user.agency_id_advanced,
        user.agency_id_elite,
      ].filter((id): id is string => typeof id === "string" && id.trim().length > 0);
      if (agencyIds.length > 0) {
        const { data: menus } = await supabase
          .from("agency_menu_config")
          .select("menu_link_id, menu_link_id_2")
          .in("agency_id", agencyIds);
        const withLink = (menus ?? []).find(
          (row) => filled(row.menu_link_id) || filled(row.menu_link_id_2),
        );
        signals.menuLinkId = textOrNull(withLink?.menu_link_id);
        signals.menuLinkId2 = textOrNull(withLink?.menu_link_id_2);
      }
    }
    signals.hubInstalled = hubResult.data === true;
    signals.adRequestCount = adResult.data?.length ?? 0;
    signals.landingPageUrl = textOrNull(landingResult.data?.url);
  } catch {
    return signals;
  }
  return signals;
}
