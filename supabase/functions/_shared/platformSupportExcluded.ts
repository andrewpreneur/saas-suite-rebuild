// Agencies that run their own support are listed in public.platform_support_excluded_agencies.
// The database helper is_platform_support_excluded is the source of truth. These functions
// mirror that match (lowercase, strip a trailing "NO", any plan agency id on the owner)
// so edge functions and tests share one decision.
//
// Fail closed for platform notifications: a missing or failed exclusion lookup does not
// send the Grok handover, the LeadConnector ping to Andrew, or an unfiltered admin queue.
// Fail open for agency features: assignee webhooks, the agency's own support_webhook_url,
// and in-account support never consult this list. A lookup error must not block them.

export type ExclusionResult = "excluded" | "allowed" | "unknown";

export type AgencyIdOwner = {
  email?: string | null;
  agency_id?: string | null;
  agency_id_basic?: string | null;
  agency_id_advanced?: string | null;
  agency_id_elite?: string | null;
};

export type RpcResult = { data?: unknown; error?: { message?: string } | null };

export type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

/** Same key the SQL helper uses: trim, strip one trailing NO, lowercase. */
export function normalizeAgencyId(agencyId: string | null | undefined): string {
  return String(agencyId ?? "").trim().replace(/NO$/i, "").toLowerCase();
}

export function ownerAgencyIds(owner: AgencyIdOwner): string[] {
  return [owner.agency_id, owner.agency_id_basic, owner.agency_id_advanced, owner.agency_id_elite]
    .map((id) => normalizeAgencyId(id))
    .filter((id) => id.length > 0);
}

/** Seed predicate: agency id matches prefix% after the same normalization (SQL LIKE). */
export function agencyIdMatchesPrefix(agencyId: string | null | undefined, prefix: string): boolean {
  const id = normalizeAgencyId(agencyId);
  const needle = prefix.trim().toLowerCase();
  return needle.length > 0 && id.startsWith(needle);
}

export function ownerMatchesAgencyPrefix(owner: AgencyIdOwner, prefix: string): boolean {
  return [owner.agency_id, owner.agency_id_basic, owner.agency_id_advanced, owner.agency_id_elite]
    .some((id) => agencyIdMatchesPrefix(id, prefix));
}

/** Plan ids for owners whose email is on the exclusion list. */
export function excludedAgencyIdSet(owners: AgencyIdOwner[], excludedEmails: string[]): Set<string> {
  const emails = new Set(excludedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  const ids = new Set<string>();
  for (const owner of owners) {
    const email = (owner.email || "").trim().toLowerCase();
    if (!emails.has(email)) continue;
    for (const id of ownerAgencyIds(owner)) ids.add(id);
  }
  return ids;
}

export function isAgencyIdExcluded(agencyId: string | null | undefined, excluded: Set<string>): boolean {
  const id = normalizeAgencyId(agencyId);
  return id.length > 0 && excluded.has(id);
}

export function filterPlatformQueue<T extends { agency_id?: string | null }>(rows: T[], excluded: Set<string>): T[] {
  return rows.filter((row) => !isAgencyIdExcluded(row.agency_id, excluded));
}

export function agencyIdsFromExclusionRpc(data: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(data)) return ids;
  for (const row of data) {
    const raw = typeof row === "string"
      ? row
      : row && typeof row === "object" && "agency_id" in row
        ? (row as { agency_id?: unknown }).agency_id
        : null;
    const id = normalizeAgencyId(typeof raw === "string" ? raw : null);
    if (id) ids.add(id);
  }
  return ids;
}

/** Throws when the list cannot be read. Callers of platform queues must not continue unfiltered. */
export async function loadExcludedAgencyIds(db: RpcClient): Promise<Set<string>> {
  const { data, error } = await db.rpc("platform_support_excluded_agency_ids");
  if (error) throw new Error(error.message || "platform support exclusion list unavailable");
  return agencyIdsFromExclusionRpc(data);
}

export async function readPlatformSupportExclusion(
  db: RpcClient | null | undefined,
  agencyId: string,
): Promise<ExclusionResult> {
  if (!db || typeof db.rpc !== "function") return "unknown";
  try {
    const { data, error } = await db.rpc("is_platform_support_excluded", { p_agency_id: agencyId });
    if (error) return "unknown";
    return data === true ? "excluded" : "allowed";
  } catch {
    return "unknown";
  }
}

/** Platform notifications send only when the agency is known to be allowed. */
export function allowPlatformNotification(result: ExclusionResult): boolean {
  return result === "allowed";
}

/**
 * Global handover gate. A dedupe stub with no rpc cannot check the list (unit tests).
 * A real service client has rpc: excluded and unknown both skip the POST (fail closed).
 */
export async function globalHandoverExclusionGate(
  db: { rpc?: RpcClient["rpc"] } | null | undefined,
  agencyId: string,
): Promise<"send" | "skip"> {
  if (!db || typeof db.rpc !== "function") return "send";
  const result = await readPlatformSupportExclusion(db as RpcClient, agencyId);
  return allowPlatformNotification(result) ? "send" : "skip";
}

export async function deliverPlatformSupportAlert(args: {
  exclusion: ExclusionResult;
  postLeadConnector: () => Promise<void>;
  postGlobal: () => Promise<void>;
}): Promise<"sent" | "skipped"> {
  if (!allowPlatformNotification(args.exclusion)) return "skipped";
  await args.postLeadConnector();
  await args.postGlobal();
  return "sent";
}

export function platformLeadConnectorDecision(args: {
  exclusion: ExclusionResult;
  mode: string;
  ownerIsPlatformAccount: boolean;
  emailAlertsOn: boolean;
}): "skip-self-managed" | "skip-excluded" | "skip-email-off" | "send" {
  if (args.mode !== "managed" && !args.ownerIsPlatformAccount) return "skip-self-managed";
  if (!allowPlatformNotification(args.exclusion)) return "skip-excluded";
  if (!args.emailAlertsOn) return "skip-email-off";
  return "send";
}

/** Assignment pings to the agency's own people do not read the exclusion list. */
export function agencyAssigneeWebhookSends(isAssignment: boolean, hasAssignee: boolean): boolean {
  return isAssignment && hasAssignee;
}

/**
 * Platform-admin inbox visibility. Agency members are not platform admins, so an
 * excluded agency still sees its own chats and tickets.
 */
export function platformAdminSeesSupportRow(isPlatformAdmin: boolean, excluded: boolean): boolean {
  if (!isPlatformAdmin) return true;
  return !excluded;
}
