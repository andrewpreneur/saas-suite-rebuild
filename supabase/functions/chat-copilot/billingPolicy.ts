import { LOGIN_TRACKING_REQUIRES_ADVANCED } from "../_shared/loginTrackingAccess.ts";

export const UPGRADE_PLANS = {
  basic: { name: "Basic", price: 27, priceId: "price_1Se8YfGdZ9PRE3Zi2GWbiNel", rank: 1 },
  advanced: { name: "Advanced", price: 97, priceId: "price_1SDdmJGdZ9PRE3Zi84yGzqVd", rank: 2 },
  enhanced: { name: "Premium Support", price: 297, priceId: "price_1UFnB8GdZ9PRE3ZiKwa8pHPH", rank: 3 },
} as const;
export type UpgradePlan = keyof typeof UPGRADE_PLANS;
export function toolArea(tool: string): string {
  if (["start_upgrade", "set_business_identity", "toggle_dynamic_installation", "initiate_account_deletion"].includes(tool)) return "settings";
  if (["update_brand_colors", "update_custom_css"].includes(tool)) return "branding";
  if (/workflow/.test(tool)) return "workflows";
  if (tool === "add_client_hub_user") return "clients";
  if (["search_support_conversations", "get_support_conversation"].includes(tool)) return "support_chats";
  return "client_hub";
}
export const READ_TOOLS = new Set(["get_plan_urls", "get_installation_status", "get_education_videos", "diagnose_install", "diagnose_menu_link_removal", "test_support_webhook", "refresh_plan_limits", "list_checklist_items", "list_workflows", "list_client_hub_users", "lookup_user", "account_health_summary", "search_support_conversations", "get_support_conversation"]);
export function accountRank(user: { plan?: string; premium_support?: boolean } | null): number {
  if (user?.premium_support || /^(PREMIUM|ENHANCED)$/i.test(user?.plan || "")) return 3;
  if (user?.plan?.toUpperCase() === "ADVANCED") return 2;
  return user?.plan?.toUpperCase() === "BASIC" ? 1 : 0;
}
export function toolUpgrade(
  tool: string,
  args: Record<string, unknown>,
  user: { plan?: string; branding_tool_access?: boolean | null } | null,
): UpgradePlan | null {
  const rank = accountRank(user);
  const purchasedBranding = user?.branding_tool_access === true;
  if (rank < 1 && ["update_brand_colors", "update_custom_css"].includes(tool) && !purchasedBranding) return "basic";
  if (rank < 1 && ["toggle_ai_chat", "update_ai_config"].includes(tool)) return "basic";
  if (rank < 2 && ["configure_workflow", "trigger_workflow"].includes(tool)) return "advanced";
  if (LOGIN_TRACKING_REQUIRES_ADVANCED && rank < 2 && tool === "update_login_settings" && (args.enabled === false || args.login_enabled === false)) return "advanced";
  if (LOGIN_TRACKING_REQUIRES_ADVANCED && rank < 2 && tool === "toggle_login_tracking" && args.enabled === false) return "advanced";
  return null;
}
const LOGIN_TRACKING_BILLING_LINE = LOGIN_TRACKING_REQUIRES_ADVANCED
  ? "Login tracking changes require Advanced."
  : "Login tracking is explained on every plan, including free Starter. There is no login-tracking training video. Mention the Advanced upgrade once for accounts below Advanced, then continue the explanation. Do not answer with only an upgrade. Flip LOGIN_TRACKING_REQUIRES_ADVANCED to require Advanced before changes.";

export const BILLING_POLICY = `Current subscription truth (overrides any older pricing text): Starter is free with 1 user. Basic is $27/month with 5 users, branding, menu link removal, AI chat support and basic marketing. Advanced is $97/month with unlimited users, multiple hub plans, analytics, workflows, Slack and voice, plus Same Day WL Support (we can answer tickets, chats, and questions from their customers within 24 hours). The Advanced list includes login tracking. ${LOGIN_TRACKING_BILLING_LINE} Premium Support is $297/month: everything in Advanced plus our white-label human support for THEIR clients (chat, tickets/email and Zoom). Premium Support is NOT the $49/account Agency Support fulfillment service. Never invent a $497 or $197 SaaSSuite tier or call hub slots subscription plans.
Use the server account context, not a price inferred from the conversation. Before a gated action, explain the minimum required plan, show [[widget:upgrade]], and continue the free installation/customization steps if they decline. Installation, welcome, education, checklists and basic ticketing remain available on Starter. Do not block onboarding on a purchase or imply Basic is needed just to install. Branding requires Basic, or a standalone branding-tool purchase on Starter; menu removal requires Basic; workflows and unlimited users require Advanced; ongoing live white-label human support for THEIR clients requires Premium Support. Same Day WL Support on Advanced is a 24-hour answer window, not that live team. Help from our team for the OWNER is different from client-facing human support; anyone can text us for setup help.
[[widget:upgrade]] shows prepared $27/$97/$297 buttons. Show that upgrade widget at most once per conversation thread. If an earlier assistant message already included it, explain the plan in words and do not attach the widget again. Clicking a button asks the server for a real Stripe payment confirmation link; never call start_upgrade without the owner's explicit choice/consent and never invent URLs or promise a free upgrade trial. Existing subscribers use a subscription update (no second subscription). Completion is charged immediately, prorated where applicable. Opening checkout alone does not activate access: re-read saved plan/limits after payment before performing gated actions.
If HighLevel setup is skipped, show [[widget:hub_link]], explain it previews their client-facing welcome/onboarding/education/support hub, not the SaaSSuite admin app, and that opening it does not install it in HighLevel. Continue with their priority and remind them occasionally to reconnect and paste agency-level CSS/JS on desktop.
When the user or you are stuck, offer [[widget:human_help]] for the same Text us popup used in the app. Explicit requests for a human still call human_handover immediately; never keep retrying the same failed fix. This setup help is not a client-support plan gate.`;