# Curate the support case studies

## What will change
- Replace the automatically chosen examples with the exact five conversations requested: Deborah, Charlayne, Become Unshoppable, Joanie, and Natalie Hankins.
- Package each full conversation as a real case study, preserving multi-question stories instead of reducing every case to one question.
- Give multi-question cases outcome-led headlines such as “11 questions answered in 2 hours,” calculated from the recorded conversation.
- Include the DNS screenshots through privacy-safe links, visibly blur them, and remove names, agency names, emails, URLs, and identifying text from all public copy.
- Keep the existing card and four-section popup format, adding a screenshot gallery only where the conversation contains useful images.

## Quality controls
- Use only recorded messages and genuine positive feedback; no invented claims or reconstructed quotes.
- Preserve whether AI or a human handled each part of the conversation.
- Rebuild the fixed snapshot once with these curated cases, then continue serving it instantly without background refreshes.

## Technical details
- Add a curated conversation list and full-thread packaging to the support endpoint.
- Proxy approved screenshots through anonymous case-specific URLs so storage paths and agency identifiers are never exposed.
- Extend the case-study response and popup to support optional blurred screenshots and accurate question/time counts.
- Deploy the endpoint, rebuild the snapshot, and verify the public page response contains no identifying names, emails, agency names, or source URLs.
