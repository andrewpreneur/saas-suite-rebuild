// Keeps every V2-branded sidebar inside the viewport and gives its navigation
// a compact branded scrollbar instead of the browser's full-size system UI.
//
// HighLevel's main menu pins one Settings link in `.hl_nav-settings`. The
// Settings screen reuses that class for the whole menu, and it also keeps a
// viewport min-height plus bottom padding so the old absolute footer would
// not cover the last row. Leaving those in place draws a blank band under
// the Settings list and under the settings form.
export function buildV2SidebarHeightFix(scrollbarColor: string): string {
  // Agency footers can contain Settings, App Marketplace and the agency hub.
  // Multiple links alone therefore do not identify the Settings-page menu.
  const settingsMenu = ":is(:has(a ~ a), :has(> nav > :nth-child(2))):not(:has(:is(#sb_settings, #sb_location-settings, #sb_agency-settings)))";
  return `/* === FIX: keep sidebar inside the screen === */
#sidebar-v2,
#sidebar-v2.hl_fixed-width {
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  height: 100vh !important;
  max-height: 100vh !important;
}
#sidebar-v2 .h-screen,
#sidebar-v2 .lead-connector {
  height: auto !important;
  min-height: 0 !important;
  flex: 1 1 auto !important;
}
#sidebar-v2 .hl_nav-header,
#sidebar-v2 .hl_nav-header-without-footer {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  height: auto !important;
  overflow-y: auto !important;
  padding-bottom: 8px !important;
  scrollbar-width: thin !important;
  scrollbar-color: ${scrollbarColor} transparent !important;
}
#sidebar-v2 .hl_nav-settings {
  position: relative !important;
  inset: auto !important;
  flex: 0 0 auto !important;
  height: auto !important;
  width: 100% !important;
  z-index: auto !important;
  min-height: 0 !important;
  margin-bottom: 0 !important;
  padding-bottom: 8px !important;
}
/* The single Settings footer still carries HighLevel's old collapse-control
   spacer. The collapse button sits outside the flow; don't reserve a band. */
#sidebar-v2 .hl_nav-settings > nav {
  display: flex !important;
  flex-direction: column !important;
  height: auto !important;
  min-height: 0 !important;
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}
#sidebar-v2 .hl_nav-settings a {
  position: relative !important;
  inset: auto !important;
  flex: 0 0 auto !important;
  height: auto !important;
  min-height: 40px !important;
  box-sizing: border-box !important;
}
#sidebar-v2 :is(#sb_reporting, #sb_settings, #sb_location-settings, #sb_agency-settings) {
  position: relative !important;
  inset: auto !important;
  margin-top: 0 !important;
  transform: none !important;
  z-index: auto !important;
}
/* Settings menu: more than one link in the old footer slot. Let it fill and
   drop the spacer that used to clear the pinned Settings row. */
#sidebar-v2:has(.hl_nav-settings #sb_settings) .hl_nav-settings,
#sidebar-v2:has(.hl_nav-settings #sb_location-settings) .hl_nav-settings,
#sidebar-v2:has(.hl_nav-settings #sb_agency-settings) .hl_nav-settings {
  flex: 0 0 auto !important;
  overflow: visible !important;
}
#sidebar-v2:has(.hl_nav-settings #sb_settings) :is(.hl_nav-header, .hl_nav-header-without-footer),
#sidebar-v2:has(.hl_nav-settings #sb_location-settings) :is(.hl_nav-header, .hl_nav-header-without-footer),
#sidebar-v2:has(.hl_nav-settings #sb_agency-settings) :is(.hl_nav-header, .hl_nav-header-without-footer) {
  flex: 1 1 auto !important;
  overflow-y: auto !important;
}
#sidebar-v2 .hl_nav-settings${settingsMenu} {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  height: auto !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  padding-bottom: 0 !important;
}
#sidebar-v2 .hl_nav-settings${settingsMenu} > nav,
#sidebar-v2 .hl_nav-header-without-footer,
#sidebar-v2 .hl_nav-header-without-footer > nav {
  min-height: 0 !important;
  padding-bottom: 0 !important;
}
#sidebar-v2:has(.hl_nav-settings${settingsMenu}) :is(.hl_nav-header, .hl_nav-header-without-footer) {
  flex: 0 0 auto !important;
  height: auto !important;
  min-height: 0 !important;
  padding-bottom: 0 !important;
  overflow: visible !important;
}
/* Settings form. A viewport min-height under the header, or padding kept for
   a removed footer, is the blank band at the bottom of Settings. */
#companySettingsPage,
.companySettingsPage,
.hl_settings--body,
.hl_settings--main {
  min-height: 0 !important;
  padding-bottom: 0 !important;
  margin-bottom: 0 !important;
}
#sidebar-v2 .hl_nav-header::-webkit-scrollbar,
#sidebar-v2 .hl_nav-header-without-footer::-webkit-scrollbar,
#sidebar-v2 .hl_nav-settings${settingsMenu}::-webkit-scrollbar {
  width: 5px !important;
}
#sidebar-v2 .hl_nav-header::-webkit-scrollbar-track,
#sidebar-v2 .hl_nav-header-without-footer::-webkit-scrollbar-track,
#sidebar-v2 .hl_nav-settings${settingsMenu}::-webkit-scrollbar-track {
  background: transparent !important;
}
#sidebar-v2 .hl_nav-header::-webkit-scrollbar-thumb,
#sidebar-v2 .hl_nav-header-without-footer::-webkit-scrollbar-thumb,
#sidebar-v2 .hl_nav-settings${settingsMenu}::-webkit-scrollbar-thumb {
  background-color: ${scrollbarColor} !important;
  border-radius: 999px !important;
}
`;
}
