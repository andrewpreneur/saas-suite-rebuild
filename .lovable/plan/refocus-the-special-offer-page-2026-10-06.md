# Refocus the `/special` offer page

## Goal
Make the $997 offer the single primary purchase path, with its secure Stripe checkout already visible in the first section. Keep the $97 Advanced and $297 Premium Support plans as simpler alternatives below, followed by existing customer testimonials.

## Changes
- Replace the current free-with-HighLevel page with a focused $997 offer and concise included-value list.
- Render the $997 Stripe checkout directly beside the offer on desktop and immediately below it on mobile; no popup or extra click.
- Update the live Stripe mapping to use `price_1UNPAOGdZ9PRE3ZiQIH5kh8O` for this offer and keep purchase tracking, fulfillment notifications, and the post-payment route intact.
- Add a short details section supporting the primary offer without repeating multiple competing calls to action.
- Show only the $97 Advanced and $297 Premium Support plans beneath the main offer, retaining their existing popup checkouts.
- Keep the existing testimonials and a restrained header/footer.

## Technical details
- Reuse the existing inline mode in the shared Stripe checkout component.
- Update the special-offer amount and label used by conversion tracking from the prior annual offer to $997.
- Preserve existing semantic design tokens, keyboard focus, retry/error handling, and reduced-motion behavior.

## Validation
- Verify the $997 checkout initializes automatically and uses the supplied live price.
- Verify $97 and $297 still open their correct existing checkouts.
- Check desktop and 375px mobile layouts, keyboard navigation, runtime console, and current build status.
- Do not complete a real purchase or trigger customer notifications.
