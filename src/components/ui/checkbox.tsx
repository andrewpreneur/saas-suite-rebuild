// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/checkbox.tsx (new) or ./legacy/checkbox.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/checkbox";
import * as legacy from "./legacy/checkbox";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Checkbox = ui.Checkbox;
