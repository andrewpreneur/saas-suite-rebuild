# Favicon and Switchyard branding

- Add an independent favicon upload, preview, replace and remove control using existing image storage and account branding saves. Install the validated image URL through the existing HighLevel JavaScript, never CSS.
- Add **2026 New UI (Switchyard)** alongside the existing Classic, Simple and Minimalist styles. Preserve legacy installations and archived presets.
- Adapt the supplied navigation stylesheet, removing client names and prefixes. Expose panel gradient, rail, text, icons, hover, selected, selected text, top bar, input, muted text and outline colors.
- Support saved CSS alone or the optional existing Theme Customizer. Cover agency/sub-account navigation, account directories, flyouts and breadcrumbs without recoloring unrelated legacy pages.
- Test generated styles, favicon installation/removal, save/restore and desktop/mobile controls. Report real signed-in HighLevel verification separately; do not publish or lift held theme-save restrictions.

## Technical approach
Use validated metadata in existing generated branding CSS, the shared generator and dynamic installation runtime; no new database permissions or schema changes. Extend the existing editor snapshot, preview and presets so saved changes survive reload and remain independently removable.