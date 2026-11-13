// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/badge.tsx (new) or ./legacy/badge.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/badge";
import * as legacy from "./legacy/badge";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Badge = ui.Badge;
export const badgeVariants = ui.badgeVariants;
export type { BadgeProps } from "./ds/badge";
