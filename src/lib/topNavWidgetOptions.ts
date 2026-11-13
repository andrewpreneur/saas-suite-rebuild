export {
  DEFAULT_CARD_SUBTITLE,
  DEFAULT_CARD_TITLE,
  DEFAULT_TOP_NAV_WIDGET_OPTIONS,
  EMBED_TAB_BY_ID,
  EMBED_TAB_LABELS,
  POPUP_EMBED_TABS,
  TOP_NAV_WIDGET_ICONS,
  TOP_NAV_WIDGET_ICON_LABELS,
  isSafeTarget,
  sanitizeTopNavWidgetConfig,
  sanitizeTopNavWidgetOptions,
  targetError,
} from "../../supabase/functions/_shared/topNavWidgetOptions.ts";
export { resolveTopNavWidgetColor } from "../../supabase/functions/_shared/topNavWidgetColor.ts";
export type {
  TopNavWidgetConfig,
  TopNavWidgetEmbedTab,
  TopNavWidgetIcon,
  TopNavWidgetOpenMode,
  TopNavWidgetOption,
  TopNavWidgetShowOn,
} from "../../supabase/functions/_shared/topNavWidgetOptions.ts";
