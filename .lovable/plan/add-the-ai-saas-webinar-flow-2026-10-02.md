# Add the AI SaaS webinar flow

## Build
- Duplicate `/webinar-2` at `/ai-saas-webinar`, preserving its layout, content, tracking, testimonials, and calls to action.
- Change only the main headline to “Watch Me Build A Dummy-Proof AI SaaS Product + Sales System In 90 Minutes For $0”.
- Replace the registration popup with the supplied WebinarKit widget for webinar `6ac025c8b106329d6236ba46`.
- Duplicate the current confirmation experience at `/ai-saas-webinar-confirmation` and use the supplied matching confirmation widget.
- Keep registration capture, attribution, Meta tracking, and the registrant offer behavior connected as they are on the existing flow.

## Verification
- Confirm both new addresses load and the two widgets use the matching webinar ID.
- Confirm the original `/webinar-2` and `/webinar-confirmation` pages remain unchanged.
- Confirm the app build has no errors without submitting a live registration.
