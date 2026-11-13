// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/dialog.tsx (new) or ./legacy/dialog.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/dialog";
import * as legacy from "./legacy/dialog";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Dialog = ui.Dialog;
export const DialogPortal = ui.DialogPortal;
export const DialogOverlay = ui.DialogOverlay;
export const DialogTrigger = ui.DialogTrigger;
export const DialogClose = ui.DialogClose;
export const DialogContent = ui.DialogContent;
export const DialogHeader = ui.DialogHeader;
export const DialogFooter = ui.DialogFooter;
export const DialogTitle = ui.DialogTitle;
export const DialogDescription = ui.DialogDescription;
