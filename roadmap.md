# Roadmap

## LSPXL cookie confirmation (Nov 12)
- [x] Block LSPXL worldwide until explicit advertising acceptance; legacy notice acknowledgment grants nothing
- [x] Extend the existing banner with separate choices, equal accept/reject controls and permanent settings; preserve existing trackers' opt-out model
- [x] Regression test and desktop/mobile real-banner checks: initial/rejected/analytics-only blocked, advertising loads once, withdrawal and later reload blocked; no page errors, preview build OK
- [ ] Publish updated banner and consent gate — publishing authorization required; provider receipt not tested (browser requests intercepted)

## Favicon and Switchyard branding (Nov 12)
- [x] Add independent favicon upload/removal and JavaScript installation using existing logo storage
- [x] Add Switchyard colors, optional customizer, preview and preset persistence without changing legacy styling; strip supplied client name
- [x] 53 branding regressions pass; desktop/mobile fixture verifies color edits, save, customizer toggle, upload/remove, favicon installation and runtime hover/selected ink; preview build OK
- [ ] Verify actual signed-in HighLevel/account save — external session unavailable; storage/account tests used isolated responses, no customer data changed
- [ ] Publish hosted customizer and paired dynamic-styles revision — requires publishing authorization; do not deploy the paired endpoint ahead of the hosted script

## Rob Upland menu ordering (Nov 12)
- [x] Reproduce live installation moving Education & Support but not EMR after HighLevel connection
- [x] Preserve configured links across owner plan settings for ordering, independently of assignment-safe Hub redirects
- [x] 22 regressions pass; desktop/mobile fixture with Rob's live CSS/JS moves EMR and Education & Support above native links; deployed dynamic-styles and verified connected-plans-2 with both ordering IDs and only the Hub redirect candidate
- [ ] Verify Rob's actual signed-in HighLevel sidebar — external HighLevel session unavailable

## Theme navigation and sidebar height (Nov 12)
- [x] Remove the sidebar's 20px height deduction in generated CSS and runtime; no margin-top:auto patch remains, footer inset unchanged
- [x] Apply the existing top-navigation gradient through Theme Customizer on every page, including heavy routes; preserve manual highlight/text colors and independent on/off setting
- [x] 31 theme/sidebar regressions pass; actual customizer fixture verifies agency/sub-account route changes, browser-local save, white active/hover text, off restores native colors, 1800px/812px sidebar heights and phone controls without page errors; preview build OK
- [ ] Release hosted theme-builder.js and paired dynamic-styles revisions — site publishing requires explicit authorization; no endpoint deployed ahead of the paired hosted runtime
- [ ] Verify actual signed-in HighLevel pages and shared cross-device save — external HighLevel session unavailable, existing held theme writer/grant rollout unchanged

## Copilot hanging controls and sidebar (Nov 6)
- [x] Reproduced done-event hang with open HTTP body before fix; new regression failed before correction and same browser reproduction now completes/cancels
- [x] Release completed replies at done; detach bounded save reporting without blind insert retries, safeguard scripted typing/intro cleanup and contain sidebar rows/composer
- [x] 62 checks pass; actual styled Copilot screen with mocked account, open completed stream and stalled persistence enables next send, contains sidebar and has no mobile overflow or runtime errors; preview build OK
- [ ] Real signed-in SaaSSuite/Grok verification — external Supabase session unavailable; live-preview inspection bridge returned 404, no customer data changed
- [ ] Publish frontend corrections — explicit publishing authorization still required

## Copilot verification and requested platform MCP (Nov 6)
- [x] Document SaaSSuite live acceptance checks in docs/copilot-live-acceptance.md — Andrew chose Copilot testing; also passed 34 checks across billing/activity/public/failure suites (4 failure-reporting tests overlap the 111-test run)
- [x] 111 regressions pass across 14 suites (486 assertions); fixed a flaky reply test caused by microsecond timestamps decoded as millisecond Dates, confirmed 3 repeated passes; no production logic changed
- [x] Real /app/copilot redirects to login without runtime errors; account inspection confirms saassuite/saassuite-2 and one stored team reply in the last seven days, but does not prove Grok authored/delivered it or the customer saw it
- [ ] Verify SaaSSuite signed-in conversation → real Grok handover → reply in customer UI — external unmanaged Supabase has no restorable testing session; Cursor/Grok reply integration also needs live confirmation
- [ ] Build and test account-scoped platform MCP for portal, design, onboarding pages, connected HighLevel installation and integration status — Lovable-hosted app MCP is unsupported on this external Supabase project; hosting approach requires a user decision, no MCP server files will be created here
- [ ] Switch Copilot to the proven MCP tools only after the MCP is available and the SaaSSuite account flow has passed
- [ ] Add platform MCP management to account Settings, expose it in AI Copilot, and announce availability — Andrew requested Nov 9; blocked on a working supported hosted MCP and SaaSSuite verification, do not announce it as available before then

## Admin Support message loading (Nov 5)
- [x] Correct confirmed ai_chat_messages statement timeout with one-time platform exclusion lookup and agency/time index; live migration applied, no messages changed
- [x] Five message-access regressions plus six existing support tests pass; live policy verified and privileged Deborah query returns 10 messages in 5.3ms (not an authenticated timing check); preview build OK
- [ ] Signed-in Admin Support check — external unmanaged session unavailable

## Keystone Launchpad icon size (Nov 4)
- [x] Reproduced native Launchpad size inheritance (16px zap beside 24px peers); match Keystone zap to neighboring visible menu glyphs
- [x] Actual theme runtime matches 24px peer icons in expanded/collapsed desktop and mobile fixtures; 24 theme regressions pass and preview build OK
- [ ] Release hosted script — requires explicit publishing authorization; real signed-in HighLevel check unavailable

## Keystone theme color controls (Nov 4)
- [x] Preserve all six manually selected colors and handle live input and committed change events; automatic contrast only supplies defaults
- [x] 36 regressions pass; actual runtime fixture with Keystone colors confirms hex/swatch edits, white hover/selected text and icons, discard, local save/reopen, and phone layout; preview build OK; no customer data changed
- [ ] Verify Keystone signed-in HighLevel screen — external unmanaged HighLevel session unavailable
- [ ] Release hosted customizer and paired dynamic-styles cache revision — hosted script requires explicit site publishing authorization; runtime revision prepared, neither released before the hosted script is available

## Client Hub section visibility (Nov 4)
- [x] Add per-plan Home/Education/Support visibility and visible default selection with safe atomic settings saves; retain last visible section
- [x] Set all three Rob Upland plan IDs to Home/Education hidden, Support visible and default; verified stored values and public get_v2_home_settings result; Plan 1 retains Help Desk label
- [x] 14 section/default regressions pass; isolated real controls verified desktop/mobile; preview build OK
- [ ] Real signed-in agency save/reload and customer navigation — external unmanaged sessions unavailable; Rob's live V4 hub displays its login gate, no customer login fabricated
- [ ] Publish section controls — requires explicit publishing request

## Settings languages (Nov 4)
- [x] Add personal language and optional customer default controls; personal targets actual signed-in identity, row-less admins use Auth metadata; customer setting uses guarded owner save and language-only public reader
- [x] Danish already available in owner dictionary; 11 scope/identity regressions pass, personal-only and both-scope component fixture passes on desktop/mobile; preview build OK
- [ ] Activate customer defaults and Danish in software-onboarding (aa7c60b1-7e21-4a10-87b6-7f7460031e7a) — cross-project checkout is read-only; its LanguageContext only reads onboarding-language localStorage and marks da unavailable. It must load get_customer_language(p_agency_id), use agency-scoped personal override with explicit choice precedence, add Danish UI/lesson translations and enable da. Settings currently marks customer activation pending.
- [ ] Real signed-in save/reload — external unmanaged Supabase sessions unavailable; browser check used isolated real component with mocked saves, no customer data changed
- [ ] Publish Settings controls — requires explicit publishing request

## Live Settings sidebar correction (Nov 4)
- [x] Clarify the prior deployment hold; Andrew authorized a reviewed shared styling rollout
- [x] Distinguish Settings/App Marketplace/agency-hub footers from full Settings menus and prevent footer rows shrinking into each other
- [x] Review runtime dependencies; 31 regressions pass; deploy dynamic-styles only, leaving theme writers, secret and migration held
- [x] Both agencies' existing public installation URLs return fresh corrected CSS/JS; live-served CSS passes nonoverlap footer checks without local overrides
- [ ] Verify actual signed-in HighLevel screens — external unmanaged HighLevel sessions unavailable; browser checks used reconstructed markup with each agency's actual served CSS

## Connected multi-plan setup (Nov 3)
- [x] Lock Plans 2/3 and Sync Plans until connected (preserving Advanced gates), with Settings link; connected setup discovers unique exact plan Hub URLs and saves one config per plan
- [x] Generate shared all-plan CSS/JS ordering and location-assignment/visible-link redirect checks; ambiguity, no link and hidden links do not redirect
- [x] Deploy ghl-connection setup/audit actions; owner login audit is non-blocking, excludes impersonation/team views, and distinguishes served code, installed snippets and unknown browser state
- [x] 20 regressions pass, preview build OK; generated runtime fixture with Vanessa's actual plan/menu/location IDs redirects correctly for all three assignments, leaves unassigned/hidden locations alone and orders all three links above Contacts; Settings notice verified
- [x] Release reviewed dynamic-styles runtime after Andrew lifted that endpoint's hold Nov 4; live assets return new connected-plan and Settings revision markers
- [ ] Verify Vanessa's signed-in setup, stored config correction, HighLevel installed-code audit and actual browser — external unmanaged sessions unavailable; live audit returns 401; no customer settings changed during verification
- [ ] Publish frontend plan gates/discovery/login audit — requires explicit publishing request

## Copilot reliability and human support (Nov 3)
- [x] Correct menu diagnostic agency_id URLs and check location-scoped JS/global CSS separately; failed reads never imply missing saved rules
- [x] Validate every reply path before display; replace unsupported fixes/tickets/endpoints with confirmed tool summaries instead of appending warnings
- [x] Explicit human requests bypass AI in all signed-in surfaces; checked delivery/pause status, preserved manual pauses, narrow explicit resume, reload status restore, direct SMS help rather than public AI redirect
- [x] 96 focused regressions pass, preview build OK, chat-copilot deployed; live invalid identity remains 401; actual human-help button fixture opens SMS dialog without navigation or page errors
- [ ] Signed-in real conversation, notification receipt and HighLevel browser verification — external unmanaged sessions unavailable; no customer conversation or ticket modified during testing
- [ ] Publish frontend human-help button/status corrections — requires explicit publishing request

## Project monitoring review (Nov 3)
- [x] Reproduced React-owned title unmount crash; cleanup now removes only static fallbacks and same reproduction unmounts cleanly
- [x] Standalone branding gates already honor purchase flag; finding resolved stale and existing regressions pass
- [x] Copilot already sends session JWT and refreshes/retries; finding resolved stale and auth regressions pass
- [x] Email-only replies accept all five supported statuses; deployed inbound-ticket-reply and live invalid-key check remains 401
- [x] Empty connected lists restore manual ID entry and refresh; browser fixture confirms typed ID
- [x] 45 targeted tests pass, preview build OK, public Login/back navigation has no page errors; all five findings resolved
- [ ] Publish frontend fixes — requires explicit publishing request
- [ ] Real account branding/chat and authenticated webhook/picker end-to-end checks — external unmanaged Supabase sessions unavailable; no customer ticket altered

## Build Your SaaS (Nov 3)
- [x] Create /buildyoursaas offer and live $2,500/$5,000 Stripe products
- [x] Reuse SLO sales/checkout structure and four /book testimonials; green Text us button prefills requested message
- [x] Isolated embedded one-time checkout → browser-bound verified thank-you, no upsells; checkout function deployed
- [x] Five pricing/verification tests pass; both real Stripe checkouts render exact amounts; desktop/mobile no horizontal overflow; testimonial controls set correct video source; build OK
- [ ] Completed live paid transaction — Andrew must perform a real purchase; no card charged during verification
- [ ] Publish page — requires explicit publish request

## Account deletion (Nov 3)
- [x] Existing shared Settings → Profile deletion available in both settings views; mobile button/confirmation wrapping improved and logout/home completion hardened
- [x] Extended service-only transactional cleanup for newer account-linked tables, learner history, claimed public chats, and saved themes; migration applied
- [x] Eleven deletion safety/cleanup regressions pass; preview build OK
- [ ] Real signed-in desktop/mobile destructive verification — external unmanaged Supabase sessions unavailable; no customer account deleted

## Challenge suspicious-point review (Oct 25)
- [x] Correct disputed Munya deductions: restored 996 older points; retained only 81 flagged video points from the last 24 hours per Andrew. Other accounts unchanged.
- [x] Audited all 31 entrants over the last 30 days plus previously flagged older bursts; no additional unmatched bursts at verification
- [x] After Munya correction, excluded 359 video points across 17 bursts in five accounts; education progress remains intact
- [x] Added owner-only removal totals, reasons, Central-time timestamps and completion IDs on the in-app challenge page; no public evidence
- [x] Eight scoring/privacy/finale tests pass; public live leaderboard has no review section or page errors; preview build OK
- [ ] Publish private evidence notice and verify affected owner screen — publishing requires user's request; external unmanaged sign-in prevents actual affected-account browser verification

## Challenge finale (Oct 25)
- [x] Add shared 11 p.m. Central → midnight countdown and top-three celebration on challenge pages
- [x] Show personal Stripe-facilitated payout notice with 5–10 business-day processing; no transfers initiated
- [x] 16 tests pass; real public leaderboard and countdown → three-winner celebration verified with accelerated browser clock, no page errors
- [ ] Publish finale before 11 p.m. — requires user's publish request

## Paul’s installation menu refresh (Oct 23)
- [x] Installation menus sync on open, discard superseded loads, match exact agency URLs, and refresh checklist status on open
- [ ] Verify and select Paul’s live new link — external authenticated HighLevel sync rejected with Missing auth; cache contains only paul-4 URLs. Updated guide selects a unique current-agency link after authenticated sync.
- [x] Eight refresh/current-agency selection regressions pass

## One Feature Kit payments (Oct 20)
- [x] Create six live one-time prices and wire isolated checkout, verified return, and saved-card upsells
- [x] Add kit-only signed webhook and server-verified, durable Slack notification deduplication; signing secret saved
- [x] 23 regressions pass and real browser review checkout/both No paths verified; payments disabled and Slack agency empty
- [ ] Andrew supplies Slack agency and performs live test charges before enabling payments; paid-card flow and Slack delivery unverified

## Minimalist saving (Oct 19)
- [x] Replace comment-only Minimalist stylesheet with actual CSS, verify CSS/preset readback, and default new Minimalist sidebars to white
- [x] 17 regressions pass; actual controls with sample account pass apply/preset/reload with no runtime errors; build OK
- [ ] Ed's real account save and HighLevel execution — external authenticated session unavailable; original failed click not captured
- [ ] Publish updated branding controls — requires user's publish request

## Public focused menu-removal onboarding (Oct 19)
- [x] Start with explicit naming and topic confirmation; replayable public training and guided installation order
- [x] Login/signup popup retains topic/UTMs and pending chat; locked access asks about existing signup/payment email without public lookup; booking/text controls available
- [x] Real public conversation verified: name → confirmation → auth popup, video source, history reload, snapshot gate, tracked signup return and visible text number; 56 regressions pass; preview build OK; public-copilot/chat-copilot deployed
- [ ] Signed-in signup/claim and actual HighLevel installation — externally managed authenticated sessions unavailable
- [ ] Publish updated public page to saassuite.ai — requires user's publish request

## Copilot free-user QA (Oct 18)
- [x] Enforce HighLevel → menu link → CSS/JS → personalization in workspace policy; list steps and add gated Snapshot/Book a call shortcuts
- [x] Close help before SMS and show copyable phone number; browser confirms phone and dismissed dialog
- [x] Eager/visible signup, non-blocking attribution and deferrable questions; context reads run concurrently and ordinary replies no longer force HighLevel sync; model unchanged
- [x] Inspect /book: hosted calendar works; Stripe iframe reports the current page origin, not a checkout setting; no 127.0.0.1:8000 value found in source or calendar
- [x] 48 focused checks and 46 follow-up checks pass, build OK, chat-copilot deployed; browser signup/help/booking checks show no runtime errors
- [ ] Verify signed-in AI order/response speed and question-deferral completion — external unmanaged account sessions unavailable; no gateway/edge logs retained for reported turns
- [ ] Reproduce unsolicited xdg-open and claimed booking Stripe setting — neither occurred in browser checks; need the exact triggering steps or screenshot if it persists
- [ ] Publish updated signup and Copilot controls to saassuite.ai — publishing requires user's request

## Signup failures and temporary Copilot limit (Oct 18)
- [x] Signup timeout traced to synchronous vector training inserts; private bounded background queue and final-ID notification fix deployed
- [x] Both reported test addresses registered through the real signup UI and reached initial questions; auth/profile readback and 114 training chunks each verified
- [x] Raise public daily messages to 100 until Oct 20 05:36 UTC, then automatically return to 10; seven policy tests pass and public-copilot deployed
- [x] Signup errors distinguish timeout/duplicate failures; eight focused tests pass and preview build OK

## Branding cleanup and review (Oct 18)
- [x] Rename Classic/Simple/Minimalist and remove Theme Builder installation/code panels
- [x] Unify apply/remove/save; fix preset hydration/backups, unmanaged CSS preservation, loader retry/reconfiguration, browser preset continuity, reset labels and motion removal
- [x] 14 regression tests pass; sample-account apply/remove/save/restore and all three runtime checks pass; desktop/phone layout checked; dynamic-styles deployed
- [ ] Real signed-in account persistence and HighLevel installation/redirect execution — external authenticated sessions unavailable
- [ ] Publish owner controls and hosted theme runtime so customers receive these changes

## Snapshot import controls (Oct 18)
- [x] Share Copy link and new-tab snapshot imports between Copilot chat and Menu Link Removal
- [x] Shared controls verified on desktop/phone: exact URL copied, new tab opens, current page stays; 15 regressions pass and preview build OK
- [ ] Actual signed-in chat/setup and HighLevel snapshot acceptance remain unverified — external account sessions unavailable

## Menu-removal Copilot video (Oct 18)
- [x] Offer training in initial focused greeting and on later requests, with replayable Watch now cards
- [x] 43 tests pass; Watch now opens/reopens the correct video player; chat-copilot deployed; preview build OK
- [ ] Actual signed-in focused conversation and external video playback remain unverified — external account session unavailable and media did not load in sandbox

## Admin support chat visibility (Oct 17)
- [x] Bound chat scrolling, wrap long messages and headers, and keep the reply composer visible in main chat and Support Mode
- [x] Desktop/mobile sample inbox checks pass: long messages wrap, latest and earlier messages scroll, reply box is accessible; support inbox regression passes
- [ ] Verify Mark's actual customer conversation — external authenticated sessions are unavailable

## Shared Theme Builder (Oct 16)
- [x] Add V1/V2/V3 with shared Theme Builder, icons/motion controls and account-saved non-live sidebar presets; customer HighLevel presets are explicitly browser-local
- [x] Replace prior sidebar automatically and archive its full setup; keep independent parts and existing menu/redirect code
- [x] Eight tests and three-version browser fixture pass; hidden menu retained, icons render, motion toggles and local presets save; dynamic styles deployed and preview build OK
- [ ] Real signed-in SaaSSuite preset readback and HighLevel redirect execution — external account sessions unavailable
- [ ] Hosted theme-builder.js changes require publishing; cross-device customer theme saving requires an authenticated HighLevel-to-SaaSSuite identity flow, not relaxed public write permissions

## HighLevel sub-account refresh (Oct 15)
- [x] Fix refresh so server sync completes before lists are fetched, regardless of menu options; add refresh controls to removal and assignment pickers
- [x] 16 tests pass; build OK; browser fixture confirms a newly loaded account is selectable; customer's cache contains one account from 16:08 UTC
- [ ] Confirm the new account in his live picker — external Supabase session unavailable; direct sync request rejected with Missing auth

## START HERE videos and contextual Copilot (Oct 14)
- [x] Replace welcome/walkthrough players with Watch now controls; add supplied Menu Link Removal training
- [x] Make bottom-right chat icon open new saved Copilot chats with source page and server-scoped recent activity; restrict automatic greetings to read-only tools; deploy chat-copilot
- [x] 34 tests pass, preview build OK; isolated desktop/phone checks confirm dialogs, supplied video source, launcher destination and hidden workspace icon
- [ ] Signed-in account/activity greeting readback — external Supabase sessions unavailable

## Copilot menu-link selection and pacing (Oct 14)
- [x] Automatically resolve installed links from saved plan assignments and trusted Hub URLs; show only one workflow step/screenshot at a time
- [x] 27 tests pass; sample-account card verifies auto-filled ID, Back/Next and one-step screenshots; preview build OK; Copilot guidance deployed
- [ ] Signed-in account verification — external sessions unavailable

## Copilot in-chat menu removal setup (Oct 14)
- [x] Audit every workflow step and remove directions to fetch setup resources elsewhere in SaaSSuite; retain setup context across follow-up messages
- [x] Provide snapshot, IDs, secure secret controls, code/payloads, presets, AI features and test/help controls in chat; saved connection tokens remain encrypted
- [x] 53 regression tests pass; actual chat card checked with simulated account data on desktop/phone; no overflow/errors; Copilot deployed and preview build OK
- [ ] Signed-in HighLevel workflow execution — external Supabase/HighLevel sessions unavailable

## Self-service account deletion (Oct 14)
- [x] Add shared Delete Account confirmation to current and legacy profile settings on web and Capacitor, with separate subscription cancellation disclosure
- [x] Deploy authenticated self-only deletion with explicit confirmation, transactional public-data cleanup and explicit cleanup/auth failure responses
- [x] Five safety tests pass; isolated phone confirmation requires both DELETE and acknowledgment, cancel closes safely; deployed service rejects invalid identity with 401; build OK
- [ ] Signed-in destructive end-to-end verification — external Supabase sessions unavailable; no real customer was deleted

## Subscription purchase price clarity (Oct 14)
- [x] Make full billed amounts primary across shared SaaS cards, trial upgrade offers, support pricing and store subscription cards; native shared cards use live localized store totals
- [x] Browser confirms annual totals at 36px versus equivalents at 12px, correct monthly totals and no phone overflow; 11 existing billing tests pass; build OK; checkout selections unchanged
- [ ] Verify packaged iOS purchase sheet — requires a device/store sandbox; no subscription purchased

## Ed trial notice placement (Oct 14)
- [x] Make the Basic trial countdown a compact bottom-left notice outside the page layout
- [x] Suppress the incorrect cancellation notice for staff-granted Basic trials
- [x] Two regression tests pass; actual notice with sample trial data is 260×146 at bottom-left, checked at desktop and phone widths; build OK
- [ ] Ed's signed-in screen readback — external Supabase session unavailable

## Copilot feature links (Oct 14)
- [x] Preserve eight feature destinations and UTMs across login/signup and initial questions; keep ordinary signup questions
- [x] Confirm linked interest after completed or skipped setup; guide with existing account and plan; deployed Copilot policy
- [x] 40 tests pass; all eight real routes retain feature/campaign through login → signup; build OK
- [ ] Authenticated onboarding and saved chat readback — external Supabase sessions unavailable

## Kerry support ticket visibility (Oct 14)
- [x] Locate personal-coaching/niche question: new open ticket #215, not a chat message; review existing ticket visibility permissions
- [x] Refresh ticket rows alongside counts on realtime events and the inbox Refresh button
- [x] Ticket-refresh regression passes; preview builds cleanly; confirmed live ticket #215 is saved and open
- [ ] Signed-in support-panel readback — external Supabase authentication unavailable

## Copilot logo and replay (Oct 14)
- [x] Use supplied HighLevel logo in the connection card
- [x] First-time setup opens a menu with Re-Onboard; replay all slides and start a fresh setup chat without deleting settings
- [x] 27 tests pass; hosted logo and menu verified, all five slides replay and repeat from slide one; build OK
- [ ] Signed-in fresh setup chat readback — external Supabase authentication unavailable

## Copilot activation, billing and help (Oct 14)
- [x] Correct outdated Premium Support pricing; add $27 / $97 / $297 buttons with authenticated Stripe confirmation and server feature gates
- [x] Show a copy/open Client Hub link when HighLevel setup is skipped, using its saved hub version
- [x] Reuse the app's Text us popup throughout chat, on AI failures and human handover
- [x] 26 tests pass; real widget controls and Text us popup verified; build OK; deployed function rejects invalid sessions
- [ ] Signed-in checkout, paid entitlement readback and full skipped-install flow — external Supabase session unavailable; no payment taken during testing

## Copilot onboarding improvements (Oct 14)
- [x] Polish five slides, compact messages, progressive replies and custom-answer fields
- [x] Focus chat on user priorities and impactful features
- [x] Transcribe three supplied videos with ElevenLabs and add topic-specific training; installation reference defers to current chat widgets
- [x] Send completed initial questions directly to Copilot first-time setup (without an intervening offer), including provision failure and wizard completion paths
- [x] 21 regression checks pass; build OK; actual slide/custom-answer components verified in browser fixture; live model streams its first text in 4.7 seconds and asks the four priorities; chat-copilot deployed
- [ ] Full signed-in first-time setup and saved chat readback — external Supabase authentication unavailable

## Craig mobile sidebar isolation (Oct 13)
- [x] Remove mobile-only forced sidebar colors without changing Craig's blue widget, zoom setting, or other saved CSS
- [x] Eight regression checks pass; deployed and regenerated Craig's live CSS/JS; browser fixture using live CSS confirms native surface, separate V2 color and unchanged desktop; actual HighLevel session unavailable

## START HERE (Oct 13)
- [x] Enlarge tabs, reuse the popup Copilot with voice/sounds/attachments/suggestions, and add checklist/support call booking; five tests pass, preview builds, sample-data browser check confirms controls and navigation
- [x] Add sidebar entry and onboarding/education/support tabs with existing setup destinations
- [x] Reuse walkthrough, AI Copilot and human handover; track identified visits and actions with tracking opt-out
- [x] Onboarding plays the 4:37 "What is SaaSSuite and How it Works" video first, then the 20-minute "How to Setup, Understand, and Utilize SaaSSuite"; six tests pass, builds clean, media and thumbnails reachable
- [x] Five setup/Starter-lock tests pass; isolated browser fixture confirms tabs, checklist, locks, and usable full-size chat without overflow; new screen lint passes, global lint has pre-existing errors
- [ ] Real signed-in Copilot/human-notification and analytics delivery check — external Supabase authentication unavailable

## Menu removal expanded setup (Oct 13)
- [x] Move automation out of the bottom panel and show all steps and details
- [x] Extend interactive walkthrough from manual removal through automation setup
- [x] Sample-data browser check: all steps visible, 13 tour steps reached, second menu-link payload correct, no errors; existing tests pass
- [ ] Signed-in real-account walkthrough check — external Supabase authentication unavailable

## GHL DFY sales page (Oct 10)
- [x] Add homepage learn-more button below pricing
- [x] Build matching `/ghldfy` sales page with illustrated stages, scope, payment options, and consultation links
- [x] Verify pricing rules, navigation, and desktop/mobile presentation — three tests pass; browser confirms loaded graphics, no overflow/errors, consultation destination, and preserved attribution; live publishing unverified

## One-feature training pages 3 and 4 (Oct 9)
- [x] Add under-video free implementation offer with webinar-style arrow and SaaSSuite $599 signup bonus graphic
- [x] Match home branding with centered logo, purple headline, video, and compact mobile layout
- [x] Page 3 opens quiz directly; page 4 collects bonus opt-in and saves with actual account answer
- [x] Route each HighLevel plan to the next affiliate plan or Advanced trial checkout; reuse existing 14-day trial duration
- [x] Eight rule tests and mobile/desktop browser checks pass; simulated bonus save and checkout payload verified, no real purchase made

## Mobile zoom controls
- [x] Add saved mobile zoom toggle; preserve menu and swipe behavior; seven tests pass
- [x] Disable Craig's zoom controls; deployed and verified live Craig/xxidesigns scripts and toolbar browser fixture; real HighLevel view unverified

## Chat to ticket (Oct 8)
- [x] Add ticket creation to admin support conversations with editable customer details
- [x] Create tickets securely and email confirmation with stored chat history
- [x] Permission/transcript tests and simulated browser email-retry checks pass; deployed; unsigned-in calls rejected
- [ ] Confirm actual inbox delivery from a signed-in account — external Supabase session unavailable

## Independent branding and final mobile patch (Oct 8)
- [x] Append supplied sub-account touch-scroll CSS after the animation patch; preserve JavaScript
- [x] Separate sidebar, top buttons, login, and mobile customization with independent application
- [x] Mobile customization changes only menu widget color and improves layout without rebranding
- [x] Deployed; live xxidesigns CSS/JS match, six rule tests passed and browser fixture confirms scroll/color preservation; signed-in real-account checks unavailable on external Supabase

## xxidesigns unified mobile replacement (Oct 8)
- [x] Replace all older mobile CSS/JS additions with the owner-supplied unified versions while preserving original branding
- [x] Deployed and verified exact unified CSS/JS in refreshed live responses, old additions absent, original branding preserved

## Guided menu automation setup (Oct 8)
- [x] Add supplied snapshot link, sequential confirmations, collapsed technical details, and text support at each step
- [x] Verify progression, assignment controls, and text support in a browser with simulated connection data; build OK

## Guided HighLevel connection (Oct 7)
- [x] Move webhook, preset automation, and activity into Menu Link Removal
- [x] Add three-card introduction and guided token/location dialog with loading and success
- [x] Show masked token and company ID safely; browser-verified with simulated responses at 375/768/1440; deployed status update

## Regression-test fixes (Oct 6 QA round)
- [x] Agency rename carries settings/hub version/videos again (carry-over triggers now fire on every account save, not just direct ID updates)
- [x] Dashboard activity pop-up counts completed/responded tickets as done, not open
- [x] Dashboard activity pop-up no longer shows the same ticket reply twice under two sender labels
- [x] Video history shows "Custom video" instead of raw IDs when a title can't be resolved
- [x] Dashboard user list can't show more checklist progress than items (deleted items no longer counted)
- [x] Community idea detail view updates its upvote count immediately
- [x] Page Analytics loads via database-side aggregation (was pulling 60k+ rows and stalling)

## Onboarding first-step navigation
- [x] Restore a clear Next button beneath the opening video on desktop and mobile
- [x] Confirm the app builds cleanly; authenticated live transition is unavailable on this external Supabase project

## Dashboard user activity pop-up
- [x] Make dashboard user names open a dashboard-styled activity dialog
- [x] Show login, support history, video records, and checklist progress with animated charts
- [x] Verify dialog behavior, empty/error states, and layout using sample data; real-account sign-in testing unavailable on external Supabase

## SaaSSuite Slack help access
- [x] Add a “Join OUR Slack” 1:1 help action in Settings
- [x] Show the same Slack action immediately after the agency name in onboarding

## Public setup knowledge base
- [x] Add a public, mobile-friendly `/setup` documentation page
- [x] Document onboarding, installation, menu links, dynamic code, Client Hub, support, and ticketing
- [x] Add a complete Starter / Basic / Advanced feature guide without account-specific information
- [x] Add `/setup` to public discovery and verify navigation, search, links, and page presentation

## Public support and marketplace return pages
- [x] Add a public `/support` page with a support-question form and durable submission delivery
- [x] Add `/marketplace?confirmed=true` with a three-second success animation and return-to-HighLevel action
- [x] Verify both public pages without triggering existing customer notifications

## Client Hub theme and owner widget
- [x] Allow agency owners and account admins to save themes for their own onboarding links
- [x] Make the top-nav help widget available to all accounts and hide it when an embed replaces the HighLevel header
- [x] Keep Client Hub page navigation visible while editing Theme
- [x] Roll the tested sidebar sizing fix and compact branded scrollbar into every V2 branding stylesheet

## Education videos
- [x] Rename the final category to AI & Automation Tools and register both new lesson tags for all accounts
- [ ] Add playable video links for both lessons when provided

## Brand kit refresh
- [x] Replace the logo library with four supplied full-resolution light/dark square and banner logos
- [x] Move the hero background directly below the logos and add the marketing URL
- [x] Add a downloadable founder portrait and consolidate purple guidance around the homepage purple and webinar gradient

## Proactive AI CoPilot outreach (Slack / SMS / email)
- [x] Settings, snapshots, generation, topic memory, Slack delivery, inbound replies
- [x] Schedule check hourly, send time keyed off each owner's last login hour (no extra job)
- [x] Human, positive-first, short (<70 word) messages
- [x] Follow up on unanswered check-ins instead of sending a fresh suggestion
- [x] Challenge awareness: dates, rules, standing, next-point ideas (Slack + SMS/text)
- [ ] Live re-test on andrew@dna-media.net and review sample messages

## Pricing
- [x] Add annual-first pricing across homepage, pricing page, account billing, and upgrade dialog
- [x] Create and wire yearly Stripe prices: Basic $240, Advanced $870, Premium Support $2,670
- [x] Add Premium Support $297/month to account billing and synchronize plan features
- [x] Add annual-first pricing to the dedicated support sales page
- [x] Restore purple pricing controls, animated Premium dark mode, add-on separation, and two-way pricing transitions
- [x] Highlight no contracts and no hidden fees
- [x] Premium Support checkout updated to $297/month with the current Stripe price and lookup key
- [x] Premium Support remains Advanced access plus the separate premium_support entitlement
- [x] `/special` compares Basic $27, Advanced $97, Premium Support $297, and the $2,470 webinar special with current features and checkout
- [x] `/special` shows the former $3,580 annual price and Stripe grants Advanced access for the $2,470 purchase
- [x] `/special` annual offer uses an inline desktop/mobile checkout section instead of a popup
- [x] Expand `/pricing` with current SaaS/full-build pricing, testimonials, cost comparison, and Text Us flow

## Landing-page performance
- [x] Diagnose and fix the current slow loading across public landing pages

## Installation status consistency
- [x] Make the dashboard hub card use the account-wide installation status check
- [x] Make dynamic menu reorder, redirect, and LaunchPad removal resilient to current HighLevel markup and stale redirect locks

## Public support case studies
- [x] Curate the five requested real conversations with multi-question narratives
- [x] Remove identifying names, agency names, emails, and source URLs
- [x] Add privacy-blurred screenshots to the DNS case study

## Support representative hiring + training
- [x] Password-protected /support-rep application (5 standards, phone, email, Slack opt-in, working hours, weekends)
- [x] Signup fires the LeadConnector webhook and starts the two-week trial
- [x] Practice queue from real tickets/AI questions: 3-5/day, 90% between 8am-9pm Central
- [x] /support-rep/portal login by email code, queue, AI grading, AI customer roleplay, final score

## Agency support assignment
- [x] Organize owner seat purchasing, client assignment, and projects into separate mobile-friendly tabs
- [x] 30-day lock on assignment with a confirmation prompt before assigning
- [x] Required client details: name, email, phone, company, location ID
- [x] Agency owner white-label domain field
- [x] /admin/agency page plus an agency support accounts section on /admin/support, with /v2/location/<id> deep links
- [x] Make admin support replies abortable, retry-safe, and resilient to slow notification delivery

## Webinar 2
- [x] Add focused `/webinar-2` registration page with portrait hero and existing embed
- [x] Restore branded arrows, HighLevel callout, purple styling, mystery bonus, trust badge, and immediate testimonials
- [x] Restore WebinarKit's visible confirmation widget so each registrant sees their actual session countdown and personal join link

## Mobile apps (Capacitor) + in-app subscriptions
- [x] Capacitor installed and configured (appId app.lovable.p5d824616a50a49a49b578fb62de744ee)
- [x] RevenueCat store billing for Basic, Advanced, Advanced yearly, Premium Support
- [x] store_subscriptions table + apply_store_subscription grant/revoke routine
- [x] revenuecat-webhook (source of truth) and sync-store-subscription (verified client sync)
- [x] App shows store plans instead of card checkout; web-paying customers see no upsell
- [ ] Waiting on RevenueCat keys (public SDK keys, secret key, webhook secret) and store products created

## Payment links swept to in-app checkout (Sep 29)
- Replaced all link.saassuite.ai plan payment links with StripeEmbeddedCheckout: UpgradeDialog, LoginTrackingSalesPage, BrandingToolSalesPage, PromoPage, WebinarConfirmation, Gift, BrandingTool upgrade prompts, OnboardingTool upgrade prompt.
- Still on old links (need their own Stripe products + access fulfillment first): branded AI support $99 (AIChatSupport, ClientHub, SupportFeatures, V3SupportView), email warmup (EmailWarmupSalesPage), custom domain (SettingsPanel, CustomDomainPanel).

## Special page rework (HighLevel free offer)
- [x] Refocus /special on the free-with-HighLevel offer: bonuses up top, New vs Upgrade links (upgrade is desktop-gated with copy-link dialog), Can't-upgrade fallback to direct pricing
- [x] Remove the free/Basic $27 and $2,470 annual offers from the page; direct pricing shows Advanced and Premium only
- [ ] Publish so the reworked page goes live
- [x] /webinar-confirmation rebuilt (show-up + registrant-only 14-day Advanced trial)

## Special page $997 offer
- [x] Make the $997 annual offer the primary focus with checkout open inline
- [x] Keep only the $97 Advanced and $297 Premium Support alternatives below
- [x] Preserve testimonials, purchase tracking, fulfillment, and mobile usability

## Platform polish pass (Oct 1)
- [x] P1 webhooks checked (placeholder URL cleared); redirects use one confirmation route
- [ ] P1 live click-through of checkout + walkthrough (blocked: no test login available for this backend)
- [x] P2 InfoTip tooltips on every section; 3-step install explainer card
- [x] P3 Copilot: clarify + confirm before writes, read-back verification
- [x] P4 bulk user select/remove, workflows cleanup
- [ ] P4 support list filters, Client Hub editor + dashboard mobile pass (next round)
- [ ] P5 test script + status report
- [x] Webinar stats: record manual sales (2x $27, 1 affiliate $198.8, 2 Advanced trials) with emails

## Team admins: no separate Starter accounts
- [x] Sign-in no longer creates a Starter account for invited admins
- [x] Removed 37 empty admin Starter accounts (Buzz Bull, Launch360, etc.)

## HighLevel connection + purchase-driven presets (brief Oct 6)
- [x] Settings > HighLevel connection, encrypted token, sync, custom-link list
- [x] Secured webhook (secret, product map, replay/conflict checks, email lookup, retries, review queue)
- [x] Sub-account picker in Menu Link Removal; location-scoped live styles
- [x] Company ID auto-discovered from a sub-account ID
- [ ] Live HighLevel test (blocked: needs a real sub-account ID + private integration token)

## HighLevel-connected extras (Oct 6)
- [x] Menu Link Removal: pick from all sub-accounts (no manual ID when connected)
- [x] Dashboard users: logged-in vs total accounts + "Invite to X Portal" email
- [x] Install guide: "I've installed it" → pick menu link from HighLevel
- [x] Onboarding Calls + Agency Support: pick sub-account
- [ ] Signed-in click-through on andrew@dna-media.net (blocked: no sign-in available to me for this backend)

## Oct 7 onboarding & walkthrough round
- [x] Remove empty Starter account whenever someone becomes a team admin (Dom case)
- [x] Show/hide on the create-password field
- [x] New accounts land on Walkthrough page with the portal-live popup; "Re-Onboard" renamed "Onboarding"
- [x] Navigation walkthrough auto-starts (resume, 3 dismissals/week, stops when finished); Client Hub walkthrough fires on the Client Hub
- [x] Purchases without intro questions go through questions → popup → walkthrough
- [x] "Help & Support" text-us button replaces the email button

- [x] Full-screen /copilot workspace + /copilot/first-time chat onboarding
