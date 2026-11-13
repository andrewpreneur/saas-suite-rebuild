# AI SaaS webinar registration fixes

## Changes
- Send registrations from `/ai-saas-webinar` to the new HighLevel webhook while leaving other webinar campaigns on their existing destination.
- Add `/ai-studio-webinar-confirmation` as the confirmation page WebinarKit is configured to open, while keeping the existing confirmation URL working.
- Make the headline mirror Webinar 2’s typography and accent treatment, highlighting the key product-and-sales phrase.
- Keep the WebinarKit registration button purple/pink even after its script initializes and reapplies widget styling.

## Validation
- Review the resulting route and code paths without submitting another registration or triggering the webhook.
- Confirm the project build is clean from the automated build log.

## Technical details
- Route webhook delivery by registration page inside the existing registration capture function.
- Use the existing confirmation page component for both URLs so the matching WebinarKit ID and tracking flow remain shared.
- Apply the button override from the page after WebinarKit initializes so vendor styles cannot replace it.
