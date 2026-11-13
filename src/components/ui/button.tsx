// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/button.tsx (new) or ./legacy/button.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/button";
import * as legacy from "./legacy/button";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Button = ui.Button;
export const buttonVariants = ui.buttonVariants;
export type { ButtonProps } from "./ds/button";
