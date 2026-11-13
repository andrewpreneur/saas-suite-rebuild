// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/tabs.tsx (new) or ./legacy/tabs.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/tabs";
import * as legacy from "./legacy/tabs";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Tabs = ui.Tabs;
export const TabsList = ui.TabsList;
export const TabsTrigger = ui.TabsTrigger;
export const TabsContent = ui.TabsContent;
