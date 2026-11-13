# Public SaaSSuite Setup & Knowledge Base

## Goal
Create a public documentation page at `/setup` that gives agency owners a complete, account-neutral guide to installing, configuring, and operating SaaSSuite. The page will use SaaSSuite’s existing visual identity, remain easy to scan on phones, and clearly separate Starter, Basic, and Advanced capabilities.

## Page experience
- Add a documentation-style layout with a branded introduction, sticky desktop table of contents, compact mobile navigation, and clear section anchors.
- Add client-side search that filters the guide by feature, task, or keyword and links directly to matching sections.
- Use the existing purple brand treatment with secondary success, warning, and support accents rather than a one-color page.
- Add restrained entrance and section-highlight motion, with reduced-motion support.
- Include “Open SaaSSuite” and contextual in-app links where a signed-in customer can complete each task.

## Documentation sections
1. **Start here**
   - What SaaSSuite does and how the owner dashboard differs from the client-facing Client Hub.
   - Where to find the walkthrough video and interactive walkthrough.
   - A recommended setup order and short launch checklist.
2. **Install SaaSSuite in HighLevel**
   - Create the Client Hub custom menu link using the account’s generated Hub URL.
   - Find and save the menu-link ID.
   - Paste the dynamic JavaScript and CSS lines in Agency View → Settings → Company → White Label.
   - Explain what each code line controls, automatic syncing, hard refreshes, install verification, LaunchPad replacement, auto-navigation, and optional additional plan links.
   - Use safe placeholders instead of exposing any account or agency identifiers.
3. **How the platform works**
   - Explain Dashboard, Client Hub, Education, Home, Support, Knowledge Base, Community, Settings, and the interactive walkthrough.
   - Cover client identification, plan-specific Hub URLs, and the owner/admin distinction without exposing implementation details.
4. **Customize onboarding and education**
   - Standard training library, video toggles, custom uploads/embeds, custom categories, ordering, welcome video, thumbnails, onboarding and daily checklists, announcements, helpful links, “What to do next,” login screen, popup, themes, and simplified onboarding.
5. **Customize support**
   - AI chat, human chat, support heading and buttons, prompts/training document, branded help experience, knowledge-base branding and article visibility, handling modes, assignments, notifications, Slack, and CRM update webhooks.
6. **How support ticketing works**
   - Customer submission, categories and attachments, routing and assignment, ticket statuses, replies and email delivery, conversation history, reopening, alerts, and owner/team permissions.
7. **Automation and growth tools**
   - Workflows and supported triggers, menu-link removal presets, branding, analytics, health and activity reporting, Community and Academy resources, affiliate area, onboarding calls, and available add-ons.
8. **Plans and features**
   - A complete, readable Starter / Basic / Advanced comparison based on the live access rules and pricing definitions.
   - Mark inherited features clearly and call out optional or separately purchased services rather than presenting them as plan inclusions.
9. **Troubleshooting and launch checklist**
   - Missing menu link, stale styling, code placement, client login, video display, support visibility, and escalation steps.

## Technical details
- Add a dedicated public React page and route for `/setup`; it will not require sign-in or query private data.
- Keep the documentation content in structured local data so sections, search, navigation, and plan labels stay consistent and are straightforward to update.
- Use semantic design tokens and existing button/layout primitives; do not expose internal URLs, webhooks, emails, account IDs, or customer records.
- Add route-specific title, description, canonical URL, Open Graph metadata, and documentation-oriented structured data.
- Add `/setup` to the public route source so prerendering and the sitemap include it.
- Record the public documentation architecture in the project decisions file and close the roadmap items after validation.

## Validation
- Confirm `/setup` loads publicly, every navigation item reaches the correct section, search returns relevant sections, code examples remain placeholders, and calls to action point to valid public or sign-in destinations.
- Check the page visually at desktop and phone widths for readable text, non-overlapping navigation, and complete content.
- Review the final page for user-specific information and compare its plan table against the current plan access and pricing sources.
- Confirm the preview build is clean without sending test webhooks, notifications, or support requests.