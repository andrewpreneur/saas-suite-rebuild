/**
 * Shared podium styling for the public /challenge page and the in-app
 * Challenge tab. Gold is the tallest block and sits in the middle.
 */
export const PODIUM_TIERS = {
  gold: {
    ring: "border-amber-400/60",
    bg: "from-amber-300/25 via-amber-200/10 to-transparent",
    chip: "bg-amber-400 text-amber-950",
    height: "md:-mt-8 md:pb-12",
    label: "Gold",
    place: "1st",
  },
  silver: {
    ring: "border-slate-300/70",
    bg: "from-slate-300/25 via-slate-200/10 to-transparent",
    chip: "bg-slate-300 text-slate-900",
    height: "",
    label: "Silver",
    place: "2nd",
  },
  bronze: {
    ring: "border-orange-400/50",
    bg: "from-orange-400/20 via-orange-300/10 to-transparent",
    chip: "bg-orange-400 text-orange-950",
    height: "",
    label: "Bronze",
    place: "3rd",
  },
} as const;

export type PodiumTier = keyof typeof PODIUM_TIERS;

/** Visual order: 2nd, 1st (center, tallest), 3rd. */
export const PODIUM_SLOT_ORDER = [
  { rank: 2, tier: "silver", prizeIndex: 1 },
  { rank: 1, tier: "gold", prizeIndex: 0 },
  { rank: 3, tier: "bronze", prizeIndex: 2 },
] as const;
