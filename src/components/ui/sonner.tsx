// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/sonner.tsx (new) or ./legacy/sonner.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/sonner";
import * as legacy from "./legacy/sonner";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Toaster = ui.Toaster;
export const toast = ui.toast;
