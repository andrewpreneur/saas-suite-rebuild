import { visibleTicketCategories, type StoredTicketCategory } from "@/lib/ticketCategories";
import { KIT_CUSTOMER_FIXTURES } from "@/lib/kitCustomerFixtures";
import { mockSaasPartnerInvoke } from "@/lib/saasPartnerMock";

/**
 * Dev-only stand-in for the Supabase client.
 *
 * VITE_PLATFORM_MOCK is read only when Vite is in development. Production
 * builds replace `import.meta.env.DEV` with false, so this path cannot turn on
 * in a production bundle. It never talks to the live project.
 */
// Rebuild copy: always on, in dev and in builds. This app has no live backend.
export const platformMockEnabled = true;

export const MOCK_EMAIL = "agency@example.com";
export const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";

const USER_ROW: Record<string, unknown> = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  approval: "YES",
  plan: "ADVANCED",
  email_warmup_access: true,
  free_leads_access: true,
  hide_bonuses: false,
  branding_tool_access: true,
  is_affiliate: true,
  snapshot_access: true,
  full_name: "Avery Quinn",
  v2_navigation_enabled: true,
  dynamic_installation: true,
  onboarding_call_access: true,
  agency_id: "demo-agency",
  agency_id_basic: "demo-agency",
  agency_id_advanced: "demo-agency-2",
  agency_id_elite: "demo-agency-3",
  agency_name: "Northstar Agency",
  login_with: "EMAIL",
  onboarding_completed: true,
  onboarding_skipped: false,
  onboarding_reminder_dismissed: true,
  initial_questions_completed: true,
  premium_support: false,
  kb_logo_url: "",
  kb_headline: "Welcome to the Northstar Agency help center",
  primary_color: "#4F39F6",
  secondary_color: "#111827",
  tertiary_color: "#F59E0B",
  knowledge_base_enabled: true,
  popup_enabled: true,
  install_confirmed_at: "2026-01-15T00:00:00.000Z",
  generated_css:
    '/* SS-THEME:{"version":"v2","motion":true,"iconPack":"lucide","font":"Inter","sidebarBg":"#ffffff","accent":"#16a34a"} */\n/* Branding V2 Stylesheet */\n',
  branding_presets: [
    {
      id: "preset-agency-default",
      name: "Agency default",
      css: '/* SS-THEME:{"version":"v2","motion":true,"iconPack":"lucide","font":"Inter","sidebarBg":"#111827","accent":"#16a34a"} */\n/* Branding V2 Stylesheet */\n',
    },
  ],
  mobile_branding_enabled: false,
  mobile_menu_color: "#3b82f6",
  mobile_zoom_enabled: true,
  top_nav_widget_color_mode: "primary",
  top_nav_widget_custom_color: null,
  top_nav_widget_icon_color_mode: "primary",
  top_nav_widget_icon_custom_color: null,
  top_nav_widget_tile_color_mode: "primary",
  top_nav_widget_tile_custom_color: null,
  use_agency_name_url: true,
  custom_ai_general_help_enabled: true,
  show_chat_widget: true,
  support_ticketing_enabled: true,
  human_chat_enabled: true,
  branded_ai_support: true,
  login_enabled: true,
  show_v2_ui: true,
  top_nav_widget_enabled: true,
  top_nav_widget_label: "Help & Support",
  top_nav_widget_options: {
    title: "How can we help?",
    subtitle: "We're here to help",
    showOn: "both",
    options: [
      {
        id: "live-support",
        label: "Chat with us",
        description: "Opens the chat popup",
        icon: "chat",
        visible: true,
        openMode: "embed",
        target: "/support-chat",
      },
      {
        id: "help-library",
        label: "Guides",
        description: "How-to videos and articles",
        icon: "book",
        visible: true,
        openMode: "tab",
        target: "/education",
      },
      {
        id: "open-ticket",
        label: "Request help",
        description: "We'll follow up by email",
        icon: "ticket",
        visible: false,
        openMode: "embed",
        target: "/support-ticket",
      },
    ],
  },
};

/** Support redesign fixtures use times relative to now so the inbox reads as live. */
function supportMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

type SupportChatSeed = [role: "user" | "assistant" | "agency_owner", minutesAgo: number, content: string];

function supportChatRows(agencyId: string, who: string, seeds: SupportChatSeed[]) {
  return seeds.map(([role, minutesAgo, content], i) => ({
    id: `chat-${agencyId}-${who}-${i}`,
    agency_id: agencyId,
    user_identifier: who,
    role,
    sender_type: role,
    content,
    created_at: supportMinutesAgo(minutesAgo),
  }));
}

const SUPPORT_CHAT_ROWS: Record<string, unknown>[] = [
  ...supportChatRows("demo-agency", "priya@brightsmiledental.example", [
    ["user", 31, "Hi, our reminder texts stopped sending on Monday. Is something wrong with the automation?"],
    ["assistant", 30, "Sorry about that, Priya. I can see the Appointment Reminder workflow is still published. Did anything change on the calendar it is linked to?"],
    ["user", 27, "We added a second hygienist calendar last week."],
    ["assistant", 26, "That is likely it. The workflow only listens to the original calendar. I can walk you through adding the new one, or pass this to the team."],
    ["user", 24, "Please get a person to look at it. Three patients missed their slot this week."],
    ["assistant", 24, "Understood. I have asked the team to step in and they will reply here."],
  ]),
  ...supportChatRows("demo-agency-2", "marcus@bellroofing.example", [
    ["user", 190, "Can I change the phone number that shows on my Google listing from inside the app?"],
    ["assistant", 189, "Yes. Open Reputation, choose Listings, then Edit business info. Changes usually show on Google within a day."],
    ["user", 185, "Found it. Does it update Facebook too?"],
    ["assistant", 184, "It does if Facebook is connected under Integrations. Yours is, so both will update."],
    ["user", 12, "It says the listing is pending review and I can't edit. Can someone help?"],
    ["assistant", 12, "A pending review locks edits for a short while. I have flagged this for the team so they can check it for you."],
  ]),
  ...supportChatRows("demo-agency", "elena@costayoga.example", [
    ["user", 60 * 20, "I think I was charged twice this month."],
    ["assistant", 60 * 20 - 1, "I can see two payments on October 3. I have asked the team to confirm and refund the duplicate."],
    ["agency_owner", 60 * 18, "Hi Elena, Avery here. The second charge was a duplicate and it is refunded. Expect it back in 3 to 5 business days."],
    ["user", 60 * 17, "Thank you, that was fast."],
  ]),
  ...supportChatRows("demo-agency", "tom@okaforlaw.example", [
    ["user", 60 * 30, "How do I add my office manager as a user?"],
    ["assistant", 60 * 30 - 1, "Go to Settings, then My Staff, then Add employee. Enter her name and email and choose the User role."],
    ["user", 60 * 29, "Perfect, done."],
  ]),
  ...supportChatRows("demo-agency-3", "sofia@lumenmedspa.example", [
    ["user", 60 * 52, "Where can I see how many leads came from my Facebook ads last month?"],
    ["assistant", 60 * 52 - 1, "Open Reporting, then Attribution, and set the date range to last month. Filter the source to Facebook to see leads and booked appointments."],
    ["user", 60 * 51, "Great, thanks."],
  ]),
  ...supportChatRows("demo-agency-2", "Guest 4821", [
    ["user", 60 * 75, "Do you offer a mobile app?"],
    ["assistant", 60 * 75 - 1, "Yes, there is an iOS and Android app. Search for your agency's app name in the store, or ask your account manager for the link."],
  ]),
];

const SUPPORT_OWNER_ROWS = SUPPORT_CHAT_ROWS.filter((row) => row.role === "agency_owner");
const SUPPORT_AI_ROWS = SUPPORT_CHAT_ROWS.filter((row) => row.role !== "agency_owner");

const SUPPORT_CHAT_THREADS = [
  {
    agency_id: "demo-agency",
    user_identifier: "priya@brightsmiledental.example",
    handover_requested_at: supportMinutesAgo(24),
    handover_resolved_at: null,
  },
  {
    agency_id: "demo-agency-2",
    user_identifier: "marcus@bellroofing.example",
    handover_requested_at: supportMinutesAgo(12),
    handover_resolved_at: null,
  },
  {
    agency_id: "demo-agency",
    user_identifier: "elena@costayoga.example",
    handover_requested_at: supportMinutesAgo(60 * 20),
    handover_resolved_at: supportMinutesAgo(60 * 18),
  },
];

const SUPPORT_CHAT_ASSIGNMENTS = [
  {
    id: "assign-1",
    agency_id: "demo-agency-2",
    user_identifier: "marcus@bellroofing.example",
    assigned_to_email: MOCK_EMAIL,
  },
  {
    id: "assign-2",
    agency_id: "demo-agency",
    user_identifier: "elena@costayoga.example",
    assigned_to_email: MOCK_EMAIL,
  },
];

const TICKETS = [
  {
    id: "t1",
    ticket_number: 1042,
    agency_id: "demo-agency",
    customer_name: "Jordan Lee",
    customer_email: "client@example.com",
    issue_category: "Website Edits",
    request_text: "The homepage hero still shows the old headline.",
    status: "open",
    subject: "Can't see the menu link",
    email: "client@example.com",
    created_at: "2026-10-01T12:00:00.000Z",
    assigned_to: null,
  },
  {
    id: "t2",
    ticket_number: 1043,
    agency_id: "demo-agency",
    customer_name: "Sam Rivera",
    customer_email: "sam@example.com",
    issue_category: "Billing Question",
    request_text: "Where do I update the welcome video?",
    status: "responded",
    subject: "Welcome video",
    email: "sam@example.com",
    created_at: "2026-10-02T12:00:00.000Z",
    assigned_to: MOCK_EMAIL,
  },
  {
    id: "t3",
    ticket_number: 1030,
    agency_id: "demo-agency",
    customer_name: "Pat Nguyen",
    customer_email: "pat@example.com",
    issue_category: "Account Access",
    request_text: "I can't sign in to the client hub.",
    status: "completed",
    subject: "Login help",
    email: "pat@example.com",
    created_at: "2026-09-20T12:00:00.000Z",
    assigned_to: null,
  },
  // Support redesign fixtures: enough tickets to judge every filter.
  {
    id: "t4",
    ticket_number: 1047,
    agency_id: "demo-agency",
    customer_name: "Priya Shah",
    customer_email: "priya@brightsmiledental.example",
    issue_category: "Automations",
    request_text:
      "Our appointment reminder texts stopped going out on Monday. Three patients missed their slot this week. Can you check the workflow?",
    status: "open",
    subject: "Reminder texts stopped",
    email: "priya@brightsmiledental.example",
    created_at: supportMinutesAgo(42),
    assigned_to: null,
  },
  {
    id: "t5",
    ticket_number: 1046,
    agency_id: "demo-agency-2",
    customer_name: "Marcus Bell",
    customer_email: "marcus@bellroofing.example",
    issue_category: "Website Edits",
    request_text: "Please swap the gallery photos on the roofing page for the six new ones I emailed.",
    status: "in_progress",
    subject: "New gallery photos",
    email: "marcus@bellroofing.example",
    created_at: supportMinutesAgo(60 * 5),
    assigned_to: MOCK_EMAIL,
  },
  {
    id: "t6",
    ticket_number: 1045,
    agency_id: "demo-agency",
    customer_name: "Elena Costa",
    customer_email: "elena@costayoga.example",
    issue_category: "Billing Question",
    request_text: "I was charged twice for October. Could you refund the second payment?",
    status: "responded",
    subject: "Charged twice",
    email: "elena@costayoga.example",
    created_at: supportMinutesAgo(60 * 26),
    assigned_to: MOCK_EMAIL,
    admin_response:
      "Hi Elena, you're right, the second charge was a duplicate. We've refunded it and it should reach your card in 3 to 5 business days.",
    responded_at: supportMinutesAgo(60 * 22),
  },
  {
    id: "t7",
    ticket_number: 1039,
    agency_id: "demo-agency",
    customer_name: "Tom Okafor",
    customer_email: "tom@okaforlaw.example",
    issue_category: "Account Access",
    request_text: "Can you add my office manager as a user? Her email is dana@okaforlaw.example.",
    status: "completed",
    subject: "Add a user",
    email: "tom@okaforlaw.example",
    created_at: supportMinutesAgo(60 * 24 * 6),
    assigned_to: MOCK_EMAIL,
    admin_response: "Done. Dana has an invite in her inbox and can sign in right away.",
    responded_at: supportMinutesAgo(60 * 24 * 6 - 90),
  },
];

const createdTickets: Record<string, unknown>[] = [];

const DEMO_CLIENTS = [
  {
    user_id: "c1",
    user_name: "Jordan Lee",
    user_email: "client@example.com",
    last_accessed: null,
    login_count: 3,
  },
  {
    user_id: "c2",
    user_name: "Sam Rivera",
    user_email: "sam@example.com",
    last_accessed: null,
    login_count: 1,
  },
];

const COMMUNITY_PROFILE = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  display_name: "Avery Quinn",
  avatar_url: "/lovable-uploads/bc897420-443a-4f49-aa8d-683ff40b5652.png",
  bio: "Demo agency owner",
  tier: "paid",
  role: "member",
  handle: "avery",
  is_verified: false,
  post_count: 2,
  joined_at: "2026-01-01T00:00:00.000Z",
  active_subaccounts: "12",
  highlevel_experience: "1-3 years",
  show_account_count: true,
};

// Learn area fixtures: a few community members and posts so Group Chat is not empty.
const COMMUNITY_MEMBERS = [
  { id: "community-member-jordan", display_name: "Jordan Keller", avatar_url: null, role: "member", handle: "jordank", is_verified: true },
  { id: "community-member-alicia", display_name: "Alicia Moreno", avatar_url: null, role: "member", handle: "aliciam", is_verified: false },
  { id: "community-member-sam", display_name: "Sam Bennett", avatar_url: null, role: "staff", handle: "samb", is_verified: true },
];
const COMMUNITY_POSTS = [
  {
    id: "community-post-1", space_id: "community-space-general", author_id: "community-member-sam",
    title: "New this week: reorder Client Hub modules",
    body: "You can now drag to reorder and rename every module in the Client Hub. Changes reach your clients right away. Tell us what you want next.",
    category: "SaaSSuite", is_pinned: true, is_answered: false, comment_count: 6, reaction_count: 18,
    created_at: "2026-11-11T15:20:00.000Z", edited_at: null,
  },
  {
    id: "community-post-2", space_id: "community-space-general", author_id: "community-member-jordan",
    title: "How I onboard a new client in under 20 minutes",
    body: "Snapshot first, then the branded hub link in the welcome email. Clients watch the first three videos before our kickoff call, so the call is about strategy instead of setup.",
    category: "Growth", is_pinned: false, is_answered: false, comment_count: 9, reaction_count: 24,
    created_at: "2026-11-10T18:05:00.000Z", edited_at: null,
  },
  {
    id: "community-post-3", space_id: "community-space-general", author_id: "community-member-alicia",
    title: "What do you charge for the Starter tier?",
    body: "I am at $97 a month with the hub and support included. Curious where everyone else landed and whether you bundle onboarding calls.",
    category: "Sales", is_pinned: false, is_answered: true, comment_count: 14, reaction_count: 11,
    created_at: "2026-11-09T09:40:00.000Z", edited_at: null,
  },
  {
    id: "community-post-4", space_id: "community-space-general", author_id: MOCK_USER_ID,
    title: null,
    body: "Just connected HighLevel and installed the menu link. The installation checklist made it painless.",
    category: "Beginner", is_pinned: false, is_answered: false, comment_count: 2, reaction_count: 7,
    created_at: "2026-11-07T13:15:00.000Z", edited_at: null,
  },
];

export type MockShape = "demo" | "empty";

/** Real-data stand-ins: a filled agency, or an account with no agency, tickets, or HighLevel. */
export function mockAccountShape(shape: MockShape) {
  if (shape === "empty") {
    return {
      user: {
        ...USER_ROW,
        agency_id: null,
        agency_id_basic: null,
        agency_id_advanced: null,
        agency_id_elite: null,
        agency_name: null,
      },
      tickets: [] as typeof TICKETS,
      connected: false,
    };
  }
  return { user: USER_ROW, tickets: TICKETS, connected: true };
}

function currentMockShape(): MockShape {
  try {
    return sessionStorage.getItem("ss_mock_shape") === "empty" ? "empty" : "demo";
  } catch {
    return "demo";
  }
}

const copilotThreads: Record<string, unknown>[] = [
  {
    id: "thread-recent",
    owner_email: MOCK_EMAIL,
    title: "Hide the Funnels link",
    kind: "chat",
    updated_at: "2026-10-21T18:04:00.000Z",
  },
  {
    id: "thread-older",
    owner_email: MOCK_EMAIL,
    title: "Learn the branding tool",
    kind: "chat",
    updated_at: "2026-10-18T15:00:00.000Z",
  },
];

const copilotMessages: Record<string, unknown>[] = [
  {
    id: "msg-recent-user",
    thread_id: "thread-recent",
    role: "user",
    content: "How do I hide the Funnels menu link for new clients?",
    created_at: "2026-10-21T18:00:00.000Z",
  },
  {
    id: "msg-recent-assistant",
    thread_id: "thread-recent",
    role: "assistant",
    content:
      "Open Menu link removal, select Funnels under Main Navigation, and save that preset. Install your Custom CSS in HighLevel, then refresh a test sub-account to confirm the link is gone.",
    created_at: "2026-10-21T18:01:00.000Z",
  },
  // Demo follow-up so the chat shows a longer reply, a list and a choice widget.
  {
    id: "msg-recent-user-2",
    thread_id: "thread-recent",
    role: "user",
    content: "Can I do that for every new client automatically?",
    created_at: "2026-10-21T18:02:00.000Z",
  },
  {
    id: "msg-recent-assistant-2",
    thread_id: "thread-recent",
    role: "assistant",
    content:
      "Yes. A **preset** applies the same hidden links to every new sub-account:\n\n1. Create a preset, for example *Standard*, that hides Funnels.\n2. Add the Remove Menu Links workflow from the snapshot.\n3. Publish it. New buyers get the preset as soon as their account exists.\n\nWant me to walk you through it?\n[[choices: Yes, set it up with me | Show me my Client Hub first | Not now]]",
    created_at: "2026-10-21T18:03:00.000Z",
  },
  {
    id: "msg-older-user",
    thread_id: "thread-older",
    role: "user",
    content: "Where do I change the login page colors?",
    created_at: "2026-10-18T15:00:00.000Z",
  },
  {
    id: "msg-older-assistant",
    thread_id: "thread-older",
    role: "assistant",
    content:
      "Open the branding tool and set the primary color. That color is what clients see on the login page.",
    created_at: "2026-10-18T15:01:00.000Z",
  },
  // Demo cards so the widgets Copilot renders can be judged: Client Hub link and the menu removal setup.
  {
    id: "msg-older-user-2",
    thread_id: "thread-older",
    role: "user",
    content: "Show me my Client Hub, then help me remove menu links.",
    created_at: "2026-10-18T15:02:00.000Z",
  },
  {
    id: "msg-older-assistant-2",
    thread_id: "thread-older",
    role: "assistant",
    content: "Here is your Client Hub. Open it to see what your clients see.\n[[widget:hub_link]]",
    created_at: "2026-10-18T15:03:00.000Z",
  },
  {
    id: "msg-older-assistant-3",
    thread_id: "thread-older",
    role: "assistant",
    content: "And here is the menu removal setup. We will go one step at a time.\n[[widget:menu_removal_setup]]",
    created_at: "2026-10-18T15:04:00.000Z",
  },
];
const ticketCategoryRows: StoredTicketCategory[] = [];
const userPatch: Record<string, unknown> = {};
let uiVersion = 2;

function readMockSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * UI QA only: shows the banners and overlays around the app. Set `sessionStorage.ss_mock_chrome`
 * (or open any page once with `?ss_mock_chrome=...`, `off` clears it) to a comma or dot separated list of:
 * past_due, grace, cancel, trial, suspended, limit, offer, team,
 * and for the Settings pages: domain (Custom Domain bought, one request pending), slack (workspace connected),
 * external (an external platform connection exists), hl_off (HighLevel not connected).
 */
function mockChromeFlags(): Set<string> {
  try {
    // Also accepts `?ss_mock_chrome%3Dtrial.offer` so screenshot scripts that split on "=" and "," can use it.
    const params = new URLSearchParams(window.location.search);
    const encodedKey = [...params.keys()].find((key) => key.startsWith("ss_mock_chrome="));
    const fromUrl = params.get("ss_mock_chrome") || encodedKey?.slice("ss_mock_chrome=".length);
    if (fromUrl === "off") sessionStorage.removeItem("ss_mock_chrome");
    else if (fromUrl) sessionStorage.setItem("ss_mock_chrome", fromUrl);
    return new Set((sessionStorage.getItem("ss_mock_chrome") || "").split(/[,.\s]+/).map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function mockChromePatch(): Record<string, unknown> {
  const flags = mockChromeFlags();
  const patch: Record<string, unknown> = {};
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  if (flags.has("past_due")) patch.billing_state = "PAST_DUE";
  if (flags.has("grace")) patch.payment_grace_until = inDays(5);
  if (flags.has("cancel")) patch.cancel_access_until = inDays(12);
  if (flags.has("trial")) {
    patch.trial_source = "manual_basic_30day";
    patch.cancel_access_until = inDays(12.2);
  }
  if (flags.has("suspended")) patch.approval = "NO";
  if (flags.has("limit")) patch.plan = "BASIC";
  if (flags.has("domain")) {
    patch.custom_domain_access = true;
    patch.custom_domain = "app.northstar.example";
    patch.custom_domain_live = false;
    patch.custom_domain_submitted_at = inDays(-1);
  }
  return patch;
}

/** Dev QA only. `ss_mock_plan` / `ss_mock_premium` / `ss_mock_branding` switch the fixture account. */
function mockAccountOverrides(): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const plan = readMockSession("ss_mock_plan");
  const premium = readMockSession("ss_mock_premium");
  const branding = readMockSession("ss_mock_branding");
  if (plan) patch.plan = plan;
  if (premium === "1" || premium === "true") patch.premium_support = true;
  if (premium === "0" || premium === "false") patch.premium_support = false;
  if (branding === "1" || branding === "true") patch.branding_tool_access = true;
  if (branding === "0" || branding === "false") patch.branding_tool_access = false;
  Object.assign(patch, mockChromePatch());
  return patch;
}

function mockSignedOut(): boolean {
  return readMockSession("ss_mock_signed_out") === "1";
}

function mockInstallMissing(): boolean {
  try {
    return sessionStorage.getItem("ss_mock_install") === "missing";
  } catch {
    return false;
  }
}

function injectedSetupTrackerRows(): Record<string, unknown>[] | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { __SETUP_TRACKER_SEED__?: unknown };
  const injected = host.__SETUP_TRACKER_SEED__;
  if (!Array.isArray(injected) || injected.length === 0) return null;
  return injected.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const id = typeof row.id === "string" && row.id ? row.id : `st-seed-${index}`;
    return {
      created_at: "2026-10-22T00:00:00.000Z",
      updated_at: "2026-10-22T00:00:00.000Z",
      agency_name: null,
      contact_name: null,
      contact_email: null,
      source: "other",
      ghl_agency_id: null,
      ghl_location_id: null,
      setup_status: "not_started",
      status_detail: null,
      last_contact_at: null,
      last_contact_note: null,
      evidence: null,
      ...row,
      id,
      saas_suite_user_id: null,
    };
  });
}

// Demo rows only. The real 115-account seed stays in the SQL migration.
// A local screenshot script can set window.__SETUP_TRACKER_SEED__ before load
// so the page renders that export without shipping those emails in the bundle.
const setupTrackerRows: Record<string, unknown>[] = injectedSetupTrackerRows() ?? [
  {
    id: "st-better-method",
    account_name: "Better Method",
    agency_name: "Better Method",
    contact_name: null,
    contact_email: null,
    source: "existing_customer",
    ghl_agency_id: "UJY4NKVUHjfpTeNssrHF",
    ghl_location_id: "BmNZpo8NArOEGZryb4X9",
    setup_status: "done",
    status_detail: "Published reference workflow on sub-account BetterMethod.",
    last_contact_at: "2026-10-19T21:17:00.000Z",
    last_contact_note: "Reference workflow confirmed published.",
    evidence: "Order submitted for AI Studio. apply-menu-preset and assign-menu-link.",
    saas_suite_user_id: null,
    created_at: "2026-10-22T00:00:00.000Z",
    updated_at: "2026-10-22T00:00:00.000Z",
  },
  {
    id: "st-lynkific",
    account_name: "Lynkific",
    agency_name: "Lynkific",
    contact_name: "Lynky Test account",
    contact_email: "lynkific@gmail.com",
    source: "other",
    ghl_agency_id: "Xj6iq6sqQwXzUGhVA6HM",
    ghl_location_id: "OE1sYR1a8htFn9xA3l81",
    setup_status: "in_progress",
    status_detail: "Draft template. Trigger is Contact Tag, webhook secret is still a placeholder.",
    last_contact_at: "2026-10-07T15:00:00.000Z",
    last_contact_note: "Template copied, not configured.",
    evidence: "Sub-account Onboarding & Support.",
    saas_suite_user_id: 42,
    created_at: "2026-10-22T00:00:00.000Z",
    updated_at: "2026-10-22T00:00:00.000Z",
  },
  {
    id: "st-gti",
    account_name: "GTI Agents",
    agency_name: "GTI Studio",
    contact_name: null,
    contact_email: "boybuystech@gmail.com",
    source: "ghl_affiliate",
    ghl_agency_id: "aO9zitWjtEAtf9ygFdYO",
    ghl_location_id: "o4eAm9YWElzB0M4ad4l6",
    setup_status: "in_progress",
    status_detail: "Draft workflow on sub-account no compan. Not published.",
    last_contact_at: null,
    last_contact_note: null,
    evidence: "AI Studio preset applied by hand. No webhook test yet.",
    saas_suite_user_id: 18,
    created_at: "2026-10-22T00:00:00.000Z",
    updated_at: "2026-10-22T00:00:00.000Z",
  },
  {
    id: "st-buzz",
    account_name: "Buzz Bull Marketing Systems",
    agency_name: "Growth Chain System",
    contact_name: "Curtis Valdez",
    contact_email: "curtisv@buzzbullmarketing.com",
    source: "existing_customer",
    ghl_agency_id: "jyuGrjbh5LBf4fiTNwds",
    ghl_location_id: "rUwVGLBbWRfDAa03HfFu",
    setup_status: "not_started",
    status_detail:
      "Audit: no menu-link workflow in the Buzz Bull sub-account. Mind Above was not found.",
    last_contact_at: null,
    last_contact_note: null,
    evidence: "Roster shows webhook tests on a test sub-account. Workflow still missing in GHL.",
    saas_suite_user_id: 7,
    created_at: "2026-10-22T00:00:00.000Z",
    updated_at: "2026-10-22T00:00:00.000Z",
  },
];

function applySetupTracker(
  op: string,
  payload: Record<string, unknown> | null,
  idEq: string | null,
) {
  if (op === "insert" && payload) {
    const row = {
      id: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: "other",
      setup_status: "not_started",
      account_name: "Untitled",
      agency_name: null,
      contact_name: null,
      contact_email: null,
      ghl_agency_id: null,
      ghl_location_id: null,
      status_detail: null,
      last_contact_at: null,
      last_contact_note: null,
      evidence: null,
      saas_suite_user_id: null,
      ...payload,
    };
    setupTrackerRows.unshift(row);
    return row;
  }
  if (op === "update" && payload && idEq) {
    const row = setupTrackerRows.find((item) => item.id === idEq);
    if (row) Object.assign(row, payload, { updated_at: new Date().toISOString() });
    return row ?? null;
  }
  return null;
}

const DASHBOARD_DEMO_PEOPLE: Array<[name: string, joinedDaysAgo: number, lastSeenDaysAgo: number | null, lessons: number]> = [
  ["Jordan Lee", 58, 0, 14],
  ["Sam Rivera", 51, 0, 12],
  ["Pat Nguyen", 44, 1, 11],
  ["Morgan Diaz", 39, 1, 9],
  ["Riley Chen", 33, 2, 10],
  ["Casey Brooks", 28, 2, 8],
  ["Devon Clarke", 26, 3, 7],
  ["Harper Singh", 23, 4, 9],
  ["Quinn Alvarez", 21, 5, 6],
  ["Rowan Patel", 18, 6, 5],
  ["Emery Stone", 16, 8, 6],
  ["Skyler Moore", 13, 9, 4],
  ["Tatum Reyes", 11, 11, 3],
  ["Jamie Fox", 9, 3, 5],
  ["Avery Blake", 7, 1, 4],
  ["Drew Hart", 5, 0, 3],
  ["Parker Wells", 4, 2, 2],
  ["Reese Morgan", 2, 0, 1],
  ["Kendall Park", 47, 21, 2],
  ["Logan Price", 36, null, 0],
];

function demoDaysAgo(days: number, hour = 14): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 12, 0, 0);
  // "Today" must never land in the future, or the dashboard reads "-1 days ago".
  if (days >= 0 && d.getTime() > Date.now()) return new Date(Date.now() - 5 * 60_000).toISOString();
  return d.toISOString();
}

const demoUserId = (i: number) => `00000000-0000-4000-9000-${String(i + 1).padStart(12, "0")}`;

function dashboardDemoUsers() {
  return DASHBOARD_DEMO_PEOPLE.map(([name, joined, lastSeen], i) => ({
    id: demoUserId(i),
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    name,
    agency_id: "demo-agency",
    created_at: demoDaysAgo(joined, 10),
    last_accessed: lastSeen === null ? null : demoDaysAgo(lastSeen),
  }));
}

function dashboardDemoCompletions() {
  return DASHBOARD_DEMO_PEOPLE.flatMap(([, joined, , lessons], i) =>
    Array.from({ length: lessons * 2 }, (_, n) => ({
      user_id: demoUserId(i),
      completed_at: demoDaysAgo(Math.max(0, joined - 1 - Math.round((n * joined) / (lessons * 2 + 1))), 16),
    })),
  );
}

/** Believable affiliate numbers for the Affiliate page: a daily series plus five referred accounts. */
function mockAffiliateSnapshot(body?: Record<string, unknown>) {
  const until = body?.until ? new Date(String(body.until)) : new Date();
  const since = body?.since ? new Date(String(body.since)) : new Date(until.getTime() - 44 * 86400000);
  const days = Math.max(1, Math.min(120, Math.round((until.getTime() - since.getTime()) / 86400000)));
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000);
    const wave = 0.6 + 0.4 * Math.sin(i / 2.3) + i / days;
    const views = Math.round(14 * wave + (i % 4));
    const clicks = Math.round(views * 0.34);
    const signups = i % 6 === 2 ? 1 : 0;
    const revenue = i % 5 === 1 ? 27 : i % 11 === 6 ? 97 : 0;
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      views,
      clicks,
      signups,
      revenue,
    };
  });
  const sum = (key: "views" | "clicks" | "signups" | "revenue") =>
    series.reduce((total, point) => total + point[key], 0);
  const paid = (daysAgo: number, amount: number) => ({
    paidAt: demoDaysAgo(daysAgo),
    paid: amount,
    refunded: 0,
    net: amount,
    commission: Math.round(amount * 30) / 100,
  });
  const referral = (
    id: string,
    name: string,
    email: string,
    kind: string,
    label: string,
    plan: string,
    signedUpDaysAgo: number,
    payments: ReturnType<typeof paid>[],
    trialEndInDays: number | null = null,
  ) => ({
    id,
    name,
    email,
    signupAt: demoDaysAgo(signedUpDaysAgo),
    kind,
    label,
    plan,
    trialEnd: trialEndInDays === null ? null : demoDaysAgo(-trialEndInDays),
    commissionRate: 30,
    payments,
    lastPaymentAt: payments[0]?.paidAt ?? null,
    totalPaid: payments.reduce((total, p) => total + p.net, 0),
    totalCommission: payments.reduce((total, p) => total + p.commission, 0),
    nextPaymentAt: null,
  });
  const referrals = [
    referral("ref-1", "Brightline Media", "ha***@brightline.example", "active", "Active", "ADVANCED", 71, [paid(11, 297), paid(41, 297)]),
    referral("ref-2", "Cedar & Co", "jo***@cedarco.example", "active", "Active", "BASIC", 38, [paid(8, 97), paid(38, 97)]),
    referral("ref-3", "Peak Funnels", "mi***@peakfunnels.example", "trial", "Trial", "ADVANCED", 6, [], 8),
    referral("ref-4", "Lumen Studio", "sa***@lumen.example", "trial", "Trial", "BASIC", 3, [], 11),
    referral("ref-5", "Harbor Digital", "al***@harbor.example", "past_due", "Past due", "BASIC", 55, [paid(34, 97)]),
  ];
  const revenue = sum("revenue");
  return {
    maskEmails: true,
    commissionRate: 30,
    referrals,
    pages: [],
    series,
    activity: {
      views: sum("views"),
      clicks: sum("clicks"),
      signups: sum("signups"),
      trials: 2,
      active: 2,
      revenue,
      commission: Math.round(revenue * 30) / 100,
      pendingPayout: 147.3,
      expectedTrialCommission: 118.2,
      expectedTrialCount: 2,
    },
    activityNote: null,
    refreshedAt: new Date().toISOString(),
  };
}

function rowsFor(table: string): unknown[] {
  const shape = mockAccountShape(currentMockShape());
  switch (table) {
    case "saas_suite_users": {
      const user = { ...shape.user, ...userPatch, ...mockAccountOverrides() };
      if (mockInstallMissing()) user.install_confirmed_at = null;
      return [user];
    }
    case "slack_channel_agency_map":
      return mockChromeFlags().has("slack")
        ? [{ agency_id: "demo-agency", team_domain: "northstar-team", is_active: true, installed_at: "2026-10-02T15:00:00.000Z", updated_at: "2026-10-02T15:00:00.000Z" }]
        : [];
    case "external_platform_connections":
      return mockChromeFlags().has("external")
        ? [{ id: "ext-1", owner_email: MOCK_EMAIL, agency_id: "demo-agency-2", platform_name: "Northstar Portal", token: "demo0000token0000demo0000token00", enabled: true, slack_notify: false, event_count: 2, last_event_at: "2026-11-11T16:20:00.000Z" }]
        : [];
    case "external_platform_events":
      return mockChromeFlags().has("external")
        ? [
            { id: "ev-1", connection_id: "ext-1", user_email: "jordan@client.example", user_name: "Jordan Lee", event_type: "user_login", created_at: "2026-11-11T16:20:00.000Z" },
            { id: "ev-2", connection_id: "ext-1", user_email: "sam@client.example", user_name: null, event_type: "user_login", created_at: "2026-11-10T09:05:00.000Z" },
          ]
        : [];
    case "bump_offers":
      return mockChromeFlags().has("offer")
        ? [{ plan: "advanced", promo_code: "NORTHSTAR20", percent_off: 20, expires_at: new Date(Date.now() + 5.4 * 3_600_000).toISOString() }]
        : [];
    case "account_admins":
      return mockChromeFlags().has("team")
        ? [{ owner_email: "owner@brightpath.example", admin_email: MOCK_EMAIL, admin_name: "Avery Quinn", status: "accepted" }]
        : [];
    case "copilot_threads":
      return copilotThreads;
    case "copilot_chat_messages": {
      // Dev-only fixture so the Help handover composer can be opened locally.
      // sessionStorage.ss_mock_help_handover = "team", or ?ss_mock_help_handover=team
      let showTeamThread = false;
      try {
        showTeamThread = sessionStorage.getItem("ss_mock_help_handover") === "team";
        if (!showTeamThread && typeof location !== "undefined") {
          showTeamThread =
            new URLSearchParams(location.search).get("ss_mock_help_handover") === "team";
        }
      } catch {
        showTeamThread = false;
      }
      if (!showTeamThread) return [];
      return [
        {
          id: "copilot-user-1",
          owner_email: MOCK_EMAIL,
          role: "user",
          content: "I need to speak with someone. I think I accidentally setup 2 accounts.",
          actions: [],
          created_at: "2026-10-26T12:40:00.000Z",
        },
        {
          id: "copilot-ai-1",
          owner_email: MOCK_EMAIL,
          role: "assistant",
          content:
            "We're getting one of our team members for you, one moment... (I'll stay quiet so they can take over — say \"turn the AI copilot back on\" any time if you want me back.)",
          actions: [{ tool: "human_handover", args: {}, message: "Handover" }],
          created_at: "2026-10-26T12:41:00.000Z",
        },
        {
          id: "copilot-team-1",
          owner_email: MOCK_EMAIL,
          role: "assistant",
          content: "Hi Avery, sure! What's the email on the second account?",
          actions: [{ tool: "admin_reply", args: {}, message: "Reply from admin" }],
          created_at: "2026-10-26T12:46:00.000Z",
        },
      ];
    }
    case "support_tickets":
      return shape.tickets;
    case "ai_chat_messages":
      return currentMockShape() === "empty" ? [] : SUPPORT_AI_ROWS;
    case "agency_owner_messages":
      return currentMockShape() === "empty" ? [] : SUPPORT_OWNER_ROWS;
    case "chat_threads":
      return currentMockShape() === "empty" ? [] : SUPPORT_CHAT_THREADS;
    case "support_chat_assignments":
      return currentMockShape() === "empty" ? [] : SUPPORT_CHAT_ASSIGNMENTS;
    case "community_profiles":
      return [COMMUNITY_PROFILE, ...COMMUNITY_MEMBERS];
    case "community_posts":
      return COMMUNITY_POSTS;
    case "community_spaces":
      return [{ id: "community-space-general", slug: "general", name: "General", description: "Everything agencies are talking about.", sort_order: 0 }];
    case "workflows":
      return [];
    case "ghl_locations_cache":
      return [
        {
          location_id: "loc_north",
          name: "North Clinic",
          email: "north@example.com",
          phone: null,
          company_name: "North Clinic",
        },
        {
          location_id: "loc_south",
          name: "South Studio",
          email: "south@example.com",
          phone: null,
          company_name: "South Studio",
        },
      ];
    case "ghl_custom_menus_cache":
      return [
        {
          menu_id: "menu_demo",
          title: "Client Hub",
          url: "https://example.com/hub",
          location_ids: ["loc_north"],
          all_locations: false,
        },
      ];
    case "menu_link_rules":
      // Demo rules so Menu Link Removal shows its "Active rules" list.
      return [
        {
          id: "mlr_basic_all",
          agency_id: "demo-agency",
          sub_account_id: null,
          hidden_links: ["#sb_memberships", "#sb_reputation", "#sb_app-marketplace"],
          is_active: true,
          created_at: "2026-10-02T15:00:00.000Z",
          preset_name: "Basic Plan",
        },
        {
          id: "mlr_basic_north",
          agency_id: "demo-agency",
          sub_account_id: "loc_north",
          hidden_links: ["#sb_memberships", "#sb_payments"],
          is_active: false,
          created_at: "2026-10-09T15:00:00.000Z",
          preset_name: "Basic Plan",
        },
      ];
    case "agency_menu_config":
      return [{ agency_id: "demo-agency", menu_link_id: "menu_demo", menu_link_id_2: null }];
    case "agency_ui_versions":
      return [{ agency_id: "demo-agency", ui_version: uiVersion }];
    case "kb_hidden_items":
      return [];
    case "affiliates":
      return [
        {
          id: "aff1",
          email: MOCK_EMAIL,
          user_email_linked: MOCK_EMAIL,
          affiliate_slug: "northstar",
          full_name: "Avery Quinn",
          status: "APPROVED",
          payout_method: null,
        },
      ];
    case "kit_purchases":
      try {
        if (sessionStorage.getItem("ss_mock_kit") === "none") return [];
      } catch {
        /* sessionStorage can be unavailable */
      }
      return [
        {
          line_id: "kit",
          email: MOCK_EMAIL,
          comped: false,
          amount_cents: 2700,
          source: "checkout",
        },
        {
          line_id: "bump-replay",
          email: MOCK_EMAIL,
          comped: false,
          amount_cents: 1700,
          source: "checkout",
        },
        {
          line_id: "bump-install",
          email: MOCK_EMAIL,
          comped: false,
          amount_cents: 29900,
          source: "checkout",
        },
      ];
    case "kit_landing_pages":
      return [{ user_id: MOCK_USER_ID, email: MOCK_EMAIL, url: "https://northstar.example/vibe" }];
    case "kit_ad_requests":
      return [{ id: "ad-1", email: MOCK_EMAIL }];
    case "kit_onboarding_progress":
      return [{ user_id: MOCK_USER_ID, email: MOCK_EMAIL, completed: ["customize-video"] }];
    case "setup_tracker_accounts":
      return setupTrackerRows;
    // Dashboard demo data: end users of the agency's Client Hub, their lesson
    // completions and AI support chats, dated relative to today so charts stay full.
    case "user_progress":
      return currentMockShape() === "empty" ? [] : dashboardDemoUsers();
    case "module_completion":
      return currentMockShape() === "empty" ? [] : dashboardDemoCompletions();
    case "chat_threads":
      return currentMockShape() === "empty"
        ? []
        : Array.from({ length: 14 }, (_, i) => ({ id: `chat-${i + 1}`, agency_id: "demo-agency" }));
    default:
      return [];
  }
}

function rowFor(table: string): unknown {
  const rows = rowsFor(table);
  return rows[0] ?? null;
}

const GIVEAWAY_LEADERS = [
  { rank: 1, display_name: "Jordan Lee", points: 240, joined_at: "2026-08-17T12:00:00.000Z" },
  { rank: 2, display_name: "Avery Quinn", points: 180, joined_at: "2026-08-18T12:00:00.000Z" },
  { rank: 3, display_name: "Sam Rivera", points: 120, joined_at: "2026-08-19T12:00:00.000Z" },
  { rank: 4, display_name: "Pat Nguyen", points: 60, joined_at: "2026-08-20T12:00:00.000Z" },
];

const homeSettingsRows = new Map<string, Record<string, unknown>>();
const MOCK_HOME_SETTINGS_KEY = "ss_mock_home_settings";

function blankHomeSettings(agencyId: string): Record<string, unknown> {
  return {
    id: `home-${agencyId}`,
    agency_id: agencyId,
    default_landing_page: null,
    tab_name_education: "Education",
    tab_name_home: "Home",
    tab_name_support: "Support",
    ai_chat_enabled: true,
    ai_chat_type: "NATIVE",
    welcome_enabled: true,
    welcome_headline: "Welcome to your custom software solution",
    welcome_subheadline: "Get started with the tools and resources below.",
    welcome_video_enabled: false,
    checklist_title: "Daily Checklist",
    daily_checklist_enabled: false,
  };
}

function readStoredHomeSettings(): Record<string, Record<string, unknown>> {
  try {
    const raw = sessionStorage.getItem(MOCK_HOME_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

function writeStoredHomeSettings(agencyId: string, row: Record<string, unknown>) {
  try {
    const all = readStoredHomeSettings();
    all[agencyId] = row;
    sessionStorage.setItem(MOCK_HOME_SETTINGS_KEY, JSON.stringify(all));
  } catch {
    /* sessionStorage can be unavailable */
  }
}

function mockHomeSettings(agencyId: string): Record<string, unknown> {
  const existing = homeSettingsRows.get(agencyId);
  if (existing) return existing;
  const stored = readStoredHomeSettings()[agencyId];
  const row = stored
    ? { ...blankHomeSettings(agencyId), ...stored, agency_id: agencyId }
    : blankHomeSettings(agencyId);
  homeSettingsRows.set(agencyId, row);
  return row;
}

function rpcResult(fn: string, args?: Record<string, unknown>): unknown {
  switch (fn) {
    case "get_user_initial_questions_status":
      return true;
    case "get_agency_user_limit":
      return mockChromeFlags().has("limit") ? [{ current_users: 25, max_users: 25 }] : [];
    case "giveaway_leaderboard":
      return GIVEAWAY_LEADERS;
    case "giveaway_stats":
      return {
        entrants: GIVEAWAY_LEADERS.length,
        total_points: GIVEAWAY_LEADERS.reduce((sum, row) => sum + row.points, 0),
        me: {
          display_name: "Avery Quinn",
          points: 180,
          rank: 2,
          opted_in_at: "2026-08-18T12:00:00.000Z",
          breakdown: {
            users_onboarded_points: 40,
            module_completion_points: 20,
            checklist_completion_points: 10,
            login_day_points: 90,
            slack_connected: true,
            slack_points: 20,
          },
        },
      };
    case "giveaway_rescore_me":
      return null;
    case "is_hub_installed":
      return !mockInstallMissing();
    case "get_agency_tickets": {
      const shape = mockAccountShape(currentMockShape());
      return currentMockShape() === "empty" ? [] : [...shape.tickets, ...createdTickets];
    }
    case "get_user_agency_versions": {
      const user = mockAccountShape(currentMockShape()).user;
      return [
        {
          base_id: user.agency_id,
          basic_id: user.agency_id_basic,
          advanced_id: user.agency_id_advanced,
          elite_id: user.agency_id_elite,
        },
      ];
    }
    case "get_agency_clients":
      return currentMockShape() === "empty" ? [] : DEMO_CLIENTS;
    case "community_ensure_profile":
      return COMMUNITY_PROFILE;
    case "get_ticket_assignments":
      return [...mockAccountShape(currentMockShape()).tickets, ...createdTickets].map((t) => ({
        id: (t as Record<string, unknown>).id,
        assigned_to: (t as Record<string, unknown>).assigned_to ?? null,
      }));
    case "get_support_notification_settings":
      return {
        role: "owner",
        mode: "self",
        email: { alert_new_unassigned_chats: false },
        slack: { connected: true, alert_assigned_updates: false },
      };
    // Settings > Profile save. Mirrors the real RPC's return shape: the updated row with its agency ID.
    case "update_account_profile": {
      const agencyName = typeof args?.p_agency_name === "string" ? args.p_agency_name : "";
      Object.assign(userPatch, {
        full_name: typeof args?.p_full_name === "string" ? args.p_full_name : "",
        bonuses_phone: typeof args?.p_phone === "string" ? args.p_phone : "",
        agency_name: agencyName,
      });
      return [{ agency_id: (rowFor("saas_suite_users") as { agency_id?: string } | null)?.agency_id ?? "demo-agency" }];
    }
    case "set_customer_language":
      return true;
    case "get_slack_weekly_report_pref":
      return mockChromeFlags().has("slack")
        ? [{ connected: true, enabled: true, last_sent_at: "2026-11-09T14:00:00.000Z", channel_id: "C0DEMO" }]
        : [{ connected: false, enabled: false, last_sent_at: null, channel_id: null }];
    case "set_slack_weekly_report_pref":
    case "set_copilot_nudge_pref":
      return true;
    case "set_support_email_alert_pref_for":
    case "set_slack_support_alert_pref":
      return true;
    case "resolve_affiliate_slug": {
      const slug = typeof args?.slug === "string" ? args.slug.trim().toLowerCase() : "";
      if (!slug || slug.length > 120) return null;
      const rows = rowsFor("affiliates") as Array<{ id?: string; affiliate_slug?: string | null }>;
      const match = rows.find((row) => (row.affiliate_slug || "").toLowerCase() === slug);
      return match?.id ?? null;
    }
    case "get_agency_ticket_categories":
      return visibleTicketCategories(ticketCategoryRows);
    case "get_v2_home_settings": {
      const agencyId = typeof args?.p_agency_id === "string" ? args.p_agency_id : "";
      if (!agencyId) return [];
      return [mockHomeSettings(agencyId)];
    }
    case "admin_kit_customers":
      return KIT_CUSTOMER_FIXTURES;
    default:
      return null;
  }
}

function rememberTicketCategory(
  op: string,
  payload: Record<string, unknown> | null,
  idEq: string | null,
) {
  if (op === "insert" && payload) {
    ticketCategoryRows.push({
      id: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
      label: String(payload.label || ""),
      sort_order: Number(payload.sort_order ?? 0),
      is_hidden: payload.is_hidden === true,
      is_default: payload.is_default === true,
    });
    return { data: payload, error: null, count: 1 };
  }
  if (op === "update" && payload && idEq) {
    const row = ticketCategoryRows.find((item) => item.id === idEq);
    if (row) Object.assign(row, payload);
    return { data: row ?? null, error: null, count: row ? 1 : 0 };
  }
  if (op === "delete" && idEq) {
    const index = ticketCategoryRows.findIndex((item) => item.id === idEq);
    if (index >= 0) ticketCategoryRows.splice(index, 1);
    return { data: null, error: null, count: 1 };
  }
  return {
    data: ticketCategoryRows.map((row) => ({ ...row })),
    error: null,
    count: ticketCategoryRows.length,
  };
}

function query(table: string) {
  let single = false;
  let inserted: Record<string, unknown> | null = null;
  let op = "select";
  let payload: Record<string, unknown> | null = null;
  let idEq: string | null = null;
  let agencyEq: string | null = null;
  let threadEq: string | null = null;
  let userIdentifierEq: string | null = null;
  const result = () => {
    if (
      (table === "ai_chat_messages" || table === "agency_owner_messages") &&
      op === "select" &&
      userIdentifierEq
    ) {
      const rows = (rowsFor(table) as Record<string, unknown>[]).filter(
        (row) =>
          String(row.user_identifier).toLowerCase() === userIdentifierEq &&
          (!agencyEq || row.agency_id === agencyEq),
      );
      return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length };
    }
    if (table === "support_chat_assignments" && single) {
      const rows = (rowsFor(table) as Record<string, unknown>[]).filter(
        (row) =>
          String(row.user_identifier).toLowerCase() === userIdentifierEq &&
          (!agencyEq || row.agency_id === agencyEq),
      );
      return { data: rows[0] ?? null, error: null, count: rows.length };
    }
    if (table === "v2_home_settings") {
      const agencyId =
        agencyEq || (payload && typeof payload.agency_id === "string" ? payload.agency_id : null);
      if (!agencyId) return { data: single ? null : [], error: null, count: 0 };
      const row = mockHomeSettings(agencyId);
      if ((op === "update" || op === "insert") && payload) {
        Object.assign(row, payload, { agency_id: agencyId });
        writeStoredHomeSettings(agencyId, row);
      }
      return { data: single ? row : [row], error: null, count: 1 };
    }
    if (table === "setup_tracker_accounts" && (op === "insert" || op === "update")) {
      const saved = applySetupTracker(op, payload, idEq);
      if (single) return { data: saved, error: null, count: saved ? 1 : 0 };
      return { data: saved ? [saved] : [], error: null, count: saved ? 1 : 0 };
    }
    if ((op === "update" || op === "upsert") && payload) {
      if (table === "saas_suite_users") Object.assign(userPatch, payload);
      if (table === "agency_ui_versions" && payload.ui_version != null)
        uiVersion = Number(payload.ui_version);
    }
    if (table === "agency_ticket_categories") {
      const saved = rememberTicketCategory(op, payload, idEq);
      if (single)
        return { ...saved, data: Array.isArray(saved.data) ? (saved.data[0] ?? null) : saved.data };
      return saved;
    }
    if (table === "copilot_threads" && inserted) {
      const row = {
        id: `thread-${copilotThreads.length + 1}`,
        updated_at: new Date().toISOString(),
        ...inserted,
      };
      copilotThreads.unshift(row);
      inserted = null;
      return { data: single ? row : [row], error: null, count: 1 };
    }
    if (table === "copilot_thread_messages" && op === "insert" && payload) {
      const row = {
        id: `msg-${copilotMessages.length + 1}`,
        created_at: new Date().toISOString(),
        ...payload,
      };
      copilotMessages.push(row);
      return { data: single ? row : [row], error: null, count: 1 };
    }
    if (table === "copilot_thread_messages") {
      const rows = copilotMessages.filter((row) => !threadEq || row.thread_id === threadEq);
      return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length };
    }
    const data = single ? rowFor(table) : rowsFor(table);
    return { data, error: null, count: Array.isArray(data) ? data.length : data ? 1 : 0 };
  };
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const method of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "ilike",
    "like",
    "in",
    "or",
    "order",
    "limit",
    "gte",
    "lte",
    "gt",
    "lt",
    "is",
    "not",
    "contains",
    "filter",
    "match",
    "range",
    "overlaps",
    "textSearch",
    "csv",
  ]) {
    chain[method] = passthrough;
  }
  chain.insert = (row: Record<string, unknown>) => {
    op = "insert";
    payload = row;
    if (table === "copilot_threads") inserted = row;
    return chain;
  };
  chain.update = (row: Record<string, unknown>) => {
    op = "update";
    payload = row;
    return chain;
  };
  chain.upsert = (row: Record<string, unknown>) => {
    op = "upsert";
    payload = row;
    return chain;
  };
  chain.delete = () => {
    op = "delete";
    return chain;
  };
  chain.eq = (column: string, value: unknown) => {
    if (column === "id") idEq = String(value);
    if (column === "agency_id") agencyEq = String(value);
    if (column === "thread_id") threadEq = String(value);
    return chain;
  };
  chain.ilike = (column: string, value: unknown) => {
    if (column === "user_identifier") userIdentifierEq = String(value).toLowerCase();
    return chain;
  };
  chain.maybeSingle = () => {
    single = true;
    return chain;
  };
  chain.single = () => {
    single = true;
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve().then(result).then(resolve, reject);
  return chain;
}

const mockUser = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: { email: MOCK_EMAIL, full_name: "Avery Quinn" },
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
};

const mockSession = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: mockUser,
};

function mockEmail() {
  try {
    const stored = sessionStorage.getItem("ss_mock_email");
    if (stored && stored.includes("@")) return stored.toLowerCase();
  } catch {
    /* sessionStorage is unavailable outside the browser */
  }
  return MOCK_EMAIL;
}

function sessionNow() {
  const email = mockEmail();
  return {
    ...mockSession,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      ...mockUser,
      email,
      user_metadata: { ...mockUser.user_metadata, email },
    },
  };
}

function installNetworkGuard() {
  if (
    typeof window === "undefined" ||
    (window as unknown as { __ssMockGuard?: boolean }).__ssMockGuard
  )
    return;
  (window as unknown as { __ssMockGuard?: boolean }).__ssMockGuard = true;
  // The mock stands in for the whole app, so tests must not reach any live host.
  const blocked = (url: string) => {
    try {
      const host = new URL(url, "http://127.0.0.1").hostname.replace(/^\[|\]$/g, "");
      return host !== "127.0.0.1" && host !== "localhost" && host !== "::1";
    } catch {
      return true;
    }
  };
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (blocked(url)) {
      return Promise.resolve(
        new Response(JSON.stringify({ mocked: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return origFetch(input, init);
  };
  const origBeacon = navigator.sendBeacon?.bind(navigator);
  if (origBeacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (blocked(String(url))) return true;
      return origBeacon(url, data);
    };
  }
}

export function createPlatformMockClient() {
  if (!platformMockEnabled) {
    throw new Error("Platform mock refused");
  }
  installNetworkGuard();
  const listeners = new Set<(event: string, session: typeof mockSession | null) => void>();
  return {
    from(table: string) {
      return query(table);
    },
    rpc(fn: string, args?: Record<string, unknown>) {
      return Promise.resolve({ data: rpcResult(fn, args), error: null });
    },
    functions: {
      invoke(name: string, options?: { body?: Record<string, unknown> }) {
        // Entry pages (UI QA): the demo email has a password, "code@..." needs a one-time code, others are new.
        if (name === "auth-account-state") {
          const asked = String(options?.body?.email || "").toLowerCase();
          const state = asked === MOCK_EMAIL ? "password" : asked.startsWith("code@") ? "needs_password" : "new";
          return Promise.resolve({ data: { state }, error: null });
        }
        if (name === "set-initial-password") {
          return Promise.resolve({
            data: { status: options?.body?.action === "send_code" ? "sent" : "password_set" },
            error: null,
          });
        }
        if (name === "saas-partner-waitlist") {
          return Promise.resolve(mockSaasPartnerInvoke(options?.body));
        }
        if (name === "affiliate-referrals" && options?.body?.action !== "set-rate") {
          return Promise.resolve({ data: mockAffiliateSnapshot(options?.body), error: null });
        }
        if (name === "fetch-kb-structure") {
          return Promise.resolve({
            data: {
              categories: [{ slug: "getting-started", name: "Getting started", articleCount: 3 }],
            },
            error: null,
          });
        }
        if (name === "fetch-kb-category-articles") {
          return Promise.resolve({
            data: { articles: [{ slug: "connect", title: "Connect HighLevel" }] },
            error: null,
          });
        }
        if (name === "ghl-connection") {
          const demoShape = mockAccountShape(currentMockShape());
          // `ss_mock_chrome=hl_off` shows the Settings page for an account that has not connected yet.
          const shape = { ...demoShape, connected: demoShape.connected && !mockChromeFlags().has("hl_off") };
          return Promise.resolve({
            data: {
              connection: shape.connected
                ? { connected: true, company_name: "Northstar Agency" }
                : { connected: false, company_name: null },
              locations: shape.connected ? rowsFor("ghl_locations_cache") : [],
              menus: shape.connected ? rowsFor("ghl_custom_menus_cache") : [],
              menu_id: "menu_demo",
              // Fixture for the install guide's "HighLevel plan links" (action: setup_plans).
              links: shape.connected
                ? [
                    {
                      agencyId: "demo-agency",
                      menuId: "menu_demo",
                      url: "https://yoursoftwareonboarding.com/v2/demo-agency",
                      allLocations: false,
                      locationIds: ["loc_north"],
                    },
                  ]
                : [],
              unresolved: [],
              menu: { title: "Client Hub", location_ids: ["loc_north"], all_locations: false },
              changed: true,
              status: "added",
              total_accounts: 12,
              logged_in: 8,
              not_logged_in_with_email: 4,
              portal_url: "https://example.com/hub",
            },
            error: null,
          });
        }
        if (name === "kit-ad-customization") {
          return Promise.resolve({ data: { ok: true }, error: null });
        }
        // Demo reply so the Copilot chat can be judged without a backend.
        if (name === "chat-copilot" && !options?.body?.action) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    content:
                      "This demo copy has no live assistant, so here is a sample reply.\n\nIn the real app I would check your account, make the change and confirm it here. What would you like to look at next?\n[[choices: Set up my Client Hub | Brand my login page | Talk to a person]]",
                  },
                  error: null,
                }),
              1400,
            ),
          );
        }
        if (name === "chat-copilot" && options?.body?.action === "snapshot_link") {
          return Promise.resolve({
            data: { url: "https://example.com/snapshot-preview" },
            error: null,
          });
        }
        if (name === "create-ticket-from-chat") {
          const body = options?.body || {};
          const row = {
            id: typeof body.request_id === "string" ? body.request_id : crypto.randomUUID(),
            ticket_number: 1100 + createdTickets.length,
            agency_id: body.agency_id || "demo-agency",
            customer_name: body.customer_name || "Client",
            customer_email: body.customer_email || "client@example.com",
            issue_category: body.issue_category || "General Inquiry",
            request_text: body.request_text || "",
            status: "open",
            created_at: new Date().toISOString(),
            assigned_to: MOCK_EMAIL,
            source: body.source || null,
          };
          createdTickets.unshift(row);
          return Promise.resolve({
            data: { success: true, ticket_number: row.ticket_number, email_sent: true },
            error: null,
          });
        }
        return Promise.resolve({ data: {}, error: null });
      },
    },
    auth: {
      getSession: async () => ({
        data: { session: mockSignedOut() ? null : sessionNow() },
        error: null,
      }),
      getUser: async () => ({
        data: { user: mockSignedOut() ? null : sessionNow().user },
        error: null,
      }),
      onAuthStateChange(cb: (event: string, session: typeof mockSession | null) => void) {
        listeners.add(cb);
        queueMicrotask(() => {
          if (!mockSignedOut()) cb("INITIAL_SESSION", sessionNow());
        });
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    channel() {
      const ch = {
        on: () => ch,
        subscribe: () => ch,
        unsubscribe: () => {},
      };
      return ch;
    },
    removeChannel: async () => {},
    storage: {
      from() {
        return {
          upload: async () => ({ data: { path: "mock" }, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "https://example.com/logo.png" } }),
          list: async () => ({ data: [], error: null }),
          download: async () => ({ data: new Blob(), error: null }),
          remove: async () => ({ data: [], error: null }),
        };
      },
    },
  };
}
