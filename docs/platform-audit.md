# Platform audit

Logged-in app only. Captured with a dev-only mock session (`VITE_PLATFORM_MOCK=1` and `import.meta.env.DEV`). Production builds cannot turn the mock on. Nothing here was written to the live Supabase project.

Before screenshots: `/opt/cursor/artifacts/platform-before/`. After screenshots: `/opt/cursor/artifacts/platform-after/`.

## Navigation

| Issue | Decision |
| --- | --- |
| Sidebar mixed Start Here, Ideas, Settings, Walkthrough, Affiliate, and support into one list. | Desktop sidebar and the mobile drawer use the same groups: Dashboard and Challenge, then Client Hub (Design, Edit Pages, Workflows, Menu link removal, Client Support with an open-ticket badge), then Resources (Learning Hub, Community, Help). |
| Start Here was a nav item and a long checklist users ticked by hand. | It is the top of Learning Hub. Three steps only: connect HighLevel, install the menu link, configure Client Hub. The system marks them done from existing data. New signups who skip onboarding land on `/app/learning`. |
| Mobile had a bottom bar (Dashboard, Support, Workflows, Community, Affiliate) plus the drawer. Image 12 suggested a different bar. | The bottom bar is removed. The drawer is the only mobile navigation, so the two do not duplicate each other. Main content no longer reserves space for that bar. |
| Profile control only logged out. | The profile card (name and email) opens the account panel. Logout is inside that panel, with the settings destinations. |
| Ideas nav button only redirected to Community. | Removed. Community keeps the ideas board. |
| Help differed by page. | Help in the nav opens one owner assistant with Request a human. |

## Learning Hub

| Issue | Decision |
| --- | --- |
| Education tabs labeled Coming Soon for Installation, Client Hub, and Branding even though those tools exist. | Those labels are gone with the old Start Here page. Community lessons that have no video still say coming soon, because that content is actually missing. |
| Walkthroughs were a separate nav item. | They sit under Learning Hub, with the interactive walkthrough and the video library. |

## Design and branding

| Issue | Decision |
| --- | --- |
| Themes, colors, fonts, logo, and agency name were edited in several places under different names. | Layouts (not Themes) live on Design, including Simplified Onboarding as a route to the existing manager. It does not write a new hub version. Fonts, icon style, and motion are under Advanced. Popup settings are on Design. |
| The Design wireframe also showed agency name and logo. | Andrew's call wins. Name and logo are only edited in Settings. Design, Knowledge Base, and Edit Pages link there. Brand colors are only edited on Design. |
| Install step 2 asked for brand colors. | That step is removed. Install is menu link, then code, then install URLs. Completing install no longer writes colors. |
| Knowledge Base had Company Name, logo, and color fields, plus a Refresh control on articles. | Those fields are links. Headline and the on/off switch stay. Articles load on open; the manual refresh button is gone. |

## Dashboard, workflows, support

| Issue | Decision |
| --- | --- |
| Open Support Tickets and AI support chats were not clickable. | Both open Client Support. |
| Affiliate lived in the left nav for about 1% of users. | It is a tab on Dashboard. `/app/affiliate-dashboard` still opens that tab. |
| Workflows hid the trigger list behind Add your first trigger. | The available triggers are shown before any are added. |
| Client Support was named Support and sat with owner help. | Renamed Client Support and kept in Client Hub. Onboarding calls and agency support are quiet links on that page, not nav items. |
| Request a human sent a chat sentence and hoped the model called the handover tool. | The button calls the handover directly. |
| Assign to sub-account sent a partial menu update, and "add" did nothing when the link was already shown everywhere. Removing a location from that state could hide the link from every sub-account. | The update sends a full menu body. Add on an everywhere link explains that and offers Limit to this sub-account. Remove refuses when there is no location list to edit. |

## Community and settings

| Issue | Decision |
| --- | --- |
| Community opened on Academy and used icon-only tooltips. | Labeled tabs: Group Chat, Ideas, Resources, Snapshots. Group Chat is the default. Resources and snapshots stay. |
| Settings was a vertical form with an info-icon tooltip. | Grey page, white cards, plan and language shown on the right, support kept as its own group. Opens from the profile card. |
| Page titles used different info-icon tooltips. | Shared title and subheadline, without that tooltip, on the pages that were part of this pass. |

## Routes kept working

`/app/start-here` and `/app/resources` open Learning Hub. `/app/design`, `/app/layouts`, and `/app/themes` open Design. `/app/client-support` opens Client Support. `/app/affiliate-dashboard` opens the Affiliate tab.

No database migration was written. The assign-to-sub-account fix and the setup checks use columns that already exist.

## Finish pass

Checked every logged-in route at 390, 768, and 1440 with the dev-only mock. Page-level horizontal scroll, info-icon title tooltips, and console errors were clear after the fixes below.

| What changed | Why |
| --- | --- |
| Page title and subheadline on Agency Support, Onboarding Calls, Simplified Onboarding, Snapshots, Clients, Challenge, Menu link removal, Walkthrough, Email warmup, Free leads, and Community. | Those screens still used an info icon, a card title, or no title. |
| Edit Pages header and Client Hub URL wrap on a narrow screen. The URL field takes its own row. | At 390 the title, Sync Plans, and the URL buttons sat on one line and pushed the page sideways. |
| Simplified Onboarding fields use `min-w-0` so a long public URL stays inside the card. | The URL input's minimum width was wider than the phone. |
| Settings section tabs are a vertical list at every width. The form stays under that list until the wide layout. | At 768 a horizontal strip pushed HighLevel to the edge and Connect external platform off-screen. Putting the list beside the form at that width had collapsed the form. |
| Client Support and Affiliate stat cards stay at two columns until the extra-wide layout. Brand color choices do the same. | Four cards in the width left beside the sidebar clipped labels such as Responded and Total Earned. |
| Knowledge Base and other hub links stack the URL above Copy and Open until extra-wide. | The URL field was squeezed to a few pixels beside the buttons. |
| Walkthrough, buy-a-call, and add-client actions wrap onto another line. | Those buttons were one line wider than the card. |
| An old agency id is written under the client name. Plan choices on Onboarding Calls explain themselves under the buttons. | Those notes only appeared on hover, which a phone cannot show. |

## QA follow-up

Checked against the notes on the earlier commit.

| Item | Change |
| --- | --- |
| Edit Pages header at 390 and 768 | The title stays full width. Sync Plans, Learn more, and Installation Guide wrap underneath it until the layout is wide. The Client Hub URL and Brand colors do the same. |
| Community | Group Chat, Ideas, Resources, and Snapshots share one title and subheadline. The loading, join, and photo steps use that same title. |
| Menu link removal | Title and subheadline stay on the page while rules load and in both editors. |
| Navigation tour | The first step points at the Client Hub group. Edit Pages is named Edit Pages. Later steps point at Client Support, Resources, Learning Hub, and the profile card. Billing and team admins still open Settings. |
| Setup dialog | The first-visit text dialog uses a dialog title and description, so the console warning about a missing title is gone. |
| Mobile wordmark | The top bar says SaaSSuite as ordinary text. The page title is the only heading. |
| Settings tabs at 768 | Profile, Admins, Billing, Custom Domain, Slack, HighLevel, and Connect external platform stack in a vertical list, so each one stays on screen beside the sidebar. |
| Academy skill pack | The dev mock storage client implements `list()`. A missing or failed lookup clears the skill pack instead of throwing. |

A browser check in `tests/platformOverflow.test.ts` measures sideways scroll at 390 on the logged-in routes when the dev server is already running. Unit tests skip it when that server is down.

Left as they are:

| Item | Why it stays |
| --- | --- |
| Dashboard chart hover details. | They explain a point on the chart. They are not a page-title tooltip. |
| Community lessons with no video still say coming soon. | That lesson content is missing. Removing the label would point at an empty video. |
| One Feature Kit funnel and its edge functions. | Lovable is changing that checkout on main. This pass rebased onto those commits and left that folder alone. |
| Live database, sign-in, email, and Slack. | This pass only uses the dev mock. Nothing was written to the production project. |
