// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/tooltip.tsx (new) or ./legacy/tooltip.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/tooltip";
import * as legacy from "./legacy/tooltip";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Tooltip = ui.Tooltip;
export const TooltipTrigger = ui.TooltipTrigger;
export const TooltipContent = ui.TooltipContent;
export const TooltipProvider = ui.TooltipProvider;
