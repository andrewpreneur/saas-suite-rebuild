// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/select.tsx (new) or ./legacy/select.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/select";
import * as legacy from "./legacy/select";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Select = ui.Select;
export const SelectGroup = ui.SelectGroup;
export const SelectValue = ui.SelectValue;
export const SelectTrigger = ui.SelectTrigger;
export const SelectContent = ui.SelectContent;
export const SelectLabel = ui.SelectLabel;
export const SelectItem = ui.SelectItem;
export const SelectSeparator = ui.SelectSeparator;
export const SelectScrollUpButton = ui.SelectScrollUpButton;
export const SelectScrollDownButton = ui.SelectScrollDownButton;
