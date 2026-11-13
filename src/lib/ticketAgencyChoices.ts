export type TicketAgencyChoice = { id: string; label: string };

/** Plan accounts for a manual ticket. Duplicate ids (Plan 1 often matches the base id) are kept once. */
export function ticketAgencyChoices(versions: {
  base_id?: string | null;
  basic_id?: string | null;
  advanced_id?: string | null;
  elite_id?: string | null;
}): TicketAgencyChoice[] {
  const rows: [string, string | null | undefined][] = [
    ["Primary", versions.base_id],
    ["Basic", versions.basic_id],
    ["Advanced", versions.advanced_id],
    ["Elite", versions.elite_id],
  ];
  const seen = new Set<string>();
  const choices: TicketAgencyChoice[] = [];
  for (const [label, raw] of rows) {
    const id = (raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    choices.push({ id, label });
  }
  return choices;
}
