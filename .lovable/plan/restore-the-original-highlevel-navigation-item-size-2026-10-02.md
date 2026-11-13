# Restore the original HighLevel navigation item size

## Changes
- Remove the broad row-wrapping layout override that is stretching HighLevel's left-navigation items.
- Keep the saved custom menu link moving to the top through a column layout with normal item sizing.
- Apply the same safe layout to the current dynamic installer and the installation-code previews so future installs behave consistently.
- Regenerate and deploy the dynamic styling for `team@yoursoftwareonboarding.com` so the correction reaches that account.

## Technical details
- Scope the layout rule to `#sidebar-v2 .hl_nav-header > nav` and use a vertical flex direction with `align-items: stretch`; do not change branding colors or menu-removal selections.
- Update the JavaScript fallback to preserve HighLevel's vertical navigation instead of forcing `row wrap`.
