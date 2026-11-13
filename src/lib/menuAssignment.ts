/** Pure planning for "Assign to Sub Account". HighLevel's update is a full PUT. */

export interface MenuSnapshot {
  title?: string | null;
  url?: string | null;
  icon?: { name?: string; fontFamily?: string } | null;
  showOnCompany?: boolean | null;
  showOnLocation?: boolean | null;
  showToAllLocations?: boolean | null;
  openMode?: string | null;
  userRole?: string | null;
  allowCamera?: boolean | null;
  allowMicrophone?: boolean | null;
  locations?: unknown;
  locationIds?: unknown;
  location_ids?: unknown;
}

export function locationIdOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    const id = row.id ?? row._id ?? row.locationId ?? row.location_id;
    return typeof id === "string" ? id.trim() : "";
  }
  return "";
}

export function locationIdsFromMenu(menu: MenuSnapshot | null | undefined): string[] {
  const raw = menu?.locations ?? menu?.locationIds ?? menu?.location_ids ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map(locationIdOf).filter((id) => /^[A-Za-z0-9_-]{4,64}$/.test(id));
}

export interface AssignmentPlan {
  changed: boolean;
  reason?: "already_everywhere" | "already_set" | "missing_roster";
  locationIds: string[];
  body?: Record<string, unknown>;
}

/**
 * Add puts the sub-account on the menu link. If the link is already shown in
 * every sub-account, add is a no-op until the caller passes restrict (which
 * limits the link to the accounts we know about, including this one).
 * Remove never wipes the list when HighLevel stored "all locations" with an
 * empty locations array — that used to hide the link everywhere.
 */
export function planMenuAssignment(
  menu: MenuSnapshot,
  locationId: string,
  mode: "add" | "remove",
  options: { knownLocationIds?: string[]; restrict?: boolean } = {},
): AssignmentPlan {
  const known = (options.knownLocationIds ?? []).map(locationIdOf).filter(Boolean);
  const current = locationIdsFromMenu(menu);
  const showAll = Boolean(menu.showToAllLocations);
  const base = showAll && current.length === 0 ? known : current;

  if (showAll && mode === "add" && !options.restrict) {
    return { changed: false, reason: "already_everywhere", locationIds: base };
  }
  if (showAll && mode === "remove" && base.length === 0) {
    return { changed: false, reason: "missing_roster", locationIds: [] };
  }

  const next =
    mode === "add"
      ? Array.from(new Set([...base, locationId]))
      : base.filter((id) => id !== locationId);
  const changed =
    showAll || next.length !== current.length || next.some((id, index) => id !== current[index]);
  if (!changed) return { changed: false, reason: "already_set", locationIds: current };

  const icon = menu.icon?.name
    ? { name: menu.icon.name, fontFamily: menu.icon.fontFamily || "fas" }
    : { name: "graduation-cap", fontFamily: "fas" };

  return {
    changed: true,
    locationIds: next,
    body: {
      title: String(menu.title || "Client Hub").slice(0, 60),
      url: String(menu.url || "https://saassuite.ai"),
      icon,
      showOnCompany: Boolean(menu.showOnCompany),
      showOnLocation: true,
      showToAllLocations: false,
      openMode: menu.openMode || "iframe",
      locations: next,
      userRole: menu.userRole || "all",
      allowCamera: Boolean(menu.allowCamera),
      allowMicrophone: Boolean(menu.allowMicrophone),
    },
  };
}
