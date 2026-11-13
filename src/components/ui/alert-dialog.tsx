// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/alert-dialog.tsx (new) or ./legacy/alert-dialog.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/alert-dialog";
import * as legacy from "./legacy/alert-dialog";

const ui = (newUi ? ds : legacy) as typeof ds;

export const AlertDialog = ui.AlertDialog;
export const AlertDialogPortal = ui.AlertDialogPortal;
export const AlertDialogOverlay = ui.AlertDialogOverlay;
export const AlertDialogTrigger = ui.AlertDialogTrigger;
export const AlertDialogContent = ui.AlertDialogContent;
export const AlertDialogHeader = ui.AlertDialogHeader;
export const AlertDialogFooter = ui.AlertDialogFooter;
export const AlertDialogTitle = ui.AlertDialogTitle;
export const AlertDialogDescription = ui.AlertDialogDescription;
export const AlertDialogAction = ui.AlertDialogAction;
export const AlertDialogCancel = ui.AlertDialogCancel;
