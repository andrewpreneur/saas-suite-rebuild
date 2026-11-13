// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/dropdown-menu.tsx (new) or ./legacy/dropdown-menu.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/dropdown-menu";
import * as legacy from "./legacy/dropdown-menu";

const ui = (newUi ? ds : legacy) as typeof ds;

export const DropdownMenu = ui.DropdownMenu;
export const DropdownMenuTrigger = ui.DropdownMenuTrigger;
export const DropdownMenuContent = ui.DropdownMenuContent;
export const DropdownMenuItem = ui.DropdownMenuItem;
export const DropdownMenuCheckboxItem = ui.DropdownMenuCheckboxItem;
export const DropdownMenuRadioItem = ui.DropdownMenuRadioItem;
export const DropdownMenuLabel = ui.DropdownMenuLabel;
export const DropdownMenuSeparator = ui.DropdownMenuSeparator;
export const DropdownMenuShortcut = ui.DropdownMenuShortcut;
export const DropdownMenuGroup = ui.DropdownMenuGroup;
export const DropdownMenuPortal = ui.DropdownMenuPortal;
export const DropdownMenuSub = ui.DropdownMenuSub;
export const DropdownMenuSubContent = ui.DropdownMenuSubContent;
export const DropdownMenuSubTrigger = ui.DropdownMenuSubTrigger;
export const DropdownMenuRadioGroup = ui.DropdownMenuRadioGroup;
