import { KIT_CUSTOMER_FIXTURES } from "@/lib/kitCustomerFixtures";
import { KIT_DELIVERABLES } from "@/lib/kitDelivery";
import { KIT_CATALOG_LINE_IDS } from "@/lib/kitEntitlement";
import { kitOnboardingSteps, kitStepProgress } from "@/lib/kitOnboarding";
import {
  emptyKitTrackerSignals,
  kitConfirmedStepIds,
  kitProgressIds,
  kitStepVisualStatus,
  type KitStepVisualStatus,
} from "@/lib/kitTracker";

export type KitCustomerAccess = "purchase" | "signup";

export type KitCustomerRecord = {
  email: string;
  name: string | null;
  agencyName: string | null;
  agencyId: string | null;
  purchaseAt: string | null;
  access: KitCustomerAccess[];
  purchasedLineIds: string[];
  comped: boolean;
  lastActivity: string | null;
  landingPageUrl: string | null;
  installConfirmedAt: string | null;
  menuLinked: boolean;
  adRequestCount: number;
  completedStepIds: string[];
  videosWatchedCount: number | null;
};

export type KitCustomerStep = {
  id: string;
  title: string;
  status: KitStepVisualStatus;
};

export type KitCustomerProgress = {
  steps: KitCustomerStep[];
  percent: number;
  label: string;
  completedCount: number;
  total: number;
};

export type KitCustomerSortKey =
  | "name"
  | "email"
  | "agency"
  | "purchased"
  | "addons"
  | "progress"
  | "activity";

const ADDON_TITLES = new Map(
  KIT_DELIVERABLES.filter((item) => item.group === "addon").map((item) => [
    item.lineId,
    item.title,
  ]),
);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

function accessList(value: unknown): KitCustomerAccess[] {
  const access: KitCustomerAccess[] = [];
  for (const item of textList(value)) {
    if (item !== "purchase" && item !== "signup") continue;
    if (!access.includes(item)) access.push(item);
  }
  return access;
}

export function parseKitCustomer(value: unknown): KitCustomerRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const email = text(row.email)?.toLowerCase() ?? "";
  if (!email.includes("@")) return null;
  const count = row.adRequestCount ?? row.ad_request_count;
  const videos = row.videosWatchedCount ?? row.videos_watched_count;
  return {
    email,
    name: text(row.name),
    agencyName: text(row.agencyName ?? row.agency_name),
    agencyId: text(row.agencyId ?? row.agency_id),
    purchaseAt: text(row.purchaseAt ?? row.purchase_at),
    access: accessList(row.access),
    purchasedLineIds: textList(row.purchasedLineIds ?? row.purchased_line_ids),
    comped: row.comped === true,
    lastActivity: text(row.lastActivity ?? row.last_activity),
    landingPageUrl: text(row.landingPageUrl ?? row.landing_page_url),
    installConfirmedAt: text(row.installConfirmedAt ?? row.install_confirmed_at),
    menuLinked: row.menuLinked === true || row.menu_linked === true,
    adRequestCount: typeof count === "number" && count > 0 ? count : 0,
    completedStepIds: textList(row.completedStepIds ?? row.completed_step_ids),
    videosWatchedCount: typeof videos === "number" ? videos : null,
  };
}

export function parseKitCustomerDirectory(data: unknown): KitCustomerRecord[] {
  if (!Array.isArray(data)) return [];
  const rows: KitCustomerRecord[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const row = parseKitCustomer(item);
    if (!row || seen.has(row.email)) continue;
    seen.add(row.email);
    rows.push(row);
  }
  return rows;
}

export function kitAddonTitles(lineIds: readonly string[]): string[] {
  const owned = new Set(lineIds);
  return KIT_DELIVERABLES.filter((item) => item.group === "addon" && owned.has(item.lineId)).map(
    (item) => item.title,
  );
}

export function kitCustomerProgress(row: KitCustomerRecord): KitCustomerProgress {
  const signals = emptyKitTrackerSignals();
  signals.installConfirmedAt = row.installConfirmedAt;
  signals.menuLinkId = row.menuLinked ? "saved" : null;
  signals.landingPageUrl = row.landingPageUrl;
  signals.adRequestCount = row.adRequestCount;
  signals.videosWatchedCount = row.videosWatchedCount;
  const steps = kitOnboardingSteps(KIT_CATALOG_LINE_IDS);
  const confirmed = kitConfirmedStepIds(signals);
  const counted = kitProgressIds(row.completedStepIds, confirmed);
  const summary = kitStepProgress(steps, counted);
  const percent =
    summary.total === 0 ? 0 : Math.round((summary.completedCount / summary.total) * 100);
  return {
    steps: steps.map((step) => ({
      id: step.id,
      title: step.title,
      status: kitStepVisualStatus(step.id, row.completedStepIds, confirmed),
    })),
    percent,
    label: summary.label,
    completedCount: summary.completedCount,
    total: summary.total,
  };
}

export function kitCustomerProgressStage(
  percent: number,
): "Not started" | "In progress" | "Confirmed" {
  if (percent >= 100) return "Confirmed";
  if (percent > 0) return "In progress";
  return "Not started";
}

function haystack(row: KitCustomerRecord): string {
  return [
    row.name,
    row.email,
    row.agencyName,
    row.agencyId,
    ...kitAddonTitles(row.purchasedLineIds),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterKitCustomers(
  rows: readonly KitCustomerRecord[],
  query: string,
): KitCustomerRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => haystack(row).includes(needle));
}

function timeValue(iso: string | null): number {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function sortValue(row: KitCustomerRecord, key: KitCustomerSortKey): string | number {
  if (key === "name") return (row.name || row.email).toLowerCase();
  if (key === "email") return row.email;
  if (key === "agency") return (row.agencyName || row.agencyId || "").toLowerCase();
  if (key === "purchased") return timeValue(row.purchaseAt);
  if (key === "addons") return kitAddonTitles(row.purchasedLineIds).length;
  if (key === "progress") return kitCustomerProgress(row).percent;
  return timeValue(row.lastActivity);
}

export function sortKitCustomers(
  rows: readonly KitCustomerRecord[],
  key: KitCustomerSortKey,
  direction: "asc" | "desc",
): KitCustomerRecord[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left < right) return -1 * factor;
    if (left > right) return 1 * factor;
    return a.email.localeCompare(b.email);
  });
}

export function kitAddonTitle(lineId: string): string {
  return ADDON_TITLES.get(lineId) ?? lineId;
}

export { KIT_CUSTOMER_FIXTURES };
