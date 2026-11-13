// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/accordion.tsx (new) or ./legacy/accordion.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/accordion";
import * as legacy from "./legacy/accordion";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Accordion = ui.Accordion;
export const AccordionItem = ui.AccordionItem;
export const AccordionTrigger = ui.AccordionTrigger;
export const AccordionContent = ui.AccordionContent;
