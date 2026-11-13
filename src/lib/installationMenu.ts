type Menu = { menu_id: string; url: string | null };

function hubAgency(url: string | null): string | null {
  try {
    const parsed = new URL(url || "");
    if (parsed.hostname !== "yoursoftwareonboarding.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const id = /^v\d+$/.test(parts[0] || "") ? parts[1] : parts[0];
    return id ? decodeURIComponent(id) : null;
  } catch {
    return null;
  }
}

export function isCurrentInstallationMenu(menu: Menu, agencyId: string | null): boolean {
  return Boolean(agencyId) && hubAgency(menu.url) === agencyId;
}

/** Only replace a missing/old Hub selection when one unambiguous current Hub exists. */
export function resolveInstallationMenu(menus: Menu[], selectedId: string, agencyId: string | null): string {
  const selected = menus.find(menu => menu.menu_id === selectedId);
  if (selected && (isCurrentInstallationMenu(selected, agencyId) || !hubAgency(selected.url))) return selectedId;
  const current = menus.filter(menu => isCurrentInstallationMenu(menu, agencyId));
  return current.length === 1 ? current[0].menu_id : selectedId;
}