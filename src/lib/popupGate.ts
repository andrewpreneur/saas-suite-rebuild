// Ensures only one auto-opening popup shows per page load.
let claimedBy: string | null = null;

export function claimPopup(name: string): boolean {
  if (claimedBy && claimedBy !== name) return false;
  claimedBy = name;
  return true;
}
