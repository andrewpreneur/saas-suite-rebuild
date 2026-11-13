// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/input.tsx (new) or ./legacy/input.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/input";
import * as legacy from "./legacy/input";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Input = ui.Input;
