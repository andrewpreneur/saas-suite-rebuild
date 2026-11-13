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

function rowsFor(table: string): unknown[] {
  const shape = mockAccountShape(currentMockShape());
  switch (table) {
    case "saas_suite_users": {
      const user = { ...shape.user, ...userPatch, ...mockAccountOverrides() };
      if (mockInstallMissing()) user.install_confirmed_at = null;
      return [user];
    }
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
    case "community_profiles":
      return [COMMUNITY_PROFILE];
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
      return [];
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
  const result = () => {
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
        if (name === "saas-partner-waitlist") {
          return Promise.resolve(mockSaasPartnerInvoke(options?.body));
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
          const shape = mockAccountShape(currentMockShape());
          return Promise.resolve({
            data: {
              connection: shape.connected
                ? { connected: true, company_name: "Northstar Agency" }
                : { connected: false, company_name: null },
              locations: shape.connected ? rowsFor("ghl_locations_cache") : [],
              menus: shape.connected ? rowsFor("ghl_custom_menus_cache") : [],
              menu_id: "menu_demo",
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
