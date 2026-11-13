// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/textarea.tsx (new) or ./legacy/textarea.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/textarea";
import * as legacy from "./legacy/textarea";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Textarea = ui.Textarea;
