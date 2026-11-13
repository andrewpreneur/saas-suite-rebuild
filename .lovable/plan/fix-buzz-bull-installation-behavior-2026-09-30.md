# Fix Buzz Bull installation behavior

## Changes
- Make menu-link matching work through both HighLevel's `meta` attribute and the link URL, so the saved ID reliably reorders.
- Hide LaunchPad through its current ID, menu metadata, and URL, with a JavaScript fallback for delayed rendering.
- Scope the login redirect lock to the agency and menu-link ID so an older session flag cannot suppress Buzz Bull's redirect.
- Regenerate and deploy Buzz Bull's CSS and JavaScript for both onboarding links, then verify the live files contain all three fixes.

## Technical details
- Update only the dynamic installation generator; no website pricing, onboarding content, or other agency settings change.
- Preserve the saved ID `79aa080b-8c85-473f-ba1c-85572329a429`, LaunchPad removal enabled, and login redirect enabled.
