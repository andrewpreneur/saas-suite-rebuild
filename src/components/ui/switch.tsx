// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/switch.tsx (new) or ./legacy/switch.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/switch";
import * as legacy from "./legacy/switch";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Switch = ui.Switch;
