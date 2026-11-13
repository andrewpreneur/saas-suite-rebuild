/** Shared default ticket types. The database copy is public.ticket_category_defaults(). */
export const DEFAULT_TICKET_CATEGORIES = [
  "General Inquiry",
  "Technical Issue",
  "Billing Question",
  "Account Access",
  "Website Edits",
  "Feature Request",
  "Other",
] as const;

export const TICKET_CATEGORY_MAX_LENGTH = 80;

export type AgencyTicketCategory = {
  label: string;
  is_default: boolean;
  sort_order: number;
};

export type StoredTicketCategory = {
  id?: string;
  label: string;
  sort_order: number;
  is_hidden: boolean;
  is_default: boolean;
};

export function defaultAgencyTicketCategories(): AgencyTicketCategory[] {
  return DEFAULT_TICKET_CATEGORIES.map((label, sort_order) => ({
    label,
    is_default: true,
    sort_order,
  }));
}

export function normalizeAgencyTicketCategories(data: unknown): AgencyTicketCategory[] {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("Ticket types could not be read");
    }
  }
  if (!Array.isArray(value)) throw new Error("Ticket types could not be read");
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!label || label.length > TICKET_CATEGORY_MAX_LENGTH) return [];
    const sort = Number(record.sort_order);
    return [
      {
        label,
        is_default: record.is_default === true,
        sort_order: Number.isFinite(sort) ? sort : 0,
      },
    ];
  });
}

/** Agency labels first, then ticket values that are not already in the list. */
export function mergeTicketCategoryOptions(
  agencyLabels: string[],
  ticketLabels: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const label of [...agencyLabels, ...ticketLabels]) {
    const trimmed = typeof label === "string" ? label.trim() : "";
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }
  return merged;
}

export type TicketTypeEditorRow = {
  label: string;
  sort_order: number;
  is_hidden: boolean;
  is_default: boolean;
};

export function buildTicketTypeEditorRows(stored: StoredTicketCategory[]): TicketTypeEditorRow[] {
  const defaults = new Set(DEFAULT_TICKET_CATEGORIES.map((label) => label.toLowerCase()));
  const storedByLabel = new Map(stored.map((row) => [row.label.trim().toLowerCase(), row]));
  const rows: TicketTypeEditorRow[] = DEFAULT_TICKET_CATEGORIES.map((label, index) => {
    const row = storedByLabel.get(label.toLowerCase());
    return {
      label,
      sort_order: row?.sort_order ?? index,
      is_hidden: Boolean(row?.is_default && row.is_hidden),
      is_default: true,
    };
  });
  for (const row of stored) {
    const key = row.label.trim().toLowerCase();
    if (!key || defaults.has(key) || row.is_default) continue;
    rows.push({
      label: row.label.trim(),
      sort_order: row.sort_order,
      is_hidden: row.is_hidden,
      is_default: false,
    });
  }
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function moveTicketType(
  rows: TicketTypeEditorRow[],
  label: string,
  direction: -1 | 1,
): TicketTypeEditorRow[] {
  const active = rows.filter((row) => !row.is_hidden);
  const hidden = rows.filter((row) => row.is_hidden);
  const index = active.findIndex((row) => row.label.toLowerCase() === label.toLowerCase());
  const next = index + direction;
  if (index < 0 || next < 0 || next >= active.length) return rows;
  const reordered = [...active];
  const [item] = reordered.splice(index, 1);
  reordered.splice(next, 0, item);
  return [...reordered.map((row, sort_order) => ({ ...row, sort_order })), ...hidden];
}

export function ticketTypeLabelError(label: string, existing: string[]): string | null {
  const trimmed = label.trim();
  if (!trimmed) return "Enter a ticket type";
  if (trimmed.length > TICKET_CATEGORY_MAX_LENGTH) return "Ticket types can be up to 80 characters";
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase()))
    return "That ticket type already exists";
  return null;
}

/** Same visible list as get_agency_ticket_categories, for the dev mock and unit tests. */
export function visibleTicketCategories(stored: StoredTicketCategory[]): AgencyTicketCategory[] {
  const defaults = new Set(DEFAULT_TICKET_CATEGORIES.map((label) => label.toLowerCase()));
  const visibleDefaults = DEFAULT_TICKET_CATEGORIES.flatMap((label, index) => {
    const row = stored.find(
      (item) => item.is_default && item.label.trim().toLowerCase() === label.toLowerCase(),
    );
    if (row?.is_hidden) return [];
    return [{ label, is_default: true, sort_order: row?.sort_order ?? index }];
  });
  const customs = stored.flatMap((row) => {
    const label = row.label.trim();
    if (!label || row.is_default || row.is_hidden || defaults.has(label.toLowerCase())) return [];
    return [{ label, is_default: false, sort_order: row.sort_order }];
  });
  return [...visibleDefaults, ...customs].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
  );
}
