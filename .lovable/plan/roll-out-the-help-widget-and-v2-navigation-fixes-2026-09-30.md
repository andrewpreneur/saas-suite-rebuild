# Roll out the help widget and V2 navigation fixes

## Changes
- Show the Top Navigation Help Widget settings to every account and apply the proven embed-aware behavior wherever enabled.
- Apply the tested V2 sidebar height fix to every account with V2 branding, replacing the system scrollbar with a slimmer branded scrollbar.
- Keep the Home, Education, Support, Popup, and Theme navigation visible while editing Theme.
- Deploy the updated installation-code generator, clear/regenerate affected V2 account assets, and verify the app and generated CSS/JS.

## Technical details
- Remove the account-specific UI and generated-code gates rather than changing existing enablement values.
- Detect V2 branding from the existing generated branding stylesheet, so future V2 accounts inherit the sidebar styling automatically.
- Mount the shared Client Hub page selector inside the Theme panel, matching the other panels.
