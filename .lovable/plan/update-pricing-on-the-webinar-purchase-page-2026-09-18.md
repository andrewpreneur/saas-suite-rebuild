# Update pricing on the webinar purchase page

## Goal
Update the existing pricing comparison on `/special`, the webinar purchase page, so it presents the current monthly plans alongside the webinar-only annual offer.

## What will change
- Replace the outdated “Or Choose a Monthly Plan” cards already on `/special`; do not add pricing to `/webinar`.
- Show four visible options so visitors can compare them without switching views:
  - Basic — $27/month
  - Advanced — $97/month
  - Premium Support — $297/month
  - SuperSaaSSuite Annual webinar special — $2,470/year
- Match each plan’s current home-page feature set:
  - Basic includes Starter features plus branding, video controls, AI chat support, menu-link removal, AI offer/ads tools, and up to five users.
  - Advanced includes Basic plus custom onboarding experiences, health and login/onboarding tracking, Voice AI onboarding, unlimited AI support, and unlimited users.
  - Premium Support includes everything in Advanced plus customer GHL tickets, dedicated Slack, human chat handover, founder contact, and priority developer escalation.
  - The annual special includes Advanced/Premium access and the four current done-for-you webinar bonuses.
- Use the existing embedded Stripe checkout for all four offers, preserving the working $27, $97, $297, and $2,470 payment paths.
- Keep the current `/special` annual offer, bonuses, testimonials, and remaining page structure unchanged.

## Presentation
- Reuse the home page’s current visual language: white plan cards, purple selection styling, check-mark feature lists, and secure-checkout messaging.
- Keep all four prices easy to scan on desktop and stack the cards cleanly on mobile.
- Give the webinar special a distinct “Webinar Special” treatment without changing its offer copy.

## Verification
- Confirm all four prices and their correct feature lists render on `/special` at desktop and mobile widths.
- Open each checkout and verify it requests the intended plan.
- Confirm the page has no console errors, broken links, overlap, or horizontal scrolling.
