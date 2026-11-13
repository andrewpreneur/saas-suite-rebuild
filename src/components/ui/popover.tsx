// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/popover.tsx (new) or ./legacy/popover.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/popover";
import * as legacy from "./legacy/popover";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Popover = ui.Popover;
export const PopoverTrigger = ui.PopoverTrigger;
export const PopoverContent = ui.PopoverContent;
export const PopoverAnchor = ui.PopoverAnchor;
