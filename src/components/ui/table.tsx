// Picks the old or the new (design system) version of this component.
// See src/lib/uiVersion.ts. Edit the look in ./ds/table.tsx (new) or ./legacy/table.tsx (old).
import { newUi } from "@/lib/uiVersion";
import * as ds from "./ds/table";
import * as legacy from "./legacy/table";

const ui = (newUi ? ds : legacy) as typeof ds;

export const Table = ui.Table;
export const TableHeader = ui.TableHeader;
export const TableBody = ui.TableBody;
export const TableFooter = ui.TableFooter;
export const TableHead = ui.TableHead;
export const TableRow = ui.TableRow;
export const TableCell = ui.TableCell;
export const TableCaption = ui.TableCaption;
