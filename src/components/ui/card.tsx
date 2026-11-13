// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/card.tsx (new) or ./legacy/card.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/card";
import * as legacy from "./legacy/card";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Card = ui.Card;
export const CardHeader = ui.CardHeader;
export const CardFooter = ui.CardFooter;
export const CardTitle = ui.CardTitle;
export const CardDescription = ui.CardDescription;
export const CardContent = ui.CardContent;
