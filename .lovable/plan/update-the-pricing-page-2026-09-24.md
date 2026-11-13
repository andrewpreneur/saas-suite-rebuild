# Update the pricing page

## What will change
- Keep the existing SaaSSuite and full-build pricing controls, cards, annual defaults, checkout actions, and animations intact.
- Add the same testimonial section used on the homepage beneath the pricing offers.
- Add a responsive comparison table showing typical per-feature costs for self-building, staffing support, and managing onboarding versus SaaSSuite services.
- Add a “Have a question?” section with a “Text Us” button that opens the same text-request experience already used inside the app.
- Confirm every SaaSSuite and full-build amount shown on `/pricing` comes from the current shared pricing definitions.

## Technical details
- Reuse existing testimonial and text-request components rather than creating duplicate flows.
- Keep the comparison readable on mobile without sideways page overflow.
- Preserve Stripe checkout selection, affiliate attribution, and the SaaSSuite/full-build switcher.
- Validate the page in desktop and mobile layouts and confirm the Text Us action opens correctly.
