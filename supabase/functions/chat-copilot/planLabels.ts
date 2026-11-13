// Hub slots are not SaaSSuite subscription tiers.
// Hub 1 is agency_id, Hub 2 is agency_id_advanced, Hub 3 is agency_id_elite.
// Subscription names match the pricing cards: Starter, Basic, Advanced, Premium Support.

export interface HubSlotAccount {
  agency_id?: string | null;
  agency_id_advanced?: string | null;
  agency_id_elite?: string | null;
}

export function hubLabelForAgency(account: HubSlotAccount | null | undefined, agencyId: string | null | undefined): string {
  if (!agencyId) return "Unknown hub";
  if (agencyId === account?.agency_id) return "Hub 1";
  if (agencyId === account?.agency_id_advanced) return "Hub 2";
  if (agencyId === account?.agency_id_elite) return "Hub 3";
  return "Unknown hub";
}

export function hubLabelForSlot(slot: string | null | undefined): string {
  const value = String(slot || "").trim().toLowerCase();
  if (value === "advanced" || value === "2" || value === "hub 2") return "Hub 2";
  if (value === "elite" || value === "3" || value === "hub 3") return "Hub 3";
  return "Hub 1";
}
