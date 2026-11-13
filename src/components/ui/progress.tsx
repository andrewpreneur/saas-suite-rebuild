// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/progress.tsx (new) or ./legacy/progress.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/progress";
import * as legacy from "./legacy/progress";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Progress = ui.Progress;
