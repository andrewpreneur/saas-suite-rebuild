import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { hubVersionFor } from "../_shared/hub-url.ts";
import videoTraining from "./videoTraining.json" with { type: "json" };
import { PRIORITY_POLICY, SETUP_ORDER_POLICY, CONNECT_RELEVANCE_POLICY, nextSetupStep, videoTopics } from "./workspacePolicy.ts";
import { copilotSourcePath, recentAccountActivity } from "./accountActivity.ts";
import { MENU_REMOVAL_GUIDE_POLICY, ensureMenuRemovalWidget, shouldOfferMenuRemovalVideo, ensureMenuRemovalVideo } from "../_shared/menuRemovalGuide.ts";
import { AGENCY_BOOKING_URL, ensureBookingOffer, userWantsBooking } from "../_shared/bookingOffer.ts";
import { STANDARD_SNAPSHOT_URL, createSnapshotRedactor, redactChatMessages, redactSnapshotSecrets, snapshotEntitled } from "../_shared/snapshotAccess.ts";
import { hasFullKitAccess } from "../_shared/kit-entitlement.ts";
import { copilotFocusPolicy, validCopilotFocus, COPILOT_TOPICS } from "../_shared/copilotFocus.ts";
import { readCompletion } from "./workspaceStream.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuthedUser } from "../_shared/user-auth.ts";
import { isPlatformAdminEmail } from "../_shared/admin-auth.ts";
import { UPGRADE_PLANS, accountRank, toolUpgrade, toolArea, READ_TOOLS, BILLING_POLICY, type UpgradePlan } from "./billingPolicy.ts";
import { hubLabelForAgency, hubLabelForSlot } from "./planLabels.ts";
import { impossibleCssMessage, impossibleCssReason } from "./cssFeasibility.ts";
import { applyUnverifiedClaimGuard, factsFromAccount, factsFromValue, factsFromWorkspace, JSON_UNVERIFIED_NOTE, STREAM_UNVERIFIED_NOTE, unverifiedClaimLogRow } from "./claimGuard.ts";
import { limitUpgradeWidgets, threadHasUpgradeWidget } from "./upgradeWidget.ts";
import { subscriptionPlanName, summarizeHubUsers } from "../_shared/hubUserLimit.ts";
import { loginTrackingGuidance, loginTrackingUserReply } from "../_shared/loginTrackingAccess.ts";
import { isSimpleCopilotTurn, stripUnsolicitedHighLevelConnect, workspaceTurnPlan } from "../_shared/featureAnswers.ts";
import { postSupportAlert } from "../_shared/supportAlert.ts";
import { allowPlatformNotification, readPlatformSupportExclusion } from "../_shared/platformSupportExcluded.ts";
import { buildCopilotSupportAlert, copilotAsksForHuman, copilotHandoverThreadId, copilotReplyHandsOff } from "./humanHandoverAlert.ts";
import { billingIntervalForPlan, recordCheckoutSession } from "../_shared/journey-log.ts";
import { authFailureRow, failurePage, insertFailureRow, lastUserMessageText, recordAiChatFailure } from "./failureLog.ts";
import { formatEducationCatalog, resolveLinkedVideo } from "./educationVideos.ts";
import { isAiResumeRequest } from "./handoverQuiet.ts";
import { RELIABILITY_POLICY, dynamicAssetUrls, menuDiagnostic, handoverReply } from "./reliabilityPolicy.ts";

async function customVideoIdsForAgency(supabase: any, agencyId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("custom_onboarding_videos")
    .select("id")
    .eq("agency_id", agencyId);
  return new Set((data || []).map((row: { id?: string }) => row.id).filter((id: string | undefined): id is string => !!id));
}

function checklistStepLine(item: { item_order?: number; title?: string; link_to?: string | null; link_url?: string | null; linked_video?: string | null }): string {
  const link = item.link_to || "none";
  const target = link === "video" && item.linked_video
    ? ` video ${item.linked_video}`
    : link === "url" && item.link_url
      ? ` url ${item.link_url}`
      : "";
  return `${item.item_order}. ${item.title} [${link}${target}]`;
}

async function logAuthRefusal(
  supabase: any,
  input: Parameters<typeof authFailureRow>[0],
) {
  try {
    await Promise.race([
      recordAiChatFailure((row) => supabase.from("ai_chat_failures").insert(row), authFailureRow(input)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch (error) {
    console.error("ai_chat_failures:", error);
  }
}

async function persistCopilotMessage(
  supabase: any,
  row: Record<string, unknown>,
  meta: { stage: "user_message_insert" | "assistant_message_insert"; user: string; content: string },
) {
  try {
    const { error } = await supabase.from("copilot_chat_messages").insert(row);
    if (!error) return;
    console.error(meta.stage, error.message || error);
    await recordAiChatFailure(
      (failure) => supabase.from("ai_chat_failures").insert(failure),
      insertFailureRow({ stage: meta.stage, user: meta.user, content: meta.content, error: error.message || "insert failed" }),
    );
  } catch (error) {
    console.error(meta.stage, error);
    try {
      await recordAiChatFailure(
        (failure) => supabase.from("ai_chat_failures").insert(failure),
        insertFailureRow({
          stage: meta.stage,
          user: meta.user,
          content: meta.content,
          error: error instanceof Error ? error.message : "insert threw",
        }),
      );
    } catch (logError) {
      console.error("ai_chat_failures:", logError);
    }
  }
}

const STRIPE_PRICE_IDS: Record<string, string> = Object.fromEntries(Object.entries(UPGRADE_PLANS).map(([key, p]) => [key, p.priceId]));
const STRIPE_BILLING_PORTAL = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";
// How long the AI stays paused after a human handover.
const HANDOVER_PAUSE_HOURS = 24;

// Tool definitions for AI
const tools = [
  {
    type: "function",
    function: {
      name: "set_business_identity",
      description: "Save the owner's business name and website and customize their agency ID from the business name. Never renames when the account already has more than 1 client user (current users would lose access) — the result tells you the kept ID. Call once you have the business name (website optional).",
      parameters: {
        type: "object",
        properties: {
          business_name: { type: "string", description: "The business name exactly as the owner gave it" },
          website: { type: "string", description: "Business website URL, if given" },
        },
        required: ["business_name"],
      },
    },
  },
  // Feature Toggle Tools
  {
    type: "function",
    function: {
      name: "toggle_support_ticketing",
      description: "Enable or disable support ticketing for the user's customers",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable support ticketing" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_ai_chat",
      description: "Enable or disable the AI Chat Support feature for customers",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable AI chat support" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID (optional, defaults to basic)" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_daily_checklist",
      description: "Enable or disable the daily checklist feature",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable daily checklist" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_welcome_section",
      description: "Enable or disable the welcome section on the home page",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable welcome section" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_login_tracking",
      description: "Enable or disable login tracking/authentication for the client hub",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable login tracking" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_announcements",
      description: "Enable or disable the announcements section",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable announcements" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_custom_links",
      description: "Enable or disable custom links on the home page",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable custom links" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  // Configuration Tools
  {
    type: "function",
    function: {
      name: "update_brand_colors",
      description: "Update the user's brand colors (primary, secondary, tertiary). IMPORTANT: Always ask the user for the actual color values first. Never use placeholder or template values.",
      parameters: {
        type: "object",
        properties: {
          primary_color: { type: "string", description: "Primary hex color (e.g., #3b82f6)" },
          secondary_color: { type: "string", description: "Secondary hex color" },
          tertiary_color: { type: "string", description: "Tertiary hex color" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_welcome_text",
      description: "Update the welcome headline and subheadline text. IMPORTANT: Always ask the user for the actual text first. Never use placeholder text.",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "The welcome headline text" },
          subheadline: { type: "string", description: "The welcome subheadline text" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_welcome_video",
      description: "Configure the welcome video settings",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable the welcome video" },
          url: { type: "string", description: "The video URL" },
          is_embed: { type: "boolean", description: "Whether it's an embed code" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_login_settings",
      description: "Configure login/authentication settings",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether login is enabled" },
          login_with: { type: "string", enum: ["EMAIL", "NAME", "BOTH"], description: "How users identify themselves" },
          headline: { type: "string", description: "Login page headline" },
          subheadline: { type: "string", description: "Login page subheadline" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_support_settings",
      description: "Configure the support tab settings including headline, subheadline, and buttons",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Support section headline" },
          subheadline: { type: "string", description: "Support section subheadline" },
          button_1_text: { type: "string", description: "First button text" },
          button_1_url: { type: "string", description: "First button URL" },
          button_1_color: { type: "string", description: "First button color (hex)" },
          button_2_text: { type: "string", description: "Second button text" },
          button_2_url: { type: "string", description: "Second button URL" },
          button_2_color: { type: "string", description: "Second button color (hex)" },
          button_3_text: { type: "string", description: "Third button text" },
          button_3_url: { type: "string", description: "Third button URL" },
          button_3_color: { type: "string", description: "Third button color (hex)" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_ai_config",
      description: "Configure the Native AI chat settings including personality and behavior",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["GHL", "NATIVE"], description: "AI chat type - GHL (external embed) or NATIVE (built-in)" },
          name: { type: "string", description: "AI assistant name" },
          icon_url: { type: "string", description: "AI assistant icon URL" },
          personality: { type: "string", description: "AI personality description" },
          goals: { type: "string", description: "AI goals" },
          instructions: { type: "string", description: "Additional instructions" },
          training_doc: { type: "string", description: "Training document URL" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_tab_names",
      description: "Update the custom tab names for Home, Education, and Support",
      parameters: {
        type: "object",
        properties: {
          home_tab: { type: "string", description: "Custom name for Home tab" },
          education_tab: { type: "string", description: "Custom name for Education tab" },
          support_tab: { type: "string", description: "Custom name for Support tab" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_checklist_title",
      description: "Update the onboarding checklist title",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The checklist title" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        required: ["title"],
        additionalProperties: false
      }
    }
  },
  // Checklist Tools
  {
    type: "function",
    function: {
      name: "add_checklist_item",
      description: "Add a new item to the onboarding checklist",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Checklist item title" },
          description: { type: "string", description: "Optional description" },
          link_to: { type: "string", enum: ["none", "url", "video"], description: "What to link to" },
          link_url: { type: "string", description: "URL if link_to is 'url'" },
          linked_video: { type: "string", description: "category:module from get_education_videos when link_to is video. Example: website-content:connect-domain. scheduling is the appointments lesson, not domains." },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        required: ["title"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_checklist_item",
      description: "Remove an item from the onboarding checklist",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "The checklist item ID to remove" }
        },
        required: ["item_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_checklist_items",
      description: "List the onboarding checklist items that ACTUALLY exist right now for a plan. Call this before claiming a checklist exists, before editing it, and after building it to verify.",
      parameters: {
        type: "object",
        properties: {
          plan_agency_id: { type: "string", description: "The hub-specific agency ID (omit for Hub 1)" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_checklist_items",
      description: "Build or replace an ENTIRE onboarding checklist for a plan in one call, in the exact order given. Use this whenever the user asks for a multi-step onboarding flow (e.g. a 7-step linear flow). This is the ONLY way to create a full checklist — never describe steps to a user without calling this.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Ordered checklist steps. The array order becomes the step order.",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Step title" },
                description: { type: "string", description: "Optional step instructions" },
                link_to: { type: "string", enum: ["none", "url", "video"] },
                link_url: { type: "string" },
                linked_video: { type: "string", description: "category:module from get_education_videos. Example: website-content:connect-domain." }
              },
              required: ["title"],
              additionalProperties: false
            }
          },
          title: { type: "string", description: "Optional checklist heading shown above the steps" },
          replace_existing: { type: "boolean", description: "Default true — removes existing items first so the order is exactly as given" },
          plan_agency_id: { type: "string", description: "The hub-specific agency ID (omit for Hub 1)" }
        },
        required: ["items"],
        additionalProperties: false
      }
    }
  },
  // Setup Tools
  {
    type: "function",
    function: {
      name: "get_plan_urls",
      description: "Get the user's plan URLs for installation",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_installation_status",
      description: "Check what features the user has set up and what's pending. Returns comprehensive current settings.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_support_webhook",
      description: "Set the inbound webhook URL for SUPPORT TICKET notifications ONLY. This does NOT create or configure a workflow trigger (new user, login, checklist complete, etc.) — for those you MUST use configure_workflow instead. You MUST ask the user for their actual webhook URL first. Never use a placeholder or template URL.",

      parameters: {
        type: "object",
        properties: {
          webhook_url: { type: "string", description: "The webhook URL to receive notifications - must be provided by the user" }
        },
        required: ["webhook_url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_announcements",
      description: "Update the announcements section content",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Announcement headline" },
          paragraph: { type: "string", description: "Announcement paragraph text" },
          image_url: { type: "string", description: "Announcement image URL" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_custom_links",
      description: "Update the custom links on the home page",
      parameters: {
        type: "object",
        properties: {
          link_1_text: { type: "string", description: "First link text" },
          link_1_url: { type: "string", description: "First link URL" },
          link_1_color: { type: "string", description: "First link color (hex)" },
          link_2_text: { type: "string", description: "Second link text" },
          link_2_url: { type: "string", description: "Second link URL" },
          link_2_color: { type: "string", description: "Second link color (hex)" },
          link_3_text: { type: "string", description: "Third link text" },
          link_3_url: { type: "string", description: "Third link URL" },
          link_3_color: { type: "string", description: "Third link color (hex)" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_daily_checklist_items",
      description: "Update the daily checklist items (up to 3 items)",
      parameters: {
        type: "object",
        properties: {
          item_1: { type: "string", description: "First daily checklist item" },
          item_2: { type: "string", description: "Second daily checklist item" },
          item_3: { type: "string", description: "Third daily checklist item" },
          plan_agency_id: { type: "string", description: "The plan-specific agency ID" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_dynamic_installation",
      description: "Enable or disable dynamic installation mode. When enabled, installation uses a single auto-updating URL instead of manual code blocks.",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable dynamic installation" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_tips_bot",
      description: "Enable or disable the Tips Bot that shows contextual tips to users",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable the tips bot" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_client_hub",
      description: "Enable or disable the V2 Client Hub navigation for customers",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "Whether to enable the V2 client hub" }
        },
        required: ["enabled"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_education_videos",
      description: "Get every education lesson the hub can open, with the exact linked_video value. Call this before linking a checklist step to a video. Pass that value unchanged. Do not invent ids and do not substitute a different lesson.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "human_handover",
      description: "Request human support and pause AI replies. Do not promise an assigned person or immediate response. Use this when the user explicitly asks to talk to a person, says they need help from a human, says they are stuck and need assistance beyond what you can provide, or requests human support. Report only the delivery and pause status returned by this tool.",
      parameters: {
        type: "object",
        properties: {
          last_message: { type: "string", description: "The user's last message that triggered the handover" },
          reason: { type: "string", description: "Brief reason for the handover" }
        },
        required: ["last_message"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "lookup_user",
      description: "Look up one of the agency's end-users (Client Hub users) by name or email fragment. Returns up to 5 matches, scoped to this agency.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Name or email fragment" } },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "account_health_summary",
      description: "High-level agency health snapshot: total end-users and recent login/session activity.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "list_workflows",
      description: "List the caller's configured workflow automations (trigger_type, enabled, whether webhook is set).",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "configure_workflow",
      description: "Create or update a workflow automation for the caller: saves the HighLevel inbound webhook URL against a fixed trigger_type and enables it. This is the ONLY way to link a webhook to a trigger — update_support_webhook does NOT do this. Requires the ADVANCED plan. Call this BEFORE trigger_workflow, otherwise the test fire has nothing to send to.",
      parameters: {
        type: "object",
        properties: {
          trigger_type: { type: "string", description: "One of: video_completed, existing_user_login, new_user_login, onboarding_checklist_completed, ai_support_engaged, human_handover" },
          webhook_url: { type: "string", description: "The user's real HighLevel inbound webhook URL (must contain services.leadconnectorhq.com). Never invent one." },
          enabled: { type: "boolean", description: "Whether the workflow is active. Defaults to true." },
          plan_agency_id: { type: "string", description: "Optional plan agency ID. Defaults to the caller's primary agency ID." }
        },
        required: ["trigger_type", "webhook_url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "trigger_workflow",
      description: "Manually fire an ALREADY CONFIGURED workflow by trigger_type to send a test payload to the saved webhook. If no workflow with a saved webhook exists for that trigger, this returns a failure — call configure_workflow first. Requires the user to confirm before calling.",
      parameters: {
        type: "object",
        properties: {
          trigger_type: { type: "string", description: "One of: video_completed, existing_user_login, new_user_login, onboarding_checklist_completed, ai_support_engaged, human_handover" },
          target_email: { type: "string", description: "Optional end-user email to include in the payload" }
        },
        required: ["trigger_type"],
        additionalProperties: false
      }
    }
  },

  // Diagnostic + self-service tools (added to reduce human handovers on
  // install/webhook/limit/user-add/deletion issues).
  {
    type: "function",
    function: {
      name: "diagnose_install",
      description: "Diagnose the SaaSSuite install for a hub agency ID. Fetches the dynamic-styles JS and CSS endpoints, checks reachability, confirms the expected markers, reports which hub (Hub 1, Hub 2, or Hub 3) the agency ID maps to, and checks whether that hub is at its user limit. Use this FIRST whenever a user says their install is blank, the sidebar link doesn't work, the iframe is empty, branding didn't apply, menu link removal isn't working, or a client cannot sign in — BEFORE offering handover. If it reports at user limit, that is the cause. Do not say the email was not added.",
      parameters: {
        type: "object",
        properties: {
          plan_agency_id: { type: "string", description: "Optional specific plan agency ID to check. Defaults to all configured agency IDs on the account." }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "test_support_webhook",
      description: "Send a test/probe payload to the caller's saved support_webhook_url and return the HTTP status and response body snippet. Use this when the user reports 'submission failed' on support tickets or asks whether their webhook is working — BEFORE offering handover.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "add_client_hub_user",
      description: "Add an end-user (client) to the caller's Client Hub for a specific plan. Enforces the agency capacity limit. Use this when the user asks CoPilot to add a user, invite a client, or reports that they cannot add a user in the Client Hub manager. Always confirm the email + which plan before calling.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "End-user email address to add" },
          name: { type: "string", description: "Optional display name for the end-user" },
          plan_slot: { type: "string", enum: ["basic", "advanced", "elite"], description: "Which hub to add them to. basic = Hub 1, advanced = Hub 2, elite = Hub 3. Defaults to Hub 1. Say Hub 1/2/3 to the user, never Plan 1/2/3." }
        },
        required: ["email"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_client_hub_users",
      description: "Read-only list of this agency's real client hub users from user_progress (guests excluded). Returns each person's email, first-seen time, and whether they count toward the plan limit, plus the plan limit and used count per hub. MUST be called before naming, counting, or telling the user to delete any hub user. Never invent an email that this tool did not return.",
      parameters: {
        type: "object",
        properties: {
          plan_agency_id: { type: "string", description: "Optional hub agency ID. Defaults to every hub on the account." }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "refresh_plan_limits",
      description: "Re-read the caller's subscription plan and per-hub user capacity from the database and return the current numbers. Use this when the user reports 'I upgraded but my limit still says the old plan' or 'my account says I hit my limit but I just upgraded' — BEFORE offering handover.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "initiate_account_deletion",
      description: "Explain self-service Settings > Profile > Delete Account. Does not delete anything or create a ticket.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Optional reason the user is deleting their account" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_upgrade",
      description: "Generate a real Stripe upgrade link only after explicit consent: basic ($27/mo), advanced ($97/mo), enhanced (Premium Support $297/mo). Existing subscribers confirm a subscription update; Starter users confirm Checkout. Never invent a link or change access before payment.",
      parameters: {
        type: "object",
        properties: {
          target_plan: { type: "string", enum: ["basic", "advanced", "enhanced"], description: "Selected subscription tier" }
        },
        required: ["target_plan"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_kb_logo",
      description: "Set the caller's Knowledge Base logo image (top-left of the KB / client hub). Provide a direct https image URL. Writes to saas_suite_users.kb_logo_url. Confirm the URL back to the user.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Direct https URL to the logo image (png/jpg/svg)." }
        },
        required: ["url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_custom_css",
      description: "Append or replace custom CSS on the caller's branding (saas_suite_users.generated_css). Use when the user asks for a small tweak like 'move widget up 80px', 'change sidebar border', or a Poppins font override. Prefer mode='append' (adds a commented block); use mode='replace' only when the user explicitly asks to overwrite everything. Include a short comment describing the change.",
      parameters: {
        type: "object",
        properties: {
          css: { type: "string", description: "The CSS snippet to add. Should be valid CSS." },
          note: { type: "string", description: "Short human-readable label for this change, e.g. 'Move chat widget up 80px'." },
          mode: { type: "string", enum: ["append", "replace"], description: "append (default) adds a new commented block; replace overwrites generated_css entirely." }
        },
        required: ["css"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "diagnose_menu_link_removal",
      description: "Diagnose why menu link removal rules aren't hiding links for the caller. Returns configured rules, the CSS payload actually being served by dynamic-styles for the target agency/sub-account, and whether it contains the expected 'display:none' selectors. Use whenever a user says links won't hide despite a rule existing.",
      parameters: {
        type: "object",
        properties: {
          plan_agency_id: { type: "string", description: "The plan-specific agency ID to check. Defaults to primary agency_id." },
          sub_account_id: { type: "string", description: "Optional sub-account (location) ID to test the served CSS against." }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_support_conversations",
      description: "Search ALL of this agency's support tickets (incl. replies) and client chats (AI chat + team replies) by a person's name, email, ticket number, or any keyword in the message text. Use whenever the owner asks about a conversation, ticket, or chat with a specific user or topic. Returns matching tickets and chat threads with snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, email, ticket number, or keyword. Use an empty string to list the most recent items." },
          kind: { type: "string", enum: ["all", "tickets", "chats"], description: "Limit to tickets or chats. Default all." }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_support_conversation",
      description: "Read the full transcript of one ticket (by ticket_number or ticket_id) or one client chat (by user_identifier, usually the client's email). Call after search_support_conversations to answer questions about what was said.",
      parameters: {
        type: "object",
        properties: {
          ticket_number: { type: "number" },
          ticket_id: { type: "string" },
          user_identifier: { type: "string", description: "Client chat identifier (email) from search results" }
        },
        additionalProperties: false
      }
    }
  }
];

async function ownerEmailsForAccount(supabase: any, userData: any): Promise<string[]> {
  const emails = new Set<string>();
  const owner = String(userData?.email || "").trim();
  if (owner) emails.add(owner.toLowerCase());
  if (!owner) return [...emails];
  const [{ data: admins }, { data: aliases }] = await Promise.all([
    supabase.from("account_admins").select("admin_email").ilike("owner_email", owner),
    supabase.from("onboarding_owner_aliases").select("alias_email").ilike("owner_email", owner),
  ]);
  for (const row of admins || []) if (row?.admin_email) emails.add(String(row.admin_email).trim().toLowerCase());
  for (const row of aliases || []) if (row?.alias_email) emails.add(String(row.alias_email).trim().toLowerCase());
  return [...emails];
}

async function hubUsersForAgency(supabase: any, userData: any, agencyId: string, ownerEmails: string[]) {
  const { data: rows } = await supabase.from("user_progress").select("email, name, created_at").eq("agency_id", agencyId);
  const summary = summarizeHubUsers(rows || [], ownerEmails);
  const { data: limit } = await supabase.rpc("get_agency_user_limit", { p_agency_id: agencyId });
  const row = Array.isArray(limit) ? limit[0] : limit;
  const max = row?.max_users ?? userData?.max_onboarding_users ?? null;
  const used = summary.used;
  return {
    users: summary.users,
    limit: max,
    used,
    at_user_limit: max != null && used >= max,
    cause: max != null && used >= max ? "at user limit" : null,
  };
}

type HandoverMemo = { sent: boolean; delivery?: "sent" | "failed" | "skipped" };

// Same Support alert as end-user handover: LeadConnector support_alert body plus
// the global handover_requested webhook. One attempt per request. A failure is logged
// and does not throw, so the chat reply still goes out.
async function alertCopilotHumanHandover(
  supabase: any,
  userEmail: string,
  userData: any,
  lastMessage: string,
  reason: string,
  memo: HandoverMemo,
): Promise<"sent" | "failed" | "excluded" | "unknown" | "skipped"> {
  if (memo.sent) return memo.delivery || "failed";
  const agencyId = String(userData?.agency_id || userData?.agency_id_basic || "");
  const exclusion = await readPlatformSupportExclusion(supabase, agencyId);
  if (!allowPlatformNotification(exclusion)) {
    console.info("copilot handover alert skipped: platform support excluded", agencyId, exclusion);
    return exclusion;
  }
  memo.sent = true;
  const email = String(userEmail || "").trim().toLowerCase();
  try {
    memo.delivery = await postSupportAlert(
      buildCopilotSupportAlert({
        agencyId,
        email,
        name: userData?.full_name || userData?.agency_name || email,
        agencyName: userData?.agency_name || null,
        plan: userData?.plan || null,
        lastMessage,
        reason,
        timestamp: new Date().toISOString(),
      }),
      agencyId,
      email,
      supabase,
      { surface: "copilot", threadId: copilotHandoverThreadId(email) },
    );
  } catch (error) {
    console.error("copilot human handover alert failed", error);
  }
  return memo.delivery || "failed";
}

// Tool execution functions
async function executeTool(toolName: string, args: any, supabase: any, userEmail: string, userData: any, handoverMemo: HandoverMemo = { sent: false }) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  try {
    if (userData?._copilotPermissions && toolName !== "human_handover") {
      const permissions = userData._copilotPermissions;
      const level = permissions[toolArea(toolName)] ?? "edit";
      if (level === "none" || (!READ_TOOLS.has(toolName) && level !== "edit") || (["search_support_conversations", "get_support_conversation"].includes(toolName) && userData._copilotAssignedOnly)) return { success: false, message: "Your team permissions don't allow this action in Copilot. Ask the account owner or use the assigned support screen." };
    }
    const required = toolUpgrade(toolName, args || {}, userData);
    if (required) return { success: false, upgrade_required: required, message: `This feature needs ${UPGRADE_PLANS[required].name} ($${UPGRADE_PLANS[required].price}/month). Nothing changed. Show [[widget:upgrade]] and continue available setup if they decline.` };
    if (args?.plan_agency_id && ![userData?.agency_id, userData?.agency_id_basic, userData?.agency_id_advanced, userData?.agency_id_elite].includes(args.plan_agency_id)) {
      return { success: false, message: "That Client Hub is not owned by this account. Nothing changed." };
    }
    if (args?.plan_agency_id && args.plan_agency_id !== (userData?.agency_id_basic || userData?.agency_id) && accountRank(userData) < 2) {
      return { success: false, upgrade_required: "advanced", message: "Multiple Client Hub plans require Advanced. Nothing changed. Show [[widget:upgrade]]." };
    }
    switch (toolName) {
      case "toggle_support_ticketing": {
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ support_ticketing_enabled: args.enabled })
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Support ticketing has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_ai_chat": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { error } = await supabase
          .from("v2_home_settings")
          .update({ ai_chat_enabled: args.enabled })
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `AI Chat Support has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_daily_checklist": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { error } = await supabase
          .from("v2_home_settings")
          .update({ daily_checklist_enabled: args.enabled })
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Daily checklist has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_welcome_section": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { error } = await supabase
          .from("v2_home_settings")
          .update({ welcome_enabled: args.enabled })
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Welcome section has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_login_tracking": {
        if (args.enabled === false && (userData?.plan === "STARTER" || userData?.plan === "BASIC")) {
          return { success: false, message: `Login tracking is required on the ${userData.plan} plan — end-users would be locked out with an "unable to create guest session" error once the user cap is hit. Upgrade to Advanced to allow guest access.` };
        }
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ login_enabled: args.enabled })
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Login tracking has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_announcements": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { error } = await supabase
          .from("v2_home_settings")
          .update({ announcements_enabled: args.enabled })
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Announcements have been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_custom_links": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { error } = await supabase
          .from("v2_home_settings")
          .update({ custom_links_enabled: args.enabled })
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Custom links have been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "update_brand_colors": {
        const updates: any = {};
        if (args.primary_color) updates.primary_color = args.primary_color;
        if (args.secondary_color) updates.secondary_color = args.secondary_color;
        if (args.tertiary_color) updates.tertiary_color = args.tertiary_color;
        
        const { error } = await supabase
          .from("saas_suite_users")
          .update(updates)
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Brand colors have been updated.` };
      }

      case "set_business_identity": {
        const name = String(args.business_name || "").trim().slice(0, 80);
        if (!name) return { success: false, message: "No business name given — ask for it." };
        const website = String(args.website || "").trim().slice(0, 300) || null;
        await supabase.from("copilot_preferences").upsert({ owner_email: String(userEmail).toLowerCase(), business_website: website, updated_at: new Date().toISOString() }, { onConflict: "owner_email" });
        const currentId = userData?.agency_id as string;
        const { count } = await supabase.from("user_progress").select("id", { count: "exact", head: true }).eq("agency_id", currentId);
        const slug = name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
        if ((count ?? 0) > 1) {
          await supabase.from("saas_suite_users").update({ agency_name: name }).ilike("email", userEmail);
          return { success: true, renamed: false, agency_id: currentId, message: `Saved the business name. Agency ID stays "${currentId}" because ${count} users already use it — changing it would cut off their access. Tell the user this plainly.` };
        }
        if (!slug || slug === currentId) {
          await supabase.from("saas_suite_users").update({ agency_name: name }).ilike("email", userEmail);
          return { success: true, renamed: false, agency_id: currentId, message: `Saved. Agency ID is "${currentId}".` };
        }
        const { data: taken } = await supabase.from("saas_suite_users").select("email").or(`agency_id.eq.${slug},agency_id_basic.eq.${slug}`).limit(1);
        if (taken && taken.length && String(taken[0].email).toLowerCase() !== String(userEmail).toLowerCase()) {
          await supabase.from("saas_suite_users").update({ agency_name: name }).ilike("email", userEmail);
          return { success: true, renamed: false, agency_id: currentId, message: `Saved the name, but the ID "${slug}" is taken by another account, so the agency ID stays "${currentId}". Offer an alternative name if they want a custom ID.` };
        }
        const { data: upd, error } = await supabase.from("saas_suite_users").update({ agency_name: name, agency_id: slug, agency_id_basic: slug }).ilike("email", userEmail).select("agency_id");
        if (error || !upd?.length) return { success: false, message: "Couldn't update the agency ID — nothing changed." };
        return { success: true, renamed: true, agency_id: upd[0].agency_id, client_hub_url: `https://yoursoftwareonboarding.com/v2/${upd[0].agency_id}`, message: `Agency ID is now "${upd[0].agency_id}". Their client hub link is https://yoursoftwareonboarding.com/v2/${upd[0].agency_id}. Explain in one message: the agency ID is the unique name in their client hub link and CSS/JS install codes.` };
      }

      case "update_welcome_text": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.headline) updates.welcome_headline = args.headline;
        if (args.subheadline) updates.welcome_subheadline = args.subheadline;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Welcome text has been updated.` };
      }

      case "update_welcome_video": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.enabled !== undefined) updates.welcome_video_enabled = args.enabled;
        if (args.url !== undefined) updates.welcome_video_url = args.url;
        if (args.is_embed !== undefined) updates.welcome_video_is_embed = args.is_embed;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Welcome video settings have been updated.` };
      }

      case "update_login_settings": {
        const updates: any = {};
        if (args.enabled !== undefined) {
          if (args.enabled === false && (userData?.plan === "STARTER" || userData?.plan === "BASIC")) {
            return { success: false, message: `Login cannot be disabled on the ${userData.plan} plan — guest sessions rely on the user cap and end-users would see "unable to create guest session". Upgrade to Advanced to turn login off.` };
          }
          updates.login_enabled = args.enabled;
        }
        if (args.login_with) updates.login_with = args.login_with;
        if (args.headline) updates.login_welcome_headline = args.headline;
        if (args.subheadline) updates.login_welcome_subheadline = args.subheadline;
        
        const { error } = await supabase
          .from("saas_suite_users")
          .update(updates)
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Login settings have been updated.` };
      }

      case "update_support_settings": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.headline) updates.support_headline = args.headline;
        if (args.subheadline) updates.support_subheadline = args.subheadline;
        if (args.button_1_text) updates.support_button_1_text = args.button_1_text;
        if (args.button_1_url) updates.support_button_1_url = args.button_1_url;
        if (args.button_1_color) updates.support_button_1_color = args.button_1_color;
        if (args.button_2_text) updates.support_button_2_text = args.button_2_text;
        if (args.button_2_url) updates.support_button_2_url = args.button_2_url;
        if (args.button_2_color) updates.support_button_2_color = args.button_2_color;
        if (args.button_3_text) updates.support_button_3_text = args.button_3_text;
        if (args.button_3_url) updates.support_button_3_url = args.button_3_url;
        if (args.button_3_color) updates.support_button_3_color = args.button_3_color;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Support settings have been updated.` };
      }

      case "update_ai_config": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.type) updates.ai_chat_type = args.type;
        if (args.name) updates.ai_chat_name = args.name;
        if (args.icon_url) updates.ai_chat_icon_url = args.icon_url;
        if (args.personality) updates.prompt_personality = args.personality;
        if (args.goals) updates.prompt_goals = args.goals;
        if (args.instructions) updates.prompt_additional_instructions = args.instructions;
        if (args.training_doc) updates.prompt_training_doc = args.training_doc;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `AI configuration has been updated.` };
      }

      case "update_tab_names": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.home_tab) updates.tab_name_home = args.home_tab;
        if (args.education_tab) updates.tab_name_education = args.education_tab;
        if (args.support_tab) updates.tab_name_support = args.support_tab;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Tab names have been updated.` };
      }

      case "update_checklist_title": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { error } = await supabase
          .from("v2_home_settings")
          .update({ checklist_title: args.title })
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Checklist title has been updated to "${args.title}".` };
      }

      case "add_checklist_item": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const linkTo = args.link_to || "none";
        let linkedVideo: string | null = args.linked_video || null;
        if (linkTo === "video") {
          const extraIds = await customVideoIdsForAgency(supabase, agencyId);
          const resolved = resolveLinkedVideo(linkedVideo, extraIds);
          if (!resolved.ok) return { success: false, message: `NOT SAVED. ${resolved.error}` };
          linkedVideo = resolved.value;
        }
        
        const { data: existingItems } = await supabase
          .from("agency_onboarding_checklist")
          .select("item_order")
          .eq("agency_id", agencyId)
          .order("item_order", { ascending: false })
          .limit(1);
        
        const nextOrder = existingItems && existingItems.length > 0 ? existingItems[0].item_order + 1 : 1;
        
        const { error } = await supabase
          .from("agency_onboarding_checklist")
          .insert({
            agency_id: agencyId,
            title: args.title,
            description: args.description || null,
            link_to: linkTo,
            link_url: args.link_url || null,
            linked_video: linkTo === "video" ? linkedVideo : null,
            item_order: nextOrder
          });
        if (error) throw error;
        return { success: true, message: `Checklist item "${args.title}" has been added${linkTo === "video" ? ` with linked_video ${linkedVideo}` : ""}.` };
      }

      case "remove_checklist_item": {
        const { error } = await supabase
          .from("agency_onboarding_checklist")
          .delete()
          .eq("id", args.item_id);
        if (error) throw error;
        return { success: true, message: `Checklist item has been removed.` };
      }

      case "list_checklist_items": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const { data, error } = await supabase
          .from("agency_onboarding_checklist")
          .select("id, item_order, title, description, link_to, link_url, linked_video")
          .eq("agency_id", agencyId)
          .order("item_order", { ascending: true });
        if (error) throw error;
        const items = data || [];
        return {
          success: true,
          data: { agency_id: agencyId, count: items.length, items },
          message: items.length
            ? `Checklist for ${agencyId} has ${items.length} step(s):\n` +
              items.map((i: any) => checklistStepLine(i)).join('\n')
            : `There are NO checklist items for ${agencyId} yet. Nothing has been built on this plan.`
        };
      }

      case "set_checklist_items": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const rawItems = Array.isArray(args.items) ? args.items : [];
        const items = rawItems
          .map((i: any) => ({ ...i, title: typeof i?.title === 'string' ? i.title.trim() : '' }))
          .filter((i: any) => i.title.length > 0);

        if (items.length === 0) {
          return { success: false, message: `No valid checklist steps were provided (every step needs a title), so NOTHING was created. Ask the user for the step titles and try again.` };
        }

        const extraIds = await customVideoIdsForAgency(supabase, agencyId);
        const videoErrors: string[] = [];
        for (const item of items) {
          if ((item.link_to || "none") !== "video") continue;
          const resolved = resolveLinkedVideo(item.linked_video, extraIds);
          if (!resolved.ok) videoErrors.push(`"${item.title}": ${resolved.error}`);
          else item.linked_video = resolved.value;
        }
        if (videoErrors.length > 0) {
          return {
            success: false,
            message: `NOT SAVED. The checklist was left unchanged.\n` + videoErrors.join("\n"),
          };
        }

        if (args.replace_existing !== false) {
          const { error: delError } = await supabase
            .from("agency_onboarding_checklist")
            .delete()
            .eq("agency_id", agencyId);
          if (delError) throw delError;
        }

        let startOrder = 1;
        if (args.replace_existing === false) {
          const { data: existing } = await supabase
            .from("agency_onboarding_checklist")
            .select("item_order")
            .eq("agency_id", agencyId)
            .order("item_order", { ascending: false })
            .limit(1);
          startOrder = existing && existing.length > 0 ? existing[0].item_order + 1 : 1;
        }

        const rows = items.map((i: any, idx: number) => ({
          agency_id: agencyId,
          title: i.title,
          description: i.description || null,
          link_to: i.link_to || 'none',
          link_url: i.link_url || null,
          linked_video: (i.link_to || "none") === "video" ? (i.linked_video || null) : null,
          item_order: startOrder + idx,
        }));

        const { error } = await supabase.from("agency_onboarding_checklist").insert(rows);
        if (error) throw error;

        if (args.title) {
          await supabase
            .from("v2_home_settings")
            .update({ checklist_title: args.title })
            .eq("agency_id", agencyId);
        }

        // Verify what actually landed in the database before reporting success.
        const { data: verify } = await supabase
          .from("agency_onboarding_checklist")
          .select("item_order, title, link_to, link_url, linked_video")
          .eq("agency_id", agencyId)
          .order("item_order", { ascending: true });

        return {
          success: true,
          data: { agency_id: agencyId, items: verify || [] },
          message: `Saved ${rows.length} checklist step(s) to ${agencyId}. Live checklist is now:\n` +
            (verify || []).map((i: any) => checklistStepLine(i)).join('\n') +
            `\nReport these linked_video values exactly. Do not rename a lesson.`
        };
      }

      case "get_plan_urls": {
        const planUrl = async (id: string | null) => id ? `https://yoursoftwareonboarding.com/v${await hubVersionFor(supabase, id)}/${id}` : null;
        const urls = {
          plan_1: await planUrl(userData.agency_id),
          plan_2: await planUrl(userData.agency_id_advanced),
          plan_3: await planUrl(userData.agency_id_elite)
        };
        return { 
          success: true, 
          data: urls,
          message: `Here are your hub URLs:\n${urls.plan_1 ? `- Hub 1: ${urls.plan_1}` : '- Hub 1: Not created yet'}\n${urls.plan_2 ? `- Hub 2: ${urls.plan_2}` : '- Hub 2: Not created yet'}\n${urls.plan_3 ? `- Hub 3: ${urls.plan_3}` : '- Hub 3: Not created yet'}`
        };
      }

      case "get_installation_status": {
        // Fetch v2 home settings for all plans
        const agencyIds = [userData.agency_id, userData.agency_id_advanced, userData.agency_id_elite].filter(Boolean);
        let homeSettings: any[] = [];
        if (agencyIds.length > 0) {
          const { data } = await supabase
            .from("v2_home_settings")
            .select("*")
            .in("agency_id", agencyIds);
          homeSettings = data || [];
        }

        // Fetch menu link rules
        let menuLinkRules: any[] = [];
        if (agencyIds.length > 0) {
          const { data } = await supabase
            .from("menu_link_rules")
            .select("*")
            .in("agency_id", agencyIds);
          menuLinkRules = data || [];
        }

        // Fetch email warmup requests
        const { data: warmupRequests } = await supabase
          .from("email_warmup_requests")
          .select("*")
          .eq("user_email", userEmail);

        const status = {
          has_agency_id: !!userData.agency_id,
          has_branding: !!(userData.primary_color || userData.secondary_color),
          primary_color: userData.primary_color,
          secondary_color: userData.secondary_color,
          tertiary_color: userData.tertiary_color,
          support_ticketing_enabled: userData.support_ticketing_enabled,
          support_webhook_url: userData.support_webhook_url || 'Not set',
          login_enabled: userData.login_enabled,
          login_with: userData.login_with,
          login_headline: userData.login_welcome_headline,
          login_subheadline: userData.login_welcome_subheadline,
          dynamic_installation: userData.dynamic_installation,
          tips_bot_enabled: userData.tips_bot_enabled,
          client_hub_enabled: userData.client_hub_enabled,
          v2_navigation_enabled: userData.v2_navigation_enabled,
          agency_name: userData.agency_name,
          branding_tool_access: userData.branding_tool_access,
          email_warmup_access: userData.email_warmup_access,
          plan: userData.plan,
          plan_urls: {
            plan_1: !!userData.agency_id,
            plan_2: !!userData.agency_id_advanced,
            plan_3: !!userData.agency_id_elite
          },
          home_settings: homeSettings.map((hs: any) => ({
            agency_id: hs.agency_id,
            welcome_headline: hs.welcome_headline,
            welcome_subheadline: hs.welcome_subheadline,
            welcome_enabled: hs.welcome_enabled,
            welcome_video_enabled: hs.welcome_video_enabled,
            welcome_video_url: hs.welcome_video_url,
            ai_chat_enabled: hs.ai_chat_enabled,
            ai_chat_type: hs.ai_chat_type,
            ai_chat_name: hs.ai_chat_name,
            daily_checklist_enabled: hs.daily_checklist_enabled,
            checklist_title: hs.checklist_title,
            announcements_enabled: hs.announcements_enabled,
            announcements_headline: hs.announcements_headline,
            custom_links_enabled: hs.custom_links_enabled,
            support_headline: hs.support_headline,
            support_subheadline: hs.support_subheadline,
            tab_name_home: hs.tab_name_home,
            tab_name_education: hs.tab_name_education,
            tab_name_support: hs.tab_name_support,
            has_ai_personality: !!hs.prompt_personality,
            has_ai_goals: !!hs.prompt_goals,
            has_ai_instructions: !!hs.prompt_additional_instructions,
          })),
          menu_link_rules_count: menuLinkRules.length,
          menu_link_rules: menuLinkRules.map((r: any) => ({
            id: r.id,
            sub_account_id: r.sub_account_id || 'All accounts',
            hidden_links_count: Array.isArray(r.hidden_links) ? r.hidden_links.length : 0,
            is_active: r.is_active
          })),
          email_warmup: warmupRequests && warmupRequests.length > 0 ? warmupRequests.map((r: any) => ({
            sender_email: r.sender_email,
            sender_name: r.sender_name,
            status: r.status,
            created_at: r.created_at
          })) : 'No warmup requests'
        };

        return { 
          success: true, 
          data: status,
          message: JSON.stringify(status, null, 2)
        };
      }

      case "update_support_webhook": {
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ support_webhook_url: args.webhook_url })
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Support webhook URL has been updated to: ${args.webhook_url}` };
      }

      case "update_announcements": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.headline) updates.announcements_headline = args.headline;
        if (args.paragraph) updates.announcements_paragraph = args.paragraph;
        if (args.image_url) updates.announcements_image_url = args.image_url;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Announcements have been updated.` };
      }

      case "update_custom_links": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.link_1_text) updates.custom_link_1_text = args.link_1_text;
        if (args.link_1_url) updates.custom_link_1_url = args.link_1_url;
        if (args.link_1_color) updates.custom_link_1_color = args.link_1_color;
        if (args.link_2_text) updates.custom_link_2_text = args.link_2_text;
        if (args.link_2_url) updates.custom_link_2_url = args.link_2_url;
        if (args.link_2_color) updates.custom_link_2_color = args.link_2_color;
        if (args.link_3_text) updates.custom_link_3_text = args.link_3_text;
        if (args.link_3_url) updates.custom_link_3_url = args.link_3_url;
        if (args.link_3_color) updates.custom_link_3_color = args.link_3_color;
        
        const { error } = await supabase
          .from("v2_home_settings")
          .update(updates)
          .eq("agency_id", agencyId);
        if (error) throw error;
        return { success: true, message: `Custom links have been updated.` };
      }

      case "update_daily_checklist_items": {
        const agencyId = args.plan_agency_id || userData.agency_id;
        const updates: any = {};
        if (args.item_1 !== undefined) updates.item_1 = args.item_1;
        if (args.item_2 !== undefined) updates.item_2 = args.item_2;
        if (args.item_3 !== undefined) updates.item_3 = args.item_3;
        
        const { data: existing } = await supabase
          .from("agency_daily_checklist")
          .select("agency_id")
          .eq("agency_id", agencyId)
          .maybeSingle();
        
        if (existing) {
          const { error } = await supabase
            .from("agency_daily_checklist")
            .update(updates)
            .eq("agency_id", agencyId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("agency_daily_checklist")
            .insert({ agency_id: agencyId, ...updates });
          if (error) throw error;
        }
        return { success: true, message: `Daily checklist items have been updated.` };
      }

      case "toggle_dynamic_installation": {
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ dynamic_installation: args.enabled })
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Dynamic installation has been ${args.enabled ? 'enabled' : 'disabled'}. ${args.enabled ? 'Your installation now uses a single auto-updating URL.' : 'You will now see manual code blocks for installation.'}` };
      }

      case "toggle_tips_bot": {
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ tips_bot_enabled: args.enabled })
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `Tips Bot has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "toggle_client_hub": {
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ client_hub_enabled: args.enabled })
          .eq("email", userEmail);
        if (error) throw error;
        return { success: true, message: `V2 Client Hub has been ${args.enabled ? 'enabled' : 'disabled'}.` };
      }

      case "get_education_videos": {
        const { data: customVideos } = await supabase
          .from("custom_onboarding_videos")
          .select("id, title")
          .in("agency_id", [userData.agency_id, userData.agency_id_advanced, userData.agency_id_elite].filter(Boolean));

        return {
          success: true,
          message: `Here are the education lessons a checklist step can open:\n\n` +
            formatEducationCatalog(customVideos || []),
        };
      }

      case "human_handover": {
        // The AI is paused for HANDOVER_PAUSE_HOURS by the caller once handover fires.
        // Workspace mode does not expose this tool; the request handler alerts there.
        const alert = await alertCopilotHumanHandover(
          supabase,
          userEmail,
          userData,
          String(args.last_message || args.reason || "User requested human support"),
          String(args.reason || "User requested human support"),
          handoverMemo,
        );
        const { data: existing, error: readError } = await supabase.from("copilot_ai_paused").select("paused_until").eq("owner_email", userEmail).maybeSingle();
        let paused = !readError && !!existing && (!existing.paused_until || new Date(existing.paused_until).getTime() > Date.now());
        if (!readError && !paused) {
          const { error } = await supabase.from("copilot_ai_paused").upsert({
            owner_email: userEmail, reason: "Human support requested", paused_by: "system:handover", source: "handover",
            paused_until: new Date(Date.now() + HANDOVER_PAUSE_HOURS * 3600 * 1000).toISOString(),
          }, { onConflict: "owner_email" });
          paused = !error;
          if (error) console.error("Copilot handover pause failed", error.message);
        }
        return handoverReply(alert, paused);
      }

      case "start_upgrade": {
        const target = String(args?.target_plan || "").trim().toLowerCase();
        if (!STRIPE_PRICE_IDS[target]) {
          return { success: false, message: "Choose basic, advanced, or enhanced (Premium Support)." };
        }
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) {
          return { success: false, message: "Stripe isn't configured — send this to the SaaSSuite team instead." };
        }
        const selected = UPGRADE_PLANS[target as UpgradePlan];
        if (accountRank(userData) >= selected.rank) return { success: false, message: "Your account already includes this tier. Manage billing in Settings > Billing if you want to change or downgrade it." };

        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const normEmail = String(userEmail).trim().toLowerCase();
          const customers = await stripe.customers.list({ email: normEmail, limit: 2 });
          if (customers.data.length > 1) return { success: false, message: "Multiple billing records match your email. Use Settings > Billing or text us to avoid duplicate charges." };
          const customer = customers.data[0];
          const priceLabel = `$${selected.price}/month`;
          if (target === "enhanced") {
            const prices = await stripe.prices.list({ lookup_keys: ["ss_premium_support_297_monthly"], active: true, limit: 1 });
            STRIPE_PRICE_IDS.enhanced = prices.data[0]?.id || selected.priceId;
          }

          if (customer) {
            const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
            const softwarePriceIds = new Set([...Object.values(STRIPE_PRICE_IDS), "price_1UJ0C2GdZ9PRE3ZiObuEAWzF", "price_1UJ0CHGdZ9PRE3ZiGBkh28XD", "price_1UJ0CYGdZ9PRE3ZirCTXUbRf", "price_1UNPAOGdZ9PRE3ZiQIH5kh8O"]);
            const sub = subs.data.find((s: Stripe.Subscription) => ["active", "trialing", "past_due", "unpaid"].includes(s.status) && s.items.data.some((i: Stripe.SubscriptionItem) => softwarePriceIds.has(i.price.id)));
            const item = sub?.items.data.find((i: Stripe.SubscriptionItem) => softwarePriceIds.has(i.price.id));
            if (!sub && subs.data.some((s: Stripe.Subscription) => ["active", "trialing", "past_due", "unpaid"].includes(s.status))) return { success: false, message: "You have an existing subscription we couldn't safely match. Use Settings > Billing or text us so we don't create duplicate charges." };
            if (sub && item) {
              const portal = await stripe.billingPortal.sessions.create({
                customer: customer.id,
                return_url: "https://saassuite.ai/copilot",
                flow_data: {
                  type: "subscription_update_confirm",
                  subscription_update_confirm: {
                    subscription: sub.id,
                    items: [{ id: item.id, price: STRIPE_PRICE_IDS[target], quantity: 1 }],
                  },
                  after_completion: { type: "redirect", redirect: { return_url: "https://saassuite.ai/copilot?confirmed=true" } },
                },
              });
              return {
                success: true,
                message: `Review ${selected.name} (${priceLabel}) in Stripe: ${portal.url}. Confirming charges immediately, prorated where applicable. Access changes only after payment confirmation.`,
                upgrade_url: portal.url,
              };
            }
          }

          const session = await stripe.checkout.sessions.create({
            customer: customer?.id,
            customer_email: customer ? undefined : normEmail,
            line_items: [{ price: STRIPE_PRICE_IDS[target], quantity: 1 }],
            mode: "subscription",
            allow_promotion_codes: true,
            success_url: "https://saassuite.ai/copilot?confirmed=true",
            cancel_url: "https://saassuite.ai/copilot",
            metadata: { plan: target, email: normEmail, source: "copilot_upgrade" },
          });
          await recordCheckoutSession({
            stripeCheckoutSessionId: session.id,
            email: normEmail,
            plan: target,
            billingInterval: billingIntervalForPlan(target),
            flow: "copilot",
            surface: "/copilot upgrade",
            page: "/copilot",
            button: "Upgrade",
            amountCents: selected.price * 100,
            currency: "usd",
            status: "open",
          });
          return {
            success: true,
            message: `Review ${selected.name} (${priceLabel}) in Stripe: ${session.url}. Payment is immediate on confirmation; access changes after successful payment.`,
            upgrade_url: session.url,
          };
        } catch (e) {
          console.error("start_upgrade error:", e);
          return {
            success: false,
            message: `I couldn't generate the upgrade link automatically. You can upgrade from Settings > Billing in the app, or in your Stripe portal: ${STRIPE_BILLING_PORTAL}`,
          };
        }
      }

      case "lookup_user": {
        const q = String(args?.query ?? "").trim();
        if (!q) return { success: false, message: "query required" };
        const agencyIds = [
          userData?.agency_id,
          userData?.agency_id_basic,
          userData?.agency_id_advanced,
          userData?.agency_id_elite,
        ].filter(Boolean);
        if (agencyIds.length === 0) return { success: false, message: "No agency configured yet." };
        const { data } = await supabase.from("user_progress")
          .select("name, email, agency_id, last_accessed, created_at")
          .in("agency_id", agencyIds)
          .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
          .order("last_accessed", { ascending: false, nullsFirst: false })
          .limit(5);
        return {
          success: true,
          message: `Found ${data?.length ?? 0} match(es) for "${q}"`,
          matches: data ?? [],
        };
      }

      case "account_health_summary": {
        const agencyIds = [
          userData?.agency_id,
          userData?.agency_id_basic,
          userData?.agency_id_advanced,
          userData?.agency_id_elite,
        ].filter(Boolean);
        if (agencyIds.length === 0) return { success: false, message: "No agency configured yet." };
        const iso7 = new Date(Date.now() - 7 * 86400000).toISOString();
        const iso30 = new Date(Date.now() - 30 * 86400000).toISOString();
        // Get emails for this agency so we can join into user_activity_sessions (no agency_id column there).
        const { data: agencyUsers } = await supabase
          .from("user_progress")
          .select("email, last_accessed, created_at")
          .in("agency_id", agencyIds);
        const emails = (agencyUsers ?? []).map((u: any) => String(u.email || "").toLowerCase()).filter(Boolean);
        const total = agencyUsers?.length ?? 0;
        const activeUsers7d = (agencyUsers ?? []).filter((u: any) => u.last_accessed && u.last_accessed >= iso7).length;
        const activeUsers30d = (agencyUsers ?? []).filter((u: any) => u.last_accessed && u.last_accessed >= iso30).length;
        // Real session activity in last 7d (distinct emails scoped to this agency).
        let distinctUsersWithSessions7d = 0;
        if (emails.length > 0) {
          const { data: sess } = await supabase
            .from("user_activity_sessions")
            .select("user_email")
            .in("user_email", emails)
            .gte("session_started_at", iso7);
          distinctUsersWithSessions7d = new Set((sess ?? []).map((s: any) => String(s.user_email || "").toLowerCase())).size;
        }
        const new_7d = (agencyUsers ?? []).filter((u: any) => u.created_at && u.created_at >= iso7).length;
        return {
          success: true,
          message: "Account health snapshot",
          total_users: total,
          active_users_7d: activeUsers7d,
          active_users_30d: activeUsers30d,
          distinct_users_with_sessions_7d: distinctUsersWithSessions7d,
          new_users_7d: new_7d,
        };
      }

      case "list_workflows": {
        const agencyIds = [
          userData?.agency_id,
          userData?.agency_id_basic,
          userData?.agency_id_advanced,
          userData?.agency_id_elite,
        ].filter(Boolean);
        if (agencyIds.length === 0) return { success: true, workflows: [], message: "No agency configured yet." };
        const { data } = await supabase.from("workflows")
          .select("trigger_type, enabled, webhook_url, agency_id")
          .in("agency_id", agencyIds);
        return {
          success: true,
          message: `${data?.length ?? 0} workflow(s) configured`,
          workflows: (data ?? []).map((w: any) => ({
            trigger_type: w.trigger_type,
            enabled: w.enabled,
            configured: !!w.webhook_url,
          })),
        };
      }

      case "configure_workflow": {
        const VALID_TRIGGERS = [
          "video_completed",
          "existing_user_login",
          "new_user_login",
          "onboarding_checklist_completed",
          "ai_support_engaged",
          "human_handover",
        ];
        const trigger = String(args?.trigger_type ?? "").trim();
        const webhookUrl = String(args?.webhook_url ?? "").trim();
        if (!VALID_TRIGGERS.includes(trigger)) {
          return { success: false, message: `Invalid trigger_type. Must be one of: ${VALID_TRIGGERS.join(", ")}` };
        }
        if (!/^https:\/\//i.test(webhookUrl) || !webhookUrl.includes("services.leadconnectorhq.com")) {
          return { success: false, message: "That doesn't look like a HighLevel inbound webhook URL. Ask the user for the URL containing services.leadconnectorhq.com — do not save anything else." };
        }
        if (String(userData?.plan ?? "").toUpperCase() !== "ADVANCED") {
          return { success: false, message: `Workflows require the Advanced ($97/mo) plan. This account is on ${userData?.plan || "STARTER"} — no workflow was saved. Offer start_upgrade to advanced.` };
        }
        const wfAgencyId = String(args?.plan_agency_id ?? "").trim() || userData?.agency_id || userData?.agency_id_advanced || userData?.agency_id_elite;
        if (!wfAgencyId) return { success: false, message: "No agency ID configured yet — no workflow was saved." };
        const { data: existingWf } = await supabase
          .from("workflows")
          .select("id")
          .eq("agency_id", wfAgencyId)
          .eq("trigger_type", trigger)
          .maybeSingle();
        const wfPayload = {
          agency_id: wfAgencyId,
          trigger_type: trigger,
          webhook_url: webhookUrl,
          enabled: args?.enabled === false ? false : true,
          updated_at: new Date().toISOString(),
        };
        const wfRes = existingWf?.id
          ? await supabase.from("workflows").update(wfPayload).eq("id", existingWf.id).select("id").maybeSingle()
          : await supabase.from("workflows").insert(wfPayload).select("id").maybeSingle();
        if (wfRes.error) {
          return { success: false, message: `Could not save the workflow: ${wfRes.error.message}. Nothing was configured — do not tell the user it worked.` };
        }
        return {
          success: true,
          message: `Workflow "${trigger}" saved and enabled for agency ${wfAgencyId} with the provided webhook. You may now call trigger_workflow to send a test payload.`,
        };
      }

      case "trigger_workflow": {
        const trigger = String(args?.trigger_type ?? "").trim();
        if (!trigger) return { success: false, message: "trigger_type required" };
        const agencyIdsForTrigger = [
          userData?.agency_id,
          userData?.agency_id_advanced,
          userData?.agency_id_elite,
        ].filter(Boolean) as string[];
        if (agencyIdsForTrigger.length === 0) return { success: false, message: "No agency configured yet." };
        // Only fire against an agency that actually has this workflow saved with a webhook.
        const { data: wfRows } = await supabase
          .from("workflows")
          .select("agency_id, webhook_url, enabled")
          .in("agency_id", agencyIdsForTrigger)
          .eq("trigger_type", trigger);
        const ready = (wfRows ?? []).find((w: any) => !!w.webhook_url);
        if (!ready) {
          return {
            success: false,
            message: `No workflow is configured for "${trigger}" on this account, so NOTHING was sent. Ask the user for their HighLevel inbound webhook URL and call configure_workflow first. Do not tell the user a test fired.`,
          };
        }
        if (ready.enabled === false) {
          return { success: false, message: `The "${trigger}" workflow exists but is disabled, so nothing was sent. Call configure_workflow with enabled=true first.` };
        }
        const agencyId = ready.agency_id;
        try {
          const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-workflow`;
          const res = await fetch(dispatchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agency_id: agencyId,
              trigger_type: trigger,
              user_email: args?.target_email || null,
              metadata: { source: "AI CoPilot manual trigger" },
            }),
          });
          const body = await res.json().catch(() => ({}));
          // dispatch-workflow returns ok:true with a `skipped` reason when it
          // does nothing. That is NOT a success — surface it as a failure so the
          // model never claims a payload was delivered.
          if (res.ok && body?.skipped) {
            return {
              success: false,
              message: `Nothing was sent — the dispatcher skipped it: "${body.skipped}". Do not tell the user the test fired. ${body.skipped === "not on ADVANCED plan" ? "Workflows need the Advanced plan." : "Resolve the reason first."}`,
              details: body,
            };
          }
          return {
            success: res.ok,
            message: res.ok ? `Test payload delivered for ${trigger}` : `Failed: ${body?.error || res.status}`,
            details: body,
          };

        } catch (e: any) {
          return { success: false, message: `Failed to dispatch: ${e?.message ?? e}` };
        }
      }

      case "diagnose_install": {
        const requested = String(args?.plan_agency_id ?? "").trim();
        const idsToCheck = requested
          ? [requested]
          : [userData?.agency_id, userData?.agency_id_advanced, userData?.agency_id_elite].filter(Boolean);
        if (idsToCheck.length === 0) {
          return { success: false, message: "No agency ID configured yet. Create a hub URL first." };
        }
        const ownerEmails = await ownerEmailsForAccount(supabase, userData);
        const results: any[] = [];
        for (const id of idsToCheck) {
          const { js: jsUrl, css: cssUrl } = dynamicAssetUrls(id);
          const [jsRes, cssRes, seats] = await Promise.all([
            fetch(jsUrl).catch((e) => ({ ok: false, status: 0, _err: String(e) } as any)),
            fetch(cssUrl).catch((e) => ({ ok: false, status: 0, _err: String(e) } as any)),
            hubUsersForAgency(supabase, userData, id, ownerEmails),
          ]);
          const jsText = jsRes.ok ? await (jsRes as Response).text().catch(() => "") : "";
          const cssText = cssRes.ok ? await (cssRes as Response).text().catch(() => "") : "";
          results.push({
            agency_id: id,
            hub: hubLabelForAgency(userData, id),
            plan_slot: hubLabelForAgency(userData, id),
            js_url: jsUrl,
            js_status: (jsRes as any).status,
            js_ok: (jsRes as any).ok,
            js_length: jsText.length,
            js_looks_valid: /agency|saas|dynamic|script/i.test(jsText) || jsText.length > 100,
            css_url: cssUrl,
            css_status: (cssRes as any).status,
            css_ok: (cssRes as any).ok,
            css_length: cssText.length,
            has_generated_css: !!userData?.generated_css,
            primary_color: userData?.primary_color || null,
            user_limit: { limit: seats.limit, used: seats.used, at_user_limit: seats.at_user_limit },
            cause: seats.cause,
          });
        }
        const summaryLines = results.map((r) => {
          const jsMark = r.js_ok && r.js_looks_valid ? "OK" : `FAIL (${r.js_status})`;
          const cssMark = r.css_ok ? "OK" : `FAIL (${r.css_status})`;
          const limitMark = r.cause === "at user limit"
            ? ` — at user limit (${r.user_limit.used}/${r.user_limit.limit}). Say the hub is at its plan's user limit. Do NOT say the email was not added.`
            : "";
          return `- ${r.hub} — ${r.agency_id}: JS ${jsMark}, CSS ${cssMark} (${r.css_length} bytes)${limitMark}`;
        }).join("\n");
        const planName = subscriptionPlanName(userData?.plan, userData?.premium_support);
        return {
          success: true,
          message: `Install diagnostic (SERVER SIDE ONLY) for ${planName}:\n${summaryLines}\n\nIMPORTANT: "OK" only means our dynamic-styles endpoint is serving code for that agency ID. It does NOT prove the code is installed in HighLevel and it does NOT prove the browser is loading it. If a result says "at user limit", that is why a client cannot enter — do not say their email was not added. If nothing changed visually, the browser installation is unverified; do not declare it missing or wrong without browser evidence. Have them confirm, at the AGENCY level, HighLevel > Settings > Company > White Label (Custom CSS / Custom JS boxes): the <link ... type=css> line in Custom CSS and the <script ... type=js> line in Custom JS. Do NOT tell them Business Profile — that is the wrong screen. After one failed refresh attempt, hand over to a human instead of adding more CSS.`,
          plan_name: planName,
          results,
        };
      }


      case "test_support_webhook": {
        const url = String(userData?.support_webhook_url ?? "").trim();
        if (!url) {
          return { success: false, message: "No support webhook URL is configured on this account." };
        }
        try {
          const payload = {
            test: true,
            source: "SaaSSuite CoPilot diagnostic probe",
            sent_at: new Date().toISOString(),
            account_email: userEmail,
            agency_id: userData?.agency_id || null,
          };
          const started = Date.now();
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const elapsed = Date.now() - started;
          const bodyText = await res.text().catch(() => "");
          const snippet = bodyText.slice(0, 200);
          return {
            success: res.ok,
            message: res.ok
              ? `Webhook responded ${res.status} in ${elapsed}ms. The URL is live and accepting POSTs — if end-user tickets still say "Submission failed," the issue is inside the receiving automation (Zapier task turned off, filter step rejecting the payload, etc.).`
              : `Webhook returned ${res.status} in ${elapsed}ms. The receiving endpoint is either offline, rejecting the request, or the URL is stale. Ask the user to regenerate the webhook URL and paste the new one.`,
            status: res.status,
            elapsed_ms: elapsed,
            body_snippet: snippet,
          };
        } catch (e: any) {
          return {
            success: false,
            message: `Webhook probe failed to connect: ${e?.message ?? e}. The URL is unreachable — ask the user to regenerate it in Zapier/Make and paste the new one.`,
          };
        }
      }

      case "add_client_hub_user": {
        const email = String(args?.email ?? "").trim().toLowerCase();
        const name = args?.name ? String(args.name).trim() : null;
        const slot = String(args?.plan_slot ?? "basic").toLowerCase();
        const hub = hubLabelForSlot(slot);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { success: false, message: "Please provide a valid email address for the client." };
        }
        const agencyId =
          slot === "advanced" ? userData?.agency_id_advanced :
          slot === "elite" ? userData?.agency_id_elite :
          userData?.agency_id;
        if (!agencyId) {
          return { success: false, message: `No agency ID is set up for ${hub} yet. Create the hub URL first.` };
        }
        try {
          const { data, error } = await supabase.rpc("update_user_agency_assignment_with_name", {
            agency_id: agencyId,
            user_email: email,
            user_name: name,
          });
          if (error) {
            console.error("add_client_hub_user rpc error:", error);
            return { success: false, message: `Failed to add the user: ${error.message}` };
          }
          if (data === false) {
            return {
              success: false,
              message: `Could not add ${email} — ${hub} is at its user limit. Upgrade the subscription or remove an inactive user first.`,
              at_capacity: true,
            };
          }
          return {
            success: true,
            message: `Added ${email}${name ? ` (${name})` : ""} to ${hub} (agency ${agencyId}). They can log in right away.`,
          };
        } catch (e: any) {
          return { success: false, message: `Failed to add the user: ${e?.message ?? e}` };
        }
      }

      case "refresh_plan_limits": {
        // Re-read the current user row to catch a fresh Stripe upgrade,
        // then check capacity for each configured agency ID.
        const { data: fresh } = await supabase
          .from("saas_suite_users")
          .select("plan, premium_support, agency_id, agency_id_advanced, agency_id_elite")
          .eq("email", userEmail)
          .maybeSingle();
        const plan = fresh?.plan ?? userData?.plan ?? null;
        const planName = subscriptionPlanName(plan, fresh?.premium_support ?? userData?.premium_support);
        const account = fresh || userData;
        const slots = [
          { slot: "Hub 1", id: account?.agency_id },
          { slot: "Hub 2", id: account?.agency_id_advanced },
          { slot: "Hub 3", id: account?.agency_id_elite },
        ].filter((s) => !!s.id);
        const ownerEmails = await ownerEmailsForAccount(supabase, { ...userData, ...account, email: userData?.email });
        const capacities: any[] = [];
        for (const s of slots) {
          const seats = await hubUsersForAgency(supabase, userData, s.id, ownerEmails);
          capacities.push({
            slot: s.slot,
            agency_id: s.id,
            current_users: seats.used,
            max_users: seats.limit,
            at_capacity: seats.at_user_limit,
          });
        }
        const lines = capacities.map((c) =>
          `- ${c.slot} (${c.agency_id}): ${c.current_users ?? "?"} / ${c.max_users ?? "unlimited"}${c.at_capacity ? " — AT LIMIT" : ""}`
        ).join("\n");
        return {
          success: true,
          message: `Fresh account snapshot:\n- Plan: ${planName}\n${lines || "- No hub IDs configured yet."}\n\nIf this doesn't match what you expect (e.g. you just upgraded on Stripe), it usually means the Stripe webhook is still catching up — give it 1–2 minutes and re-run this check.`,
          plan,
          plan_name: planName,
          capacities,
        };
      }

      case "list_client_hub_users": {
        const requested = String(args?.plan_agency_id ?? "").trim();
        const slots = [
          { hub: "Hub 1", id: userData?.agency_id },
          { hub: "Hub 2", id: userData?.agency_id_advanced },
          { hub: "Hub 3", id: userData?.agency_id_elite },
        ].filter((slot) => slot.id && (!requested || slot.id === requested));
        if (slots.length === 0) {
          return { success: false, message: "No hub is configured yet, so there are no client hub users to list." };
        }
        const ownerEmails = await ownerEmailsForAccount(supabase, userData);
        const hubs = [];
        for (const slot of slots) {
          const seats = await hubUsersForAgency(supabase, userData, slot.id, ownerEmails);
          hubs.push({
            hub: slot.hub,
            agency_id: slot.id,
            plan_limit: seats.limit,
            used: seats.used,
            at_user_limit: seats.at_user_limit,
            cause: seats.cause,
            users: seats.users,
          });
        }
        const planName = subscriptionPlanName(userData?.plan, userData?.premium_support);
        const lines = hubs.map((hub) => {
          const cap = hub.plan_limit == null ? "unlimited" : `${hub.used} of ${hub.plan_limit}`;
          const people = hub.users.length
            ? hub.users.map((user: any) => `  - ${user.email || "(no email on file)"}${user.name ? ` (${user.name})` : ""} — first seen ${user.first_seen || "unknown"} — ${user.counts_toward_limit ? "counts toward the limit" : "does not count (owner, admin, or preview/test)"}`).join("\n")
            : "  - No non-guest users.";
          return `${hub.hub} (${hub.agency_id}): ${cap}${hub.at_user_limit ? " — at user limit" : ""}\n${people}`;
        }).join("\n");
        return {
          success: true,
          message: `Real client hub users on ${planName}. Use only these emails. Do not invent any other address.\n${lines}`,
          plan_name: planName,
          hubs,
        };
      }

      case "initiate_account_deletion": {
        return { success: false, message: "I cannot delete your account or file a deletion request. Open Settings > Profile > Delete Account to confirm self-service deletion. Billing cancellation is separate." };
      }

      case "set_kb_logo": {
        if (!args.url || !/^https:\/\//i.test(args.url)) {
          return { success: false, message: "I need a direct https:// image URL for the logo." };
        }
        const { error } = await supabase
          .from("saas_suite_users")
          .update({ kb_logo_url: args.url })
          .eq("email", userEmail);
        if (error) return { success: false, message: `Failed to update KB logo: ${error.message}` };
        return { success: true, message: `Knowledge Base logo updated. It may take a moment to appear after a refresh.` };
      }

      case "update_custom_css": {
        const css = String(args.css || "").trim();
        if (!css) return { success: false, message: "No CSS provided." };
        // Menu link position, visibility per sub-account, and install problems are
        // HighLevel settings — CSS cannot fix them. Refuse so the AI sends the user to GHL.
        const intent = `${css} ${String(args.note || "")}`.toLowerCase();
        if (/(order\s*:|menu.?link|custom.?link|sb_custom|saassuite.?link|move.*(top|bottom)|reorder|position.*(menu|sidebar|nav))/.test(intent)) {
          return {
            success: false,
            message: "NOT DONE. Moving, reordering, or showing/hiding the custom menu link is a HighLevel setting, not CSS. Tell the user to do it in HighLevel: Agency Settings > Custom Menu Links (edit the link: set 'Show on' to all sub-accounts or the right ones, and drag it to the desired position), save, then hard refresh. Also confirm the Custom CSS/JS in Agency Settings > Company > White Label use their own agency ID. Do NOT claim any change was made.",
          };
        }
        const impossible = impossibleCssReason(css, String(args.note || ""));
        if (impossible) return { success: false, message: impossibleCssMessage(impossible) };
        const mode = args.mode === "replace" ? "replace" : "append";
        const note = String(args.note || "custom tweak").slice(0, 120);
        const existing = userData?.generated_css || "";
        const block = `\n\n/* CoPilot: ${note} — ${new Date().toISOString().slice(0, 10)} */\n${css}\n`;
        const next = mode === "replace" ? css : existing + block;
        const { data: updated, error } = await supabase
          .from("saas_suite_users")
          .update({ generated_css: next })
          .ilike("email", String(userEmail || "").trim().toLowerCase())
          .select("id");
        if (error) return { success: false, message: `Failed to update CSS: ${error.message}` };
        if (!updated?.length) return { success: false, message: "NOT DONE. No account row was updated, so nothing changed. Do not claim the CSS was saved." };
        return {
          success: true,
          message: `CSS ${mode === "replace" ? "replaced" : "appended"} (${css.length} chars). This is saved on our side only — it will only be visible if their White Label Custom CSS link (Settings > Company > White Label) is installed and loading. If the user already reported two rounds of "nothing changed", stop adding CSS and verify that install / hand over to a human.`,
        };
      }

      case "diagnose_menu_link_removal": {
        const agencyId = String(args.plan_agency_id || userData?.agency_id || "").trim();
        const ownedIds = [userData?.agency_id, userData?.agency_id_basic, userData?.agency_id_advanced, userData?.agency_id_elite];
        if (!agencyId || !ownedIds.includes(agencyId)) return { success: false, message: "Choose an agency ID belonging to this account." };
        const { data: rules, error } = await supabase.from("menu_link_rules")
          .select("id, sub_account_id, hidden_links, is_active, updated_at").eq("agency_id", agencyId);
        if (error) return { success: false, message: "Rule lookup failed; saved rules are unknown. Nothing was changed." };
        const urls = dynamicAssetUrls(agencyId);
        const readAsset = async (url: string) => {
          try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); return { ok: r.ok, status: r.status, body: await r.text() }; }
          catch { return { ok: false, status: 0, body: "" }; }
        };
        const [js, css] = await Promise.all([readAsset(urls.js), readAsset(urls.css)]);
        const diagnostic = menuDiagnostic(rules || [], String(args.sub_account_id || ""), js, css);
        return { success: js.ok && css.ok, ...diagnostic, urls,
          message: `${diagnostic.message} Active applicable rules: ${diagnostic.activeRules}. Checks: ${JSON.stringify(diagnostic.checks)}` };

      }

      case "search_support_conversations": {
        const ids = [userData?.agency_id, userData?.agency_id_basic, userData?.agency_id_advanced, userData?.agency_id_elite].filter(Boolean);
        if (!ids.length) return { success: false, message: "No agency configured yet." };
        const raw = String(args?.query ?? "").trim();
        const q = raw.replace(/[,()%*\\]/g, " ").trim();
        const kind = args?.kind || "all";
        const out: any = { success: true, query: raw };
        const snip = (t: any) => String(t ?? "").slice(0, 240);
        // Map names -> emails via client hub users
        let personEmails: string[] = [];
        if (q) {
          const { data: people } = await supabase.from("user_progress").select("name,email")
            .in("agency_id", ids).or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(20);
          personEmails = (people ?? []).map((p: any) => String(p.email || "").toLowerCase()).filter(Boolean);
          out.matching_people = people ?? [];
        }
        if (kind !== "chats") {
          let tq = supabase.from("support_tickets")
            .select("id,ticket_number,agency_id,customer_name,customer_email,issue_category,status,request_text,admin_response,assigned_to,created_at,updated_at")
            .in("agency_id", ids).order("updated_at", { ascending: false }).limit(15);
          if (q) {
            const ors = [`customer_name.ilike.%${q}%`, `customer_email.ilike.%${q}%`, `request_text.ilike.%${q}%`, `admin_response.ilike.%${q}%`, `issue_category.ilike.%${q}%`];
            if (/^#?\d+$/.test(q)) ors.push(`ticket_number.eq.${q.replace("#", "")}`);
            tq = tq.or(ors.join(","));
          }
          const { data: tickets } = await tq;
          let list = tickets ?? [];
          if (q) {
            const { data: allT } = await supabase.from("support_tickets").select("id").in("agency_id", ids).limit(1000);
            const tIds = (allT ?? []).map((t: any) => t.id);
            if (tIds.length) {
              const { data: reps } = await supabase.from("support_ticket_replies").select("ticket_id").in("ticket_id", tIds).ilike("body", `%${q}%`).limit(20);
              const extra = [...new Set((reps ?? []).map((r: any) => r.ticket_id))].filter((id) => !list.some((t: any) => t.id === id));
              if (extra.length) {
                const { data: more } = await supabase.from("support_tickets")
                  .select("id,ticket_number,agency_id,customer_name,customer_email,issue_category,status,request_text,admin_response,assigned_to,created_at,updated_at").in("id", extra);
                list = list.concat(more ?? []);
              }
            }
          }
          out.tickets = list.map((t: any) => ({ ...t, request_text: snip(t.request_text), admin_response: snip(t.admin_response) }));
        }
        if (kind !== "tickets") {
          const idents = new Set<string>(personEmails);
          if (q) {
            const [{ data: a }, { data: b }] = await Promise.all([
              supabase.from("ai_chat_messages").select("user_identifier").in("agency_id", ids)
                .or(`user_identifier.ilike.%${q}%,content.ilike.%${q}%`).order("created_at", { ascending: false }).limit(200),
              supabase.from("agency_owner_messages").select("user_identifier").in("agency_id", ids)
                .or(`user_identifier.ilike.%${q}%,content.ilike.%${q}%`).order("created_at", { ascending: false }).limit(200),
            ]);
            for (const r of [...(a ?? []), ...(b ?? [])]) if (r.user_identifier) idents.add(String(r.user_identifier));
          }
          let cq = supabase.from("chat_threads")
            .select("agency_id,user_identifier,message_count,last_user_message_at,last_owner_message_at,handover_requested_at,handover_resolved_at,assigned_to_name,assigned_to_email,updated_at")
            .in("agency_id", ids).order("updated_at", { ascending: false }).limit(15);
          if (q) {
            if (!idents.size) { out.chats = []; } else cq = cq.in("user_identifier", [...idents].slice(0, 100));
          }
          if (!out.chats) {
            const { data: threads } = await cq;
            out.chats = threads ?? [];
            // threads may be missing for older chats — add bare identifiers
            for (const id of idents) if (!out.chats.some((t: any) => t.user_identifier === id)) out.chats.push({ user_identifier: id });
          }
        }
        out.message = `Found ${out.tickets?.length ?? 0} ticket(s) and ${out.chats?.length ?? 0} chat(s). Use get_support_conversation to read one.`;
        return out;
      }

      case "get_support_conversation": {
        const ids = [userData?.agency_id, userData?.agency_id_basic, userData?.agency_id_advanced, userData?.agency_id_elite].filter(Boolean);
        if (!ids.length) return { success: false, message: "No agency configured yet." };
        if (args?.ticket_number || args?.ticket_id) {
          let tq = supabase.from("support_tickets").select("*").in("agency_id", ids);
          tq = args.ticket_id ? tq.eq("id", args.ticket_id) : tq.eq("ticket_number", Number(args.ticket_number));
          const { data: t } = await tq.maybeSingle();
          if (!t) return { success: false, message: "Ticket not found for this agency." };
          const { data: replies } = await supabase.from("support_ticket_replies")
            .select("sender_role,sender_name,sender_email,body,created_at").eq("ticket_id", t.id).order("created_at").order("id");
          return { success: true, ticket: {
            ticket_number: t.ticket_number, status: t.status, customer_name: t.customer_name, customer_email: t.customer_email,
            category: t.issue_category, created_at: t.created_at, request_text: t.request_text, admin_response: t.admin_response,
            responded_by: t.responded_by_name || t.responded_by, assigned_to: t.assigned_to, recording_url: t.recording_url,
          }, replies: replies ?? [] };
        }
        const ident = String(args?.user_identifier ?? "").trim();
        if (!ident) return { success: false, message: "Provide ticket_number, ticket_id, or user_identifier." };
        const [{ data: ai }, { data: team }, { data: thread }] = await Promise.all([
          supabase.from("ai_chat_messages").select("role,content,created_at,agency_id").in("agency_id", ids).eq("user_identifier", ident).order("created_at", { ascending: false }).limit(80),
          supabase.from("agency_owner_messages").select("sender_type,sender_name,content,created_at").in("agency_id", ids).eq("user_identifier", ident).order("created_at", { ascending: false }).limit(80),
          supabase.from("chat_threads").select("assigned_to_name,assigned_to_email,handover_requested_at,handover_resolved_at,message_count").in("agency_id", ids).eq("user_identifier", ident).maybeSingle(),
        ]);
        const msgs = [
          ...(ai ?? []).map((m: any) => ({ from: m.role === "user" ? "client" : "ai", text: String(m.content ?? "").slice(0, 1500), at: m.created_at })),
          ...(team ?? []).map((m: any) => ({ from: m.sender_type === "owner" ? `team${m.sender_name ? ` (${m.sender_name})` : ""}` : m.sender_type, text: String(m.content ?? "").slice(0, 1500), at: m.created_at })),
        ].sort((a, b) => String(a.at).localeCompare(String(b.at)));
        if (!msgs.length) return { success: false, message: `No chat found for "${ident}" in this agency.` };
        return { success: true, user_identifier: ident, thread: thread ?? null, note: "Most recent 80 messages per source, oldest first.", messages: msgs };
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { success: false, message: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function extractTextContent(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") return part.text;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value?.content === "string") return value.content;
  if (typeof value?.text === "string") return value.text;
  return "";
}

// Full-screen /copilot workspace: chat-first onboarding with in-chat widgets.
function buildWorkspacePrompt(ws: any): string {
  const w = ws && typeof ws === "object" ? ws : {};
  const name = String(w.assistantName || "Copilot").slice(0, 40);
  const stage = String(w.stage || "chat").slice(0, 40);
  return `

## WORKSPACE MODE (full-screen /copilot) — overrides earlier formatting rules
Your name is **${name}**. Speak as ${name}. You are the owner's SaaS personal assistant inside SaaSSuite.
Live UI state (verify permissions and saved settings against server account context/tool results): stage=${stage}; HighLevel connected=${!!w.ghlConnected}; HighLevel skipped=${!!w.ghlSkipped}; Slack connected=${!!w.slackConnected}; menu link installed=${!!w.menuLinkInstalled}; installation skipped=${!!w.installationSkipped}; plan=${String(w.plan || "unknown")}; agency_id=${String(w.agencyId || "unknown")}; client users=${Number(w.userCount ?? 0)}.
Skip completed authorization/installation immediately.
### Existing-account awareness (most important)
- This state is the source of truth for what's done. If HighLevel connected=true, NEVER show [[widget:ghl_connect]] or ask them to connect. If menu link installed=true, NEVER show [[widget:menu_link]], never ask them to install or reinstall the menu link, and treat that prerequisite as met for every feature (including menu link removal) — at most confirm "I can see your menu link is already installed."
- If client users > 0 or HighLevel and the menu link are already set up, this is an existing account, not a brand-new user: skip the brand-new onboarding script and go straight to what they asked about, using their current settings.
- If the user's message doesn't match the step you asked about, answer their message normally instead of forcing the step. A saved menu link is not proof CSS/JS are installed: ask only about unfinished steps; offer Skip for now. Never demand Slack to continue. Explicitly skipped setup allows education and planning but does not grant installation or bypass tool permissions.

### Human help (text only)
- For booking/success call requests, immediately provide https://saassuite.ai/book in your first answer. The Book a call control is always available; never delay the link behind a second request.
- Human help is available by text. Requests for a person immediately call human_handover and stop AI replies. Report only server-confirmed delivery/pause status, never an assigned human or promised reply. [[widget:human_help]] opens direct text support.

### Accuracy rules (most important)
- Originating page (navigation hint only): ${copilotSourcePath(w.sourcePage) || "not supplied"}. Use it to understand what the owner was working on, not as proof of completed work.
- Use recent recorded activity and saved account settings to proactively suggest ONE relevant next step. A visit/video play is not proof setup is complete; no recent records means activity is unknown, not that nothing happened. Do not repeat completed steps, overwhelm with a full checklist, or make unsolicited changes.
- Never claim something was saved, installed, connected or changed unless a tool result in THIS turn says success. If a tool fails, say what failed and that nothing changed.
- Never guess settings — read the injected account context. If you don't know, say so and offer a human.
- Installation (menu link, CSS/JS) happens in HighLevel on desktop. You can only create the menu link via the menu-link widget when HighLevel is connected.

### Message format
- Send short chat messages. To send SEPARATE messages, put a line containing only \`---\` between them (2–3 messages max per turn).
- Interactive widgets: put the token on its own line at the end of a message. Available tokens:
  - \`[[choices: Option A | Option B | Option C]]\` quick-reply buttons (≤4, short labels).
  - \`[[multi: Item 1 | Item 2 | Item 3]]\` a checklist the user can tick then submit.
  - \`[[widget:ghl_connect]]\` secure HighLevel token + Location ID form (never ask them to paste a token in chat).
  - \`[[widget:slack_connect]]\` Slack authorize card.
  - \`[[widget:menu_link]]\` menu link installer: icon, name, and who sees it (everyone, or picked sub-accounts). Only when HighLevel is connected.
  - \`[[widget:videos]]\` list of education videos to pick from for the onboarding checklist.
  - \`[[widget:menu_removal_setup]]\` one-step-at-a-time menu-removal walkthrough with Back/Next controls, automatically selected menu ID and only the current step’s screenshot/resources. Never emit all screenshots or all setup instructions in one response. Always provide this when discussing menu-removal installation; never send them elsewhere in SaaSSuite to find these resources.
- Never paste raw tokens/secrets. Never output a widget token inside a sentence.

${CONNECT_RELEVANCE_POLICY}
${loginTrackingGuidance(accountRank({ plan: String(w.plan || "") }))}

### First-time onboarding flow (stage=onboarding). Do ONE step at a time, in order, skipping what's done:
${SETUP_ORDER_POLICY}
Next unfinished setup step from UI observations: ${nextSetupStep(!!w.ghlConnected, !!w.menuLinkInstalled, false, !!w.installationSkipped || !!w.ghlSkipped)}. Verify against server context; CSS/JS completion is unknown until checked or confirmed.
1. HighLevel: if not connected and not skipped, show [[widget:ghl_connect]]. If skipped, continue education and remind occasionally.
2. Menu link: if connected and not installed, show [[widget:menu_link]]. Do not ask for the URL; use their saved agency URL.
3. CSS/JS: call get_plan_urls for exact codes and guide desktop installation. Only then ask missing business identity if relevant, using set_business_identity. Keep existing agency IDs when users already have access.
4. Client hub welcome: ask: "Welcome to <business name>" — is that right? with [[choices: Yes, that's fine | No, I want something else]]. Save with update_welcome_text.
5. Onboarding: ask about their business, their onboarding, and what customers should do after login. Suggest profile steps (add a card, connect their domain, etc.). Then ask "What else do you want to teach them?" with [[widget:videos]] (call get_education_videos first if needed). Then write "Building your onboarding checklist..." in its own message and call set_checklist_items with the full list (profile steps + picked videos + their own steps). Only report it built after success, and summarize the steps.
6. Support: ask how they want customers supported — note options are plan-specific (Starter/Basic/Advanced). Ask about AI support: any preferences, or the default setup [[choices: Use the default | I have preferences]]. Use update_support_settings / toggle_ai_chat / update_ai_config.
7. Other features: briefly explain branding tool, menu link removal, login tracking, help widget — plan-aware — and offer to set up any.
After that, act as the ongoing Copilot for support and setup.
The priority-led policy below replaces steps 4–7 above; do not follow those as a mandatory sequence:
${PRIORITY_POLICY}
${copilotFocusPolicy(w.focus)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userEmail: suppliedEmail, client, attachments, mode, workspace, action, target_plan, requestHuman, lastMessage, page, humanOnly } = await req.json();
    const userEmail = String(suppliedEmail || "").trim().toLowerCase();
    const isOnboardingMode = mode === "onboarding";
    const isWorkspaceMode = mode === "workspace";
    
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "User email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Account service unavailable");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const handoverMemo: HandoverMemo = { sent: false };
    let copilotPermissions: Record<string, string> | null = null;
    let assignedOnly = false;
    const internalCall = req.headers.get("Authorization") === `Bearer ${supabaseServiceKey}`;
    if (!internalCall) {
      const auth = await requireAuthedUser(req);
      const refusedText = lastUserMessageText(messages) || (typeof lastMessage === "string" ? lastMessage : "");
      const refusedPage = failurePage(page) || copilotSourcePath(workspace?.sourcePage) || failurePage(req.headers.get("referer")) || "";
      const refusedAgency = typeof workspace?.agencyId === "string" ? workspace.agencyId : null;
      if (!auth.ok) {
        await logAuthRefusal(supabase, {
          status: 401,
          userEmail,
          authorization: req.headers.get("Authorization"),
          page: refusedPage,
          message: refusedText,
          agencyId: refusedAgency,
        });
        return new Response(JSON.stringify({ error: "Please sign in again." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (auth.email !== userEmail && !isPlatformAdminEmail(auth.email)) {
        const { data: admin } = await supabase.from("account_admins").select("permissions, restrict_assigned_chats, restrict_assigned_tickets").ilike("owner_email", userEmail).ilike("admin_email", auth.email).eq("status", "accepted").maybeSingle();
        if (!admin) {
          await logAuthRefusal(supabase, {
            status: 403,
            userEmail: auth.email || userEmail,
            authorization: req.headers.get("Authorization"),
            page: refusedPage,
            message: refusedText,
            agencyId: refusedAgency,
          });
          return new Response(JSON.stringify({ error: "You don't have access to this account." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        copilotPermissions = admin.permissions || {};
        assignedOnly = !!(admin.restrict_assigned_chats || admin.restrict_assigned_tickets);
      }
    }
    if (action === "handover_status") {
      const { data, error } = await supabase.from("copilot_ai_paused").select("paused_until").eq("owner_email", userEmail).maybeSingle();
      if (error) return new Response(JSON.stringify({ error: "Unable to check support status." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ handover: !!data && (!data.paused_until || new Date(data.paused_until).getTime() > Date.now()) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Direct "Request a human" from Help. Does not depend on the model calling the tool.
    if (requestHuman === true) {
      const { data: account } = await supabase.from("saas_suite_users").select("*").eq("email", userEmail).maybeSingle();
      if (account) account._copilotPermissions = copilotPermissions;
      const result = await executeTool(
        "human_handover",
        {
          last_message: typeof lastMessage === "string" && lastMessage.trim() ? lastMessage.slice(0, 2000) : "User requested a person from Help",
          reason: "Request a human",
        },
        supabase,
        userEmail,
        account,
        handoverMemo,
      );
      await persistCopilotMessage(supabase, { owner_email: userEmail, role: "user", content: `Human support requested: ${lastMessage || "Request a human"}` }, { stage: "user_message_insert", user: userEmail, content: "Request a human" });
      await persistCopilotMessage(supabase, { owner_email: userEmail, role: "assistant", content: result.message }, { stage: "assistant_message_insert", user: userEmail, content: result.message });
      return new Response(JSON.stringify({ content: result.message, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "snapshot_link") {
      const { data: account } = await supabase.from("saas_suite_users").select("plan, snapshot_access, premium_support, approval, trial_source, landing_page, checkout_page, referrer, source").ilike("email", userEmail).maybeSingle();
      const { data: kitRows, error: kitError } = await supabase.from("kit_purchases").select("line_id").eq("email", userEmail);
      const purchased = !kitError && Array.isArray(kitRows) ? kitRows.map((row) => row.line_id) : [];
      const kitPurchased = hasFullKitAccess(purchased, account);
      const entitled = snapshotEntitled(account, { kitPurchased });
      return new Response(JSON.stringify({ url: entitled ? STANDARD_SNAPSHOT_URL : null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!Array.isArray(messages) || messages.length > 100 || messages.some((m) => !m || !["user", "assistant"].includes(m.role) || (typeof m.content !== "string" && !Array.isArray(m.content))) || (action && action !== "upgrade")) return new Response(JSON.stringify({ error: "Invalid chat request." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (action === "upgrade") {
      if (!Object.hasOwn(UPGRADE_PLANS, String(target_plan))) return new Response(JSON.stringify({ error: "Choose Basic, Advanced or Premium Support." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: account } = await supabase.from("saas_suite_users").select("*").eq("email", userEmail).maybeSingle();
      if (!account) return new Response(JSON.stringify({ error: "Account not found." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      account._copilotPermissions = copilotPermissions;
      const result = await executeTool("start_upgrade", { target_plan }, supabase, userEmail, account);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Kill switch: if the AI is paused for this account, persist the user's
    // message so the team sees it, but never generate an AI reply.
    const normalizedEmail = String(userEmail).trim().toLowerCase();
    const { data: pausedRow, error: pauseReadError } = await supabase
      .from("copilot_ai_paused")
      .select("owner_email, paused_until")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (pauseReadError) return new Response(JSON.stringify({ error: "Unable to check human-support status. Please try again or text our team." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const lastUserText = (() => {
      const m = messages[messages.length - 1];
      if (!m || m.role !== "user") return "";
      return extractTextContent(m.content);
    })();

    // A pause with a paused_until in the past has expired — clear it and continue.
    let pauseActive = !!pausedRow;
    if (pausedRow?.paused_until && new Date(pausedRow.paused_until).getTime() <= Date.now()) {
      pauseActive = false;
      await supabase.from("copilot_ai_paused").delete().eq("owner_email", normalizedEmail);
    }

    // The user can always pull the AI back in manually — but only when the pause
    // came from a handover (timed). Manual kill switches (paused_until NULL) stay on.
    if (pauseActive && pausedRow?.paused_until && isAiResumeRequest(lastUserText)) {
      pauseActive = false;
      await supabase.from("copilot_ai_paused").delete().eq("owner_email", normalizedEmail);
      console.log("AI resumed by user request:", normalizedEmail);
    }

    if (pauseActive || humanOnly === true) {
      if (lastUserText) {
        await persistCopilotMessage(supabase, {
          owner_email: userEmail,
          role: "user",
          content: lastUserText,
          attachments: Array.isArray(attachments) && attachments.length ? attachments : null,
        }, { stage: "user_message_insert", user: userEmail, content: lastUserText });
      }
      return new Response(
        JSON.stringify({
          content: pausedRow?.paused_until
            ? "AI replies are paused for human support. Your message is saved. No assigned person or response time is confirmed. Say \"turn the AI copilot back on\" to resume AI."
            : "AI replies are paused. Your message is saved for support; no assigned person or response time is confirmed.",
          actions: [],
          handover: true,
          quiet: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persist the latest user message (last item in messages array)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "user" && typeof lastMsg.content === "string") {
      await persistCopilotMessage(supabase, {
        owner_email: userEmail,
        role: "user",
        content: lastMsg.content,
        attachments: Array.isArray(attachments) && attachments.length ? attachments : null,
      }, { stage: "user_message_insert", user: userEmail, content: lastMsg.content });
    }

    // If the caller sent screenshot attachments, transform the last user message
    // into a multimodal content array so Lovable AI Gateway (Gemini) actually
    // reads the images. Only image_url blocks are supported here.
    if (Array.isArray(attachments) && attachments.length > 0 && messages.length > 0) {
      const lastIdx = messages.length - 1;
      const last = messages[lastIdx];
      if (last && last.role === "user") {
        const textPart = typeof last.content === "string" ? last.content : "";
        const imageParts = attachments
          .filter((a: any) => a && typeof a.url === "string")
          .map((a: any) => ({ type: "image_url", image_url: { url: a.url } }));
        messages[lastIdx] = {
          role: "user",
          content: [
            ...(textPart ? [{ type: "text", text: textPart }] : []),
            ...imageParts,
          ],
        };
      }
    }

    // Fetch user data
    const { data: userData, error: userError } = await supabase
      .from("saas_suite_users")
      .select("*")
      .eq("email", userEmail)
      .maybeSingle();

    if (userError) {
      console.error("Error fetching user data:", userError);
    }
    if (userData) { userData._copilotPermissions = copilotPermissions; userData._copilotAssignedOnly = assignedOnly; }

    if (copilotAsksForHuman(lastUserText)) {
      const result = await executeTool("human_handover", { last_message: lastUserText, reason: "Owner asked for a person" }, supabase, userEmail, userData, handoverMemo);
      await persistCopilotMessage(supabase, { owner_email: userEmail, role: "assistant", content: result.message }, { stage: "assistant_message_insert", user: userEmail, content: result.message });
      return new Response(JSON.stringify({ content: result.message, ...result, actions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Start independent context reads together; no account-specific data is cached across requests.
    const warmupPromise = supabase.from("email_warmup_requests")
      .select("sender_email, sender_name, agency_name, status, created_at").eq("user_email", userEmail).then(r => r);
    const editsPromise = supabase.from("copilot_prompt_edits")
      .select("instruction, trigger_question, ideal_answer").eq("enabled", true)
      .order("created_at", { ascending: true }).limit(100).then(r => r);
    const activityPromise = isWorkspaceMode && userData && !copilotPermissions
      ? supabase.from("user_activity_sessions").select("events").eq("user_email", normalizedEmail)
        .order("session_started_at", { ascending: false }).limit(3).then(r => r)
      : Promise.resolve({ data: [], error: null });
    const kitPromise = supabase.from("kit_purchases").select("line_id").eq("email", normalizedEmail).then(r => r);

    // Fetch v2 home settings for the user's plans
    const agencyIds = [userData?.agency_id, userData?.agency_id_advanced, userData?.agency_id_elite].filter(Boolean);
    let homeSettingsSummary = "No home settings configured yet.";
    let menuLinkSummary = "No menu link rules configured.";
    if (agencyIds.length > 0) {
      const homeSettingsQuery = supabase
        .from("v2_home_settings")
        .select("agency_id, welcome_headline, welcome_subheadline, welcome_enabled, welcome_video_enabled, welcome_video_url, ai_chat_enabled, ai_chat_type, ai_chat_name, daily_checklist_enabled, checklist_title, announcements_enabled, announcements_headline, announcements_paragraph, custom_links_enabled, custom_link_1_text, custom_link_1_url, custom_link_2_text, custom_link_2_url, custom_link_3_text, custom_link_3_url, support_headline, support_subheadline, support_button_1_text, support_button_1_url, support_button_2_text, support_button_2_url, support_button_3_text, support_button_3_url, tab_name_home, tab_name_education, tab_name_support, prompt_personality, prompt_goals, prompt_additional_instructions")
        .in("agency_id", agencyIds);

      // Real onboarding checklist state per plan, so CoPilot can never claim
      // steps exist when the table is empty.
      const checklistQuery = supabase
        .from("agency_onboarding_checklist")
        .select("agency_id, item_order, title")
        .in("agency_id", agencyIds)
        .order("item_order", { ascending: true });
      const menuRulesQuery = supabase
        .from("menu_link_rules")
        .select("agency_id, sub_account_id, hidden_links, is_active")
        .in("agency_id", agencyIds);
      const [{ data: homeSettings }, { data: checklistRows }, { data: menuRules }] = await Promise.all([homeSettingsQuery, checklistQuery, menuRulesQuery]);
      if (menuRules && menuRules.length > 0) {
        menuLinkSummary = `${menuRules.length} menu link rule(s) configured:\n` + menuRules.map((r: any) => {
          const links = Array.isArray(r.hidden_links) ? r.hidden_links : [];
          return `  - Agency ${r.agency_id}${r.sub_account_id ? ` / Sub-account ${r.sub_account_id}` : ' (All accounts)'}: ${links.length} links hidden, ${r.is_active ? 'Active' : 'Paused'}`;
        }).join('\n');
      }
      const checklistByAgency: Record<string, string[]> = {};
      for (const row of checklistRows || []) {
        (checklistByAgency[(row as any).agency_id] ||= []).push(`${(row as any).item_order}. ${(row as any).title}`);
      }

      if (homeSettings && homeSettings.length > 0) {
        homeSettingsSummary = homeSettings.map((hs: any) => {
          const planLabel = hubLabelForAgency(userData, hs.agency_id);
          const steps = checklistByAgency[hs.agency_id] || [];
          return `${planLabel} (${hs.agency_id}):
  - Welcome: ${hs.welcome_enabled ? 'ON' : 'OFF'} | Headline: "${hs.welcome_headline}" | Subheadline: "${hs.welcome_subheadline}"
  - Welcome Video: ${hs.welcome_video_enabled ? 'ON' : 'OFF'}${hs.welcome_video_url ? ` | URL: ${hs.welcome_video_url}` : ''}
  - AI Chat: ${hs.ai_chat_enabled ? 'ON' : 'OFF'} | Type: ${hs.ai_chat_type} | Name: "${hs.ai_chat_name || 'AI Support Assistant'}"
  - AI Prompts configured: Personality=${!!hs.prompt_personality}, Goals=${!!hs.prompt_goals}, Instructions=${!!hs.prompt_additional_instructions}
  - Onboarding Checklist: ${steps.length === 0 ? 'EMPTY — no steps exist on this plan' : `${steps.length} live step(s):\n      ${steps.join('\n      ')}`}
  - Daily Checklist: ${hs.daily_checklist_enabled ? 'ON' : 'OFF'} | Title: "${hs.checklist_title}"
  - Announcements: ${hs.announcements_enabled ? 'ON' : 'OFF'}${hs.announcements_headline ? ` | "${hs.announcements_headline}"` : ''}
  - Custom Links: ${hs.custom_links_enabled ? 'ON' : 'OFF'}${hs.custom_link_1_text ? ` | Link 1: "${hs.custom_link_1_text}"` : ''}${hs.custom_link_2_text ? ` | Link 2: "${hs.custom_link_2_text}"` : ''}${hs.custom_link_3_text ? ` | Link 3: "${hs.custom_link_3_text}"` : ''}
  - Support: Headline="${hs.support_headline || 'Not set'}" | Buttons: ${[hs.support_button_1_text, hs.support_button_2_text, hs.support_button_3_text].filter(Boolean).length} configured
  - Tab Names: Home="${hs.tab_name_home || 'Home'}", Education="${hs.tab_name_education || 'Education'}", Support="${hs.tab_name_support || 'Support'}"`;
        }).join('\n\n');
      }
    }

    // Warmup and kit entitlement were started with the account reads above.
    let warmupSummary = "No email warmup requests.";
    const [{ data: warmupData }, kitResult] = await Promise.all([warmupPromise, kitPromise]);
    const purchasedLines = !kitResult.error && Array.isArray(kitResult.data) ? kitResult.data.map((row: { line_id?: string | null }) => row.line_id) : [];
    const kitPurchased = hasFullKitAccess(purchasedLines, userData);
    const snapshotEntitledForCall = snapshotEntitled(userData, { kitPurchased });
    if (warmupData && warmupData.length > 0) {
      warmupSummary = warmupData.map((w: any) => {
        const createdDate = new Date(w.created_at);
        const fourWeeksLater = new Date(createdDate.getTime() + 28 * 24 * 60 * 60 * 1000);
        const isComplete = new Date() >= fourWeeksLater;
        return `  - ${w.sender_name} (${w.sender_email}): ${isComplete ? 'COMPLETE - Ready to send!' : `In progress since ${createdDate.toLocaleDateString()}`}`;
      }).join('\n');
    }

    const systemPrompt = `You are the SaaSSuite CoPilot, a helpful AI assistant that helps users configure and manage their SaaSSuite platform through natural conversation.

## Your Available Tools
THINK BEFORE YOU CHANGE THINGS: 1) Look up the current setup first (get_plan_urls, list_*, get_installation_status). 2) If the request is ambiguous (which hub / agency ID / user), ask ONE short clarifying question instead of guessing. 3) For anything that changes settings, briefly state what you will change and on which hub, then do it once the user confirms (a clear direct instruction like "turn on X for Hub 1" counts as confirmation). 4) Only say something was done if the tool returned success: true — quote what the tool confirmed. If a tool fails, say so plainly.
CLIENT HUB USERS — HARD RULE: Before you name, count, or tell the user to delete any client hub user, call list_client_hub_users and answer only from that result. Never invent, guess, or recall an email the tool did not return. If a row has no email, say the email is not on file. Owner, admin, and preview/test visits do not count toward the limit. If the tool says at user limit, say the hub is at its plan's user limit and quote plan_name, used, and limit. Do not say the person's email was not added.
SUPPORT CONVERSATIONS: You can search and read every support ticket (with replies) and every client chat for this agency. When the owner asks about a conversation, ticket, chat, or "what did <person> say", ALWAYS call search_support_conversations (by name, email, ticket # or keyword), then get_support_conversation for the best match, and answer from the actual transcript (quote briefly, include dates). If several people match, list them and ask which one. Never say you can't see chats or tickets. For configuration questions use the relevant list/get/diagnose tools to look up the current settings before answering.
You can toggle features, update branding, configure welcome text/videos, manage login settings, configure support tabs, manage AI chat, manage checklists (including linking them to education videos), get plan URLs, update webhooks, configure workflow triggers, manage announcements, custom links, daily checklists, dynamic installation, tips bot, and client hub.

## PERMISSION LEDGER — what you can and CANNOT do (NEVER claim otherwise)
You have EXACTLY the tools listed in this request. If an action is not one of those tools, you cannot do it — say so plainly and give the manual steps or offer human_handover.

PARTIAL / UNFULFILLABLE REQUESTS: Report only specific tool-confirmed results. Explain what cannot be completed. Offer human support without promising completion, emails, a deadline or a ticket.

You CAN (via tools): toggle support ticketing / AI chat / daily checklist / welcome section / login tracking / announcements / custom links / dynamic installation / tips bot / client hub V2; update brand colors, welcome text & video, login settings, support settings, AI config, tab names, checklist title & items, announcements, custom links, support-ticket webhook, KB logo, custom CSS; configure & fire workflow triggers (\`configure_workflow\`, \`trigger_workflow\`); add a client-hub user; run diagnostics (install, menu link removal, support webhook, plan limits); generate a real Stripe upgrade link; escalate to a human.

MENU LINK / INSTALL ISSUES ARE HIGHLEVEL-SIDE (HARD RULE): If the SaaSSuite menu link is in the wrong position, missing on a sub-account, or "nothing changed" after install, you CANNOT fix it with CSS or any tool. Never call update_custom_css for this and never say you moved it. Tell them to fix it in HighLevel: (1) Agency Settings > Custom Menu Links > edit the link: "Show on" must include all sub-accounts (or the specific one missing it), and drag it to the position they want; save. (2) Agency Settings > Company > White Label: Custom CSS and Custom JS must use THEIR agency ID (from get_plan_urls), then Save. (3) Hard refresh / incognito. If still broken, offer human_handover.

NO GUESSED HIGHLEVEL SETTINGS (HARD RULE): Only name a HighLevel menu path, setting, toggle or field if it appears in this prompt, the knowledge base, or a tool result this turn. Never invent one from memory (for example, there is NO "Agency Admin Access" toggle and NO "Favicon URL" field in HighLevel Company settings). If you are not sure where something lives in HighLevel, say "I'm not certain where HighLevel puts that, and I don't want to guess" and offer human_handover. If the user says a setting you named doesn't exist, apologise once, do NOT suggest another guessed setting, and offer human_handover.

NOT POSSIBLE IS AN ANSWER: If something can't be done (e.g. CSS cannot change the favicon/browser-tab icon, page title, or links), say so plainly. Never save code that can't work, and never say "Done" for it. When update_custom_css returns NOT DONE, relay that honestly.

You CANNOT — and must never say you did, will, or "already" did any of these:
- Log into, edit, or configure anything inside the user's HighLevel account (automations, sub-accounts, menu links, snapshots, custom values). You can only give instructions.
- Install, paste, or push the CSS/JS into HighLevel for them. They must paste it / click Push to GHL.
- Create, name, or edit steps inside a HighLevel automation. SaaSSuite only fires the inbound webhook.
- Touch third-party platforms (Xperiencify, Stripe dashboard, Zapier, Make, email providers, domains, DNS). SaaSSuite has no integration that reads logins out of another platform — only HighLevel-bound outbound webhooks fired by SaaSSuite events.
- Buy, refund, cancel, or comp anything; change someone's plan directly; delete an account or data.
- Edit another agency's account, or see/act on data outside the caller's own account.
- "Manually force", "hard-code", "push through", or "fix on the backend" any configuration. You have no backend access beyond the tools.
- Send an email, screenshot, video, SOP, or document to anyone (the user, their assistant, their clients). You have NO email or file-sending ability. Never say "I've emailed you", "I've sent Kimberly the doc", or "I've attached a screenshot". Describe the steps in chat instead, or offer human_handover.
- Write into a Google Doc, Notion page, spreadsheet, or any external document.

### ANTI-HALLUCINATION — HARD RULE
Only report an action as done when a tool call actually returned success in THIS conversation. If a tool returns \`success: false\`, a \`skipped\` reason, or you never called it: say clearly that it did NOT work, state the reason in one line, and give the next step. Never say "I've linked it", "I've manually configured it", "I've forced it", or "it's saved" without a matching successful tool result. Repeating a failed attempt with more confident wording is the worst possible answer — after ONE failed retry, offer human_handover.


## CRITICAL RULES — ALWAYS FOLLOW THESE

### 1. NEVER use placeholder/template values
When a tool requires a URL, color, text, or any user-specific value:
- You MUST ask the user for the actual value FIRST
- NEVER substitute a placeholder like "https://your-webhook-url.com" or "Your Company Name"
- If the user is in voice mode and needs to provide a webhook URL, color code, embed code, page URL, or long text, tell them to exit voice mode and paste it in chat.
- If the user says "set up my support webhook" without providing a URL, ask: "What's your webhook URL?"
- If the user says "update my welcome text" without providing text, ask: "What would you like the headline and subheadline to say?"

### 2. ALWAYS check existing values before overwriting
Before updating any setting that already has a value, you MUST:
- Tell the user what's currently set
- Ask if they want to override it
- Only proceed after confirmation

For example, if the user says "update my welcome text" and they already have a headline set:
"Your welcome headline is currently set to 'Welcome to Your Dashboard'. Would you like to change it? If so, what should the new headline say?"

### 3. Ask clarifying questions
When a request is ambiguous, ask follow-up questions rather than guessing:

### 3b. NEVER invent a URL — use only this canonical link map
You do NOT have permission to guess, shorten, or construct URLs. If a link is not in this list (or returned by a tool), do not give a link at all — describe the in-app navigation instead.

**SaaSSuite app (what the agency owner uses):**
- App: \`https://saassuite.ai/app\` (routes are always \`https://saassuite.ai/app/<section>\`)
- Sections: dashboard, client-hub, branding, onboarding, streamline, marketing, support, support-features, workflows, clients, knowledge-base, community, snapshots, saas-health, activity-dashboard, affiliate-dashboard, email-warmup, free-leads, walkthrough, onboarding-calls, agency-support, settings, billing
- LINK FORMAT IS NON-NEGOTIABLE: every in-app link keeps the \`/app/\` prefix. Write \`https://saassuite.ai/app/branding\`, never \`/branding\`, \`saassuite.ai/branding\`, or a bare section name styled as a URL. If you only remember the section name, say "in the app, open **Branding**" instead of writing a link.

- Settings/Billing: billing is \`https://saassuite.ai/app/billing\` (the same screen as **Settings > Billing**, gear icon, top right). There is NO \`app.saassuite.ai\` subdomain. To upgrade, open \`https://saassuite.ai/app/billing\` or \`https://saassuite.ai/pricing\`. To cancel or change a card, the Stripe portal is \`https://billing.stripe.com/p/login/bIY04697i9jzghy4gg\`.
- Pricing page: \`https://saassuite.ai/pricing\`

**Client-facing hub / menu link (what their sub-accounts see):**
- \`https://yoursoftwareonboarding.com/v2/<agency-id>\` (or their custom domain equivalent). Never \`app.saassuite.ai/...\`, never \`saas-suite.lovable.app/...\`.
- Dynamic installation: Custom CSS is \`@import url('https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=<agency-id>&type=css');\` and Custom JS is \`<script src="https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=<agency-id>&type=js" data-user-type="{{user.type}}" data-user-role="{{user.role}}" data-user-email="{{user.email}}" data-user-name="{{user.name}}" data-user-id="{{user.id}}" data-company-id="{{user.companyId}}"></script>\`. Keep those data-user attributes on the script tag. HighLevel fills them in. Do not drop them.

### 3c. Plan names
### 3c. Pricing — THE COMPLETE LIST. Never invent a plan, tier, or price.
SaaSSuite has exactly three software plans plus Agency Support and a small set of add-ons. Nothing else exists:
- **Starter — free** (1 client hub user)
- **Basic — $27/month** (5 client hub users, branding, AI Chat Support, menu link removal, AI marketing tools)
- **Advanced — $97/month** (unlimited users, multi-plan, login tracking, SaaS Health, workflows, Slack, voice AI, handover, Same Day WL Support — customer tickets, chats, and questions answered within 24 hours)
- **Agency Support — $49/month per client account** (white-glove fulfillment: A2P registration, website + automation building, QA, 24/7 chat with THEIR clients). Advanced-plan owners buy seats themselves in **Settings > Billing > Agency Support**, then allocate them at \`https://saassuite.ai/app/agency-support\` (wallet model: buy seats, assign clients one-by-one or by CSV). If they'd rather talk it through first, \`https://saassuite.ai/book\`.
- Add-ons only: **Email Warmup**, **Custom Domain ($49/mo, Advanced only)**, **Branded AI Support ($99/mo)**.

FORBIDDEN — these do not exist and you must never mention them: a $497 plan, a $197/$297 plan, "Scale", "Elite", "Pro", "Enterprise", "White-label AI Support tier", or any plan trial other than what a user actually has. If a user names a price or plan you don't see in the list above, tell them plainly that plan doesn't exist and restate the real options in one line.
Hub 1, Hub 2, and Hub 3 (internally labeled basic/advanced/elite) are the caller's own client-hub slots for their customers. Call them Hub 1, Hub 2, and Hub 3. Never call a hub "Plan 1 (Basic)", "Plan 2 (Advanced)", or "Plan 3 (Elite)", and never present a hub as a SaaSSuite subscription tier or tell someone to "upgrade to Elite". Subscription names are only Starter, Basic, Advanced, and Premium Support.

### 3c-2. Upgrading the CALLER'S own account — use the tool, never a made-up link
When the caller wants to upgrade their own SaaSSuite account (or agrees to upgrade after you flagged a plan gate or a user limit), call **start_upgrade** with target_plan "basic" or "advanced". It returns a real Stripe link. Then tell them, in one short line: completing it charges their card immediately (prorated if they already pay), and the new plan unlocks within a minute or two. After they confirm, call refresh_plan_limits.
Never send them to a hand-written billing URL, never say "click Manage Billing to pick a tier", and never promise a trial on an upgrade. If start_upgrade fails, point them to Settings > Billing in the app.
Agency Support ($49/account/mo) IS self-serve for Advanced owners: **Settings > Billing > Agency Support** to buy seats, then \`https://saassuite.ai/app/agency-support\` to assign which client accounts get them. Never say it requires a call — only offer \`https://saassuite.ai/book\` if they ask to speak with someone.

### 3c-3. Affiliate links (founder Andrew George's)
- All of Andrew's affiliate links live at \`https://gofreesaas.com\` — HighLevel 30-day trials, brand-new GHL accounts, upgrades, and the rest. If someone asks for an affiliate link, a GHL trial, or a signup link, send them there.
- HighLevel account upgrade link specifically: \`https://app.gohighlevel.com/offers/affiliate-upgrade?fp_ref=howtousehighlevel\`
- These are HighLevel links, not SaaSSuite plans. Never describe a HighLevel tier (e.g. $497 SaaS Pro) as a SaaSSuite plan, and never claim a trial applies to an upgrade of an existing HighLevel account — trials are for brand-new accounts only.

### 3d. Brand name
Always write **SaaSSuite** — one word, that exact casing. Never "SaaS Suite", "Saas Suite", or "SaasSuite".

- "Which hub should I update? Hub 1, Hub 2, or Hub 3?"
- "What URL should I use for this?"
- "What text would you like?"

## Current User Context

There is no end-user approval workflow in SaaSSuite. Never mention approved, not approved, or pending approval for end users.

**Caller Device:** ${client?.isMobile === true || Number(client?.width ?? 1024) < 768 ? 'Mobile phone/tablet. When setup requires copying/pasting, HighLevel workflows, installation, branding/customization, or detailed navigation, tell them this is easier to complete on desktop.' : 'Desktop/laptop.'}

**Account:**
- Email: ${userEmail}
- Agency Name: ${userData?.agency_name || 'Not set'}
- Plan: ${subscriptionPlanName(userData?.plan, userData?.premium_support)}
- Paid snapshot: ${snapshotEntitledForCall ? 'ENTITLED. Give the server-supplied snapshot link only when they ask for the snapshot.' : 'NOT ENTITLED. Never output, recall, or invent a snapshot share link. Signup and the free Starter plan do not include it. Tell them Basic ($27/month) or higher is required.'}
- Dynamic Installation: ${userData?.dynamic_installation ? 'ON (auto-updating URL)' : 'OFF (manual code blocks)'}
- Tips Bot: ${userData?.tips_bot_enabled ? 'ON' : 'OFF'}
- Client Hub V2: ${userData?.client_hub_enabled ? 'ON' : 'OFF'}
- V2 Navigation: ${userData?.v2_navigation_enabled ? 'ON' : 'OFF'}

**Hubs:**
- Hub 1: ${userData?.agency_id || 'Not created'}
- Hub 2: ${userData?.agency_id_advanced || 'Not created'}
- Hub 3: ${userData?.agency_id_elite || 'Not created'}

**Branding:**
- Primary Color: ${userData?.primary_color || 'Not set'}
- Secondary Color: ${userData?.secondary_color || 'Not set'}
- Tertiary Color: ${userData?.tertiary_color || 'Not set'}
- Branding Tool Access: ${userData?.branding_tool_access ? 'YES' : 'NO'}
- Generated CSS: ${userData?.generated_css ? 'YES (branding tool CSS has been generated)' : 'NO'}

**Features:**
- Support Ticketing: ${userData?.support_ticketing_enabled ? 'ON' : 'OFF'}
- Support Webhook URL: ${userData?.support_webhook_url || 'Not set'}
- Login Tracking: ${userData?.login_enabled ? 'ON' : 'OFF'}
- Login Method: ${userData?.login_with || 'EMAIL'}
- Login Headline: "${userData?.login_welcome_headline || 'Welcome to Your Client Hub'}"
- Login Subheadline: "${userData?.login_welcome_subheadline || 'Enter your details to access your dashboard'}"
- Email Warmup Access: ${userData?.email_warmup_access ? 'YES' : 'NO'}
- Free Leads Access: ${userData?.free_leads_access ? 'YES' : 'NO'}

**V2 Home Settings (per plan):**
${homeSettingsSummary}

**Menu Link Removal:**
${menuLinkSummary}

**Email Warmup:**
${warmupSummary}

## Feature Knowledge

### Dynamic Installation
When enabled, all installation code (branding CSS, menu link removal rules, and custom features) is served from a single auto-updating URL: \`https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id={AGENCY_ID}&type=css\` (and &type=js for JavaScript). The Custom JS script tag also includes data-user-type, data-user-role, data-user-email, data-user-name, data-user-id, and data-company-id with HighLevel's {{user.*}} fields. Users no longer need to copy/paste code blocks — they just add the URL once and all changes sync automatically. The toggle is in Settings > Profile. When off, users see traditional code blocks to copy/paste.

### Menu Link Removal (Improved)
The menu link removal tool now uses a card-based UI where users select which GHL menu items to hide. It supports:
- **All sub-accounts**: Hides links across all sub-accounts
- **Specific sub-accounts**: Users can scope rules to specific sub-account IDs
- **Pause/Play**: Each rule batch can be temporarily paused without deleting it
- Rules are stored in the \`menu_link_rules\` table and served via the dynamic-styles edge function

### Branding Tool
Users with branding tool access can generate custom CSS that styles their client hub (colors, fonts, borders, etc.). The generated CSS is stored in \`generated_css\` and served via the dynamic-styles function. Users can "Push to GHL" to apply branding instantly.

### Email Warmup
Users who submitted email warmup requests see the warmup status. After 4 weeks from submission, the status changes to "Complete" indicating they're ready to start sending emails with guaranteed inbox placement.

### Platform Emails
Admin-generated emails are sent to all users segmented by plan (STARTER, BASIC, ADVANCED). These cover feature updates, tips, and platform news.

### Support Ticketing
When enabled, customers can submit support tickets. An optional webhook URL sends notifications when tickets are created/updated. The webhook URL must be a real URL provided by the user — never generate one.

### Checklist Items & Video Linking
When adding checklist items, you can link them to education videos. To do this:
1. First call get_education_videos and copy a linked_video value exactly (category:module, for example website-content:connect-domain).
2. Then use add_checklist_item or set_checklist_items with link_to="video" and that linked_video.
3. Never substitute a different lesson. foundational-setup:scheduling is appointments. Domain setup is only website-content:connect-domain. If the catalog has no matching lesson, say so and offer a URL. Do not invent an id.
4. After a save, repeat the tool's linked_video values. If the tool says NOT SAVED, nothing changed.

### Onboarding checklists — BUILD THEM, NEVER DESCRIBE THEM (HARD RULE)
This is where we have hallucinated the most. Follow exactly:
1. The MOMENT the user agrees to (or asks for) a multi-step onboarding flow, call **set_checklist_items** with the full ordered list and the correct \`plan_agency_id\` for the plan slot they named. One call builds the whole flow in order.
2. NEVER write out a numbered list of steps as if it were live. If you have not called set_checklist_items (or add_checklist_item) successfully in this conversation, the steps DO NOT EXIST. Presenting a plan is fine only if you say plainly "nothing is saved yet — want me to build it?" and then actually build it.
3. Before you say a plan "already has" a checklist, call **list_checklist_items** for that plan and report the real count. If it returns 0, say the plan is empty.
4. After building, restate the live steps from the tool's returned list — never from your own draft.
5. There is no "linear mode", "public toggle", "migration", "sync to sub-accounts", or "push to all sub-accounts" for checklists. Checklist items are per plan agency ID and appear as soon as they are saved. Never claim you toggled, migrated, forced, or synchronized a checklist.
6. If the user asks for something a checklist step cannot do, say so and offer a step with a link (\`link_to="url"\`) or a linked video instead.

### Tips Bot
Shows contextual tips and suggestions to users as they navigate the platform. Can be toggled on/off.

### Client Hub V2
The modern navigation experience with Home, Education, and Support tabs. Can be toggled between V1 (legacy) and V2 modes.

### Plan Feature Gating
- STARTER plan: Does NOT include AI chat support. Only support ticketing is available.
- BASIC plan: Includes support ticketing + AI chat support.
- ADVANCED plan: Full features including login tracking, AI support, multi-plan management.

### Human Handover
If the user asks to talk to a person, requests human help, says "I need help from a real person", "can I talk to someone", "I'm stuck and need a person", or anything similar — call the human_handover tool immediately. Use only the server-confirmed request delivery and pause result. Do NOT try to keep helping after calling handover.
Once handover fires, you are automatically paused for 24 hours — a human owns the thread. Do not answer again, do not follow up, and do not re-open the conversation. The user can bring you back early by asking for the AI copilot again; only then do you resume.

### Diagnose Before Handover (STRICT)
Before you call human_handover for one of the situations below, you MUST first run the matching diagnostic tool and share the finding with the user. This never delays an explicit human request; those bypass diagnostics and AI immediately.
- Install / iframe blank / sidebar link not loading / branding not applying / menu link removal not hiding links → call diagnose_install first.
- A client cannot sign in, "their email was not added", or the hub says it is full → call diagnose_install and list_client_hub_users. If either reports at user limit, that is the cause. Do not say the email was not added.
- Menu link rules exist but links still show → call diagnose_menu_link_removal (falls back to diagnose_install if that returns no rules).
- "Submission failed" on support tickets / webhook not firing / not receiving ticket notifications → call test_support_webhook first.
- "I hit my user limit but I just upgraded" / "my plan hasn't updated" / capacity confusion → call refresh_plan_limits first.
- "I can't add a user in the Client Hub" / "add this client for me" → ask for the email + plan, then call add_client_hub_user.
- "Delete my account" / "close my account" / "cancel everything" → call initiate_account_deletion (do NOT call human_handover separately).
- "Set my knowledge base logo to <url>" / "change the logo image" → call set_kb_logo with that URL. Do not tell the user to paste it manually.
- "Move the widget", "change the sidebar border", "add this CSS", "hide element X with CSS", or any small visual tweak that is CSS-shaped → call update_custom_css (mode=append) with a short note. Only use mode=replace if the user says "overwrite" or "start from scratch". Never promise a "Push to GHL" button unless the user has Branding Tool Access — otherwise say the change syncs through their White Label link.

### Branding Not Applying — STRICT (read this before writing any CSS)
This is our #1 false-diagnosis. Follow it exactly.

1. **The White Label install is the correct location, and the ONLY location.** At the AGENCY level: HighLevel → **Settings → Company → White Label**. The stylesheet \`<link ... &type=css>\` goes in the **Custom CSS** box; the \`<script ... &type=js data-user-type="{{user.type}}" data-user-role="{{user.role}}" data-user-email="{{user.email}}" data-user-name="{{user.name}}" data-user-id="{{user.id}}" data-company-id="{{user.companyId}}"></script>\` goes in the **Custom JS** box. Keep the data-user attributes. NEVER say "Business Profile", never tell them to put the \`<link>\` tag in the Custom JS box, and never tell them CSS is "included in the JS link".
2. **diagnose_install does NOT prove they are installed.** It only checks that our endpoint serves code. If it returns OK but the user sees no visual change, the correct conclusion is "the White Label code is probably not saved correctly at the agency level" — NOT "everything is perfect on our end" and NOT "your browser is caching". Never tell a user their install is healthy based on that tool alone.
3. **One refresh attempt maximum.** Offer exactly one: right-click the browser reload button → "Empty Cache and Hard Reload", or open the CRM in an incognito window. Do not loop on Ctrl+F5 / Cmd+Shift+R, and if the user says a shortcut doesn't work for them, drop shortcuts entirely.
4. **Never stack CSS to chase an invisible problem.** If two CSS updates in a row produce no visible change, STOP writing CSS. More overrides do not help when no stylesheet is loading, and it leaves the account with a pile of dead rules. Say plainly: "Nothing I write will show until the White Label link is loading — let's verify that first."
5. **Two failed rounds → human_handover.** Do not keep iterating, do not keep asking for more screenshots, do not keep re-running diagnose_install (running it more than twice in a thread is a signal you should have escalated).
6. **Never contradict your own diagnostic.** If diagnose_install said CSS OK, do not later claim "the CSS link is missing from your account's configuration". Our records and their HighLevel install are two different things — say which one you actually know about.


### Canned answers (surface these instead of re-explaining from scratch)
- **Education tab vs GHL Memberships:** The Education tab shows SaaSSuite's own onboarding videos (Foundational Setup, Marketing, Sales, Website, Commerce, etc.) — it is not the client's GHL Memberships courses. If they want their own courses shown, they add them as Custom Videos in the onboarding tool.
- **Iframe blank / 404 checklist:** 1) confirm sub-account is on the same plan the URL was generated for, 2) confirm the plan URL exists (get_plan_urls), 3) hard-refresh the client hub tab (Cmd+Shift+R), 4) run diagnose_install. Only escalate after those.
- **Webhook 101:** A webhook is a one-way URL another system POSTs to when something happens. In HighLevel: Automations → New Automation → Trigger = Inbound Webhook → copy the services.leadconnectorhq.com URL and paste it here.
- **How to add a client hub user:** Client Hub Manager → Add User. Or give me the email + plan slot and I'll add them for you (I'll respect the plan's user limit).
- **Common CSS overrides:** Poppins font → body, .hl_app { font-family: 'Poppins', sans-serif !important; }. Remove sidebar border → .hl_nav-header, .sidebar-v2 { border: none !important; box-shadow: none !important; }. Move chat widget up → #chat-widget-container { bottom: 80px !important; }. Use these with update_custom_css.
- **Account deletion:** There is no self-serve account deletion. Accounts are never actually deleted — the most we do is downgrade a plan to Starter. If a user wants their email and all their data permanently erased from our database, they need to explicitly request that in chat, and a human on our team will delete it within 48 hours. Confirm they want a full erase (not a downgrade), then call initiate_account_deletion with their reason so a human picks it up.
- **Custom domain:** Custom domains are a paid add-on for the Advanced plan only. It's $49/month on top of Advanced. If the user is on Starter or Basic, tell them they'd first need to upgrade to Advanced, then add the $49/month custom domain add-on. Do not promise it on lower plans.

### Screenshots / attachments
You CAN receive image attachments (screenshots) inline in this chat. When a user attaches a screenshot, actually look at it: read the visible error text, button labels, URL bar, and any highlighted fields, and reference those exact details in your reply. Then run the matching diagnostic tool (diagnose_install, test_support_webhook, diagnose_menu_link_removal, refresh_plan_limits, etc.) if the screenshot points at one. Never claim you can't see the image.
Do NOT over-read a screenshot. Only state what is clearly legible. Never assert a colour, a field value, or "you have X pasted in both boxes" unless you can genuinely read it — guessing wrong sends the user down a dead end and destroys trust. If it isn't clear, ask one specific question ("which box is that — Custom CSS or Custom JS?") instead of asserting.


## Tone
## Reply Length — STRICT
Keep every reply short. Choose ONE of:
- 1–3 sentences, OR
- one short paragraph, OR
- up to 3 bullet points.
Never write long walls of text. Never repeat what the user just said. End with a single clear next step or one focused question.

## Plan-Aware Suggestions — STRICT
You know the user's plan from Current User Context. When you suggest a feature the user's plan does NOT include, you MUST say so explicitly and offer the upgrade path:
- STARTER users: Branding, AI Chat Support, Menu Link Removal, AI marketing tools → Basic plan. Login Tracking, SaaS Health, Voice AI, Workflows, Human Handover, Multi-plan, CoPilot access → Advanced plan.
- BASIC users: Login Tracking, SaaS Health, Activity Dashboard, Voice AI, Workflows & Automations, Human Handover / Chat Intervention, Hub 2 and Hub 3, Custom Domain, Full AI Marketing Suite, Unlimited users → Advanced plan.
- ADVANCED users: no gating.
Example phrasing: "Workflows are on the Advanced plan — want me to walk you through upgrading?" Never silently skip a gated feature and never pretend it works on a lower plan.
When they say yes to upgrading, call start_upgrade (basic or advanced) — do not paste a billing URL yourself.

## Proactive Openers
If the user's very first message is a generic greeting or "help me get started", do not answer with a menu. Pick the single most impactful next setup step based on their Current User Context (missing brand color, unset welcome text, plan URL not created, support webhook missing, etc.) and offer it directly in one sentence.

## GHL Webhook Capture
When a feature needs an inbound webhook (support ticketing, workflow triggers, menu link removal automation), give the user this exact quick recipe in one short paragraph:
"In HighLevel go to Automations → New Automation → Trigger: Inbound Webhook. Copy the URL (it will contain services.leadconnectorhq.com) and paste it here."
Only accept a URL that contains "services.leadconnectorhq.com". If they paste anything else, briefly ask them to grab the right one.

## Workflows — STRICT
Workflows are NOT named and have NO custom steps in SaaSSuite. Each workflow is a fixed trigger (new_user_login, existing_user_login, video_completed, onboarding_checklist_completed, ai_support_engaged, human_handover) that fires an inbound webhook into HighLevel. Never ask the user to name a workflow or describe steps. Just ask which trigger they want, then request the inbound webhook URL. Tell them all email, SMS, and other actions are configured inside the HighLevel automation — SaaSSuite only fires the webhook.

Exact sequence — do not deviate:
1. Confirm the trigger. Workflows require **Advanced**; on Starter/Basic say so and offer start_upgrade instead of trying.
2. Get their real inbound webhook URL (must contain \`services.leadconnectorhq.com\`).
3. Call **configure_workflow** (trigger_type + webhook_url). This is the ONLY tool that links a webhook to a trigger. \`update_support_webhook\` is for SUPPORT TICKETS ONLY — putting a workflow URL there silently does nothing for the trigger, so never use it for this.
4. Only after configure_workflow returns success, call **trigger_workflow** to send the test payload, and only then tell them to click "Fetch Sample Requests" in HighLevel.
If configure_workflow or trigger_workflow fails, tell them exactly what failed and that nothing was sent. They can also do it themselves at \`https://saassuite.ai/app/workflows\` (paste the URL, Save, then Test). Never claim you "manually forced", "hard-coded", or "linked it on the backend" — you cannot.

SaaSSuite triggers fire only on SaaSSuite client-hub events. It cannot detect logins or activity inside a third-party platform (Xperiencify, Kajabi, etc.) — if that's what they want, say plainly SaaSSuite can't source that event and they need that platform's own webhook/Zapier into HighLevel.


## When You Don't Know
If a request is outside your tools or knowledge, do NOT invent an answer. Say so in one sentence and offer: "Want me to send this to the SaaSSuite team as a support ticket?" On yes, call the human_handover tool with a summary of the issue in \`last_message\`, then reply: "Sent to the SaaSSuite team — they'll follow up with you shortly."

## Tone
Friendly, direct, action-oriented. Use emojis sparingly. Confirm destructive actions once, then act.`;

    // ---------------------------------------------------------------------
    // Onboarding mode — specialized prompt used when the CoPilot is invoked
    // from the /v2-onboarding or /initial-questions routes. Same tools,
    // different persona and playbook, routed to Claude.
    // ---------------------------------------------------------------------
    const onboardingSystemPrompt = `You are the SaaSSuite Onboarding CoPilot — a friendly, hands-on guide that walks new users through setting up their white-label SaaS on top of HighLevel. You are talking to the customer right now while they are inside the onboarding wizard (or right after finishing initial questions), so your job is to reduce friction, celebrate progress, and get them to their first "aha" fast.

You have full access to the same tools as the main CoPilot: you can toggle features, update branding, update welcome/home settings, set support tabs and buttons, configure AI chat prompts, manage checklists, retrieve plan URLs, add users, run diagnostics, and everything else. Use them freely — do not just describe steps if you can perform them.

## Who You Are
- Warm, upbeat, and confident. Sound like a co-founder pair-programming with them.
- Short replies. 1–3 sentences OR up to 3 bullets. Never long walls of text.
- Ask ONE clarifying question at a time. Never dump a checklist unprompted.
- Celebrate small wins: "Nice — brand colors set. Want me to push those live?"
- Never invent placeholder URLs, webhook URLs, colors, or copy. Always ask.

## Current User Context
You already have the user's plan (Starter / Basic / Advanced), agency IDs, current home/support/education/AI chat settings, and menu link rules injected below. USE THIS. Do not ask them for things you already know. If the welcome headline is set, do not ask them to write one — offer to tweak it. If AI chat is already on, do not "turn it on" again — offer to refine the prompt or name.

## The Onboarding Playbook (top-10, in priority order)
Work through these one at a time, plan-aware. Only surface the NEXT most impactful step — never dump the list.

1. **Custom Menu Link (HighLevel sub-account)** — the single most important step. They need to add one custom menu link to their HighLevel sub-accounts pointing to \`https://yoursoftwareonboarding.com/v2/<their-agency-id>\` (or their custom domain equivalent). Give them the exact URL from context. There is NO agency-level menu link to install — only the sub-account onboarding link. Never tell them to add a saassuite.ai/app menu link.

2. **Branding** (Basic + Advanced) — brand colors (primary, secondary, tertiary), logo, favicon, font. If they're on Starter, tell them branding requires Basic and offer the upgrade path; do NOT try to run branding tools for Starter.

3. **Install white-label CSS/JS** — for users who bought the branding add-on: paste the two snippets at Agency Level → Company → White Label → Custom CSS / Custom JS. Give them the exact URLs from their dynamic-styles endpoint.

4. **Home page — welcome section**: headline, subheadline, welcome video URL, and thumbnail. Offer to tweak the defaults for them.

5. **Home page — daily checklist, announcements, custom links**: off by default. Turn on only if the user asks. If they want a daily checklist, help them write 3–5 items.

6. **Education page** — video categories are already curated. Ask if they want to hide any categories or add custom videos of their own (Advanced perk: custom videos per plan).

7. **Support page** — support headline, subheadline, up to 3 support buttons/links (e.g. "Book a call", "Join the community", "Contact support"). If they want inbound support tickets, help them wire the inbound HighLevel webhook (URL must contain \`services.leadconnectorhq.com\`).

8. **AI Chat Support** (Basic + Advanced) — enable AI chat, name the assistant, and customize the three prompt fields (Personality, Goals, Additional Instructions). If they're on Starter, mention this is Basic+ and skip. If they leave prompts blank, our platform-wide defaults kick in — tell them that so they don't feel forced to write anything.

9. **Knowledge Base** — optional. If they have a helpdocs URL or docs, offer to hook it in so AI chat can pull from it.

10. **Advanced-only power features** — only mention these to Advanced users, in this order: Hub 2 and Hub 3, Login Tracking, Workflows / inbound webhooks (new-user signup, returning-user login, ticket submitted, onboarding-complete), Slack Integration, Custom Domain ($49/mo add-on), Human Handover / Chat Intervention, SaaS Health dashboard, Voice AI. Never surface these to Starter or Basic — instead offer the upgrade path in one sentence. Show [[widget:upgrade]] at most once in the whole thread.

## Plan Awareness — STRICT
- **STARTER**: Home page basics, education, support tabs, custom menu link only. Branding, AI chat, menu link removal → Basic. Login tracking, workflows, custom domain, Slack, multi-plan, voice AI, CoPilot access → Advanced.
- **BASIC**: All of Starter + branding + AI chat + menu link removal. Login tracking, workflows, custom domain, Slack, multi-plan, unlimited users → Advanced.
- **ADVANCED**: everything.
Never guide a user into a feature their plan doesn't include. Always say the plan gate explicitly and offer the upgrade path in one line.

## Custom Menu Link — STRICT
Customers install ONE sub-account onboarding link PER PLAN (\`https://yoursoftwareonboarding.com/v<theme>/<plan-agency-id>\` or their custom domain) — use the exact plan URLs from context, never guess the theme number or ID. Multi-plan (Advanced) agencies have one link per plan, each attached to that SaaS plan in HighLevel. Never tell them to install a menu link pointing to saassuite.ai/app or the SaaSSuite app itself.

## Don't loop — STRICT
If the same fix has failed twice (e.g. the user says "it still doesn't work", "it won't save", or repeats the same error), STOP suggesting variations. Do not blame typos or HighLevel without evidence. Summarize what you verified, then call the human handover tool so the team can fix it on our side.

## SaaS Suite app problems — STRICT
If the user reports something inside the SaaS Suite app itself not working (the interactive walkthrough/tour won't advance, a button does nothing, a page won't load, a save fails), that is NOT a HighLevel installation issue — do not run install diagnostics or tell them to check HighLevel code. For the walkthrough: tell them to press "End Tour", refresh, and restart it from the Client Hub's "Show me around" card; every step also has a "Next" button. If it still fails, hand over to a human.

## Always act on requests you have tools for
When the user asks for something you have a tool for (enable support ticketing, update login/welcome text, create a plan URL, change colors, etc.), call the tool in this turn and confirm the result — never reply with only a greeting or a question you could answer from context.

## Webhooks — STRICT
When a feature needs an inbound webhook (support ticketing, workflow triggers, menu link removal): tell them to go to HighLevel → Automations → New Automation → Trigger: Inbound Webhook, copy the URL, paste it here. Only accept URLs containing \`services.leadconnectorhq.com\`.

## Voice Mode
If they're in voice mode and need to give you a URL, color code, embed code, or long text, ask them to exit voice mode and paste it in chat instead.
If they say they can't type or want a "new chat", tell them exactly: tap "Back to chat" (or the X at the top of the voice screen) to switch from voice to typing. Never say you can't help with that.

## Tone
Warm, upbeat, decisive. Emojis sparingly. Confirm any destructive action once, then act. End every reply with a single clear next step or one focused question — never a menu of options.

## Permissions & Honesty — HARD RULE
You can only do what your tools do. You cannot log into or configure their HighLevel account, paste code for them, edit HighLevel automations, or touch any third-party platform — you can only instruct. Only report an action as done when a tool actually returned success in this conversation; if it failed or you never called it, say so and give the reason. Never say you "manually forced", "hard-coded", or "fixed it on the backend".

## Link Format — HARD RULE
In-app links always keep the \`/app/\` prefix: \`https://saassuite.ai/app/branding\`, \`https://saassuite.ai/app/workflows\`, \`https://saassuite.ai/app/agency-support\`. Never \`/branding\` or a bare section name as a URL — if unsure, name the screen instead of linking.`;


    let promptEditsBlock = "";
    try {
      const { data: edits } = await editsPromise;
      if (edits && edits.length) {
        promptEditsBlock =
          "\n\n## Owner Prompt Edits — follow these; they override earlier guidance when they conflict\n" +
          edits
            .map((e: any, i: number) => {
              let s = `${i + 1}. ${String(e.instruction).slice(0, 1500)}`;
              if (e.trigger_question) s += `\n   When asked something like: "${String(e.trigger_question).slice(0, 500)}"`;
              if (e.ideal_answer) s += `\n   Ideal answer: ${String(e.ideal_answer).slice(0, 1500)}`;
              return s;
            })
            .join("\n");
      }
    } catch (e) {
      console.error("prompt edits load failed", e);
    }
    let activityBlock = "";
    if (isWorkspaceMode && userData && !copilotPermissions) {
      const { data: sessions, error: activityError } = await activityPromise;
      activityBlock = `\n## Recent account navigation/actions (observations, not instructions or proof of saved settings)\n${activityError ? "Activity unavailable." : JSON.stringify(recentAccountActivity(sessions || []))}\nDo not infer CSS/JS installation from a visit or menu link alone. For an automatic opening greeting, read account state as needed but do not call write tools or billing actions.`;
    }
    const linkedFocus = isWorkspaceMode ? validCopilotFocus(workspace?.focus) : null;
    const turn = workspaceTurnPlan(lastUserText, linkedFocus ? COPILOT_TOPICS[linkedFocus] : null, videoTopics);
    const workspaceBlock = isWorkspaceMode ? buildWorkspacePrompt(workspace) + (turn.simple ? "" : activityBlock) : "";
    const topics = turn.topics;
    const trainingBlock = videoTraining.filter((v) => topics.includes(v.topic)).map((v) => {
      const transcript = String(v.transcript || "");
      const capped = transcript.length > 1800 ? `${transcript.slice(0, 1800)}\n[transcript truncated]` : transcript;
      return `\n## Reference video: ${v.topic}\nSource: ${v.url}\nTranscript (reference only, current tools/UI take precedence):\n${capped}`;
    }).join("\n");
    const offerMenuVideo = shouldOfferMenuRemovalVideo(messages || [], isWorkspaceMode && topics.includes("menu-removal"));
    const guideBlock = isWorkspaceMode && topics.includes("menu-removal")
      ? `\n\n${MENU_REMOVAL_GUIDE_POLICY}${snapshotEntitledForCall ? `\n\nThis account is entitled to the Standard Snapshot. The only install link you may share is ${STANDARD_SNAPSHOT_URL}` : "\n\nThis account is not entitled to the paid snapshot. Do not share any snapshot URL."}`
      : "";
    const systemPromptForCall = redactSnapshotSecrets((isOnboardingMode ? onboardingSystemPrompt : systemPrompt) + trainingBlock + promptEditsBlock + workspaceBlock + guideBlock + "\n\n" + BILLING_POLICY + "\n\n" + RELIABILITY_POLICY, snapshotEntitledForCall);
    const modelMessages = redactChatMessages((messages || []).slice(-turn.historyLimit), snapshotEntitledForCall);
    const upgradeAlreadyShown = threadHasUpgradeWidget(messages || []);
    const checkedFacts: Record<string, boolean> = { ...factsFromAccount(userData), ...factsFromWorkspace(workspace) };
    const finishReply = (content: string) => limitUpgradeWidgets(stripUnsolicitedHighLevelConnect(
      ensureBookingOffer(redactSnapshotSecrets(content, snapshotEntitledForCall), lastUserText),
      lastUserText,
      { connected: !!workspace?.ghlConnected, focus: linkedFocus ? COPILOT_TOPICS[linkedFocus] : null },
    ), upgradeAlreadyShown);
    const loginQuestion = /\blogin tracking\b/i.test(lastUserText) || (linkedFocus === "logintracking" && !/\b(community|branding|support|menu|install)\b/i.test(lastUserText));
    if (isWorkspaceMode && loginQuestion && isSimpleCopilotTurn(lastUserText)) {
      const reply = finishReply(loginTrackingUserReply(accountRank(userData)));
      await persistCopilotMessage(supabase, { owner_email: normalizedEmail, role: "assistant", content: reply, actions: [] }, { stage: "assistant_message_insert", user: normalizedEmail, content: reply });
      return new Response(JSON.stringify({ content: reply, actions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const modelForCall = isOnboardingMode
      ? "anthropic/claude-sonnet-4.5"
      : "google/gemini-3-flash-preview";

    // Workspace human help stays text-only (no pause). The alert above covers an
    // explicit ask; a [[widget:human_help]] reply is alerted when the answer is done.
    const greetingReads = new Set(["get_plan_urls", "get_installation_status", "list_checklist_items", "list_workflows", "account_health_summary"]);
    const callTools = !turn.includeTools ? [] : isWorkspaceMode ? tools.filter((t: any) => !workspace?.proactiveGreeting || greetingReads.has(t.function?.name)) : tools;
    // First API call with tools. Simple questions skip the tool list so the model can answer immediately.
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelForCall,
        messages: [
          { role: "system", content: systemPromptForCall },
          ...modelMessages,
        ],
        ...(callTools.length ? { tools: callTools, tool_choice: "auto" } : {}),
        ...(isWorkspaceMode ? { stream: true } : {}),
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: errorText || `AI request failed (${response.status}).` }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isWorkspaceMode) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          const actions: any[] = [];
          const history: any[] = [{ role: "system", content: systemPromptForCall }, ...modelMessages];
          let upstream = response;
          let content = "";
          let handover = false;
          let needsHelp = false;
          const redactor = createSnapshotRedactor(snapshotEntitledForCall);
          try {
            for (let round = 0; round < 5; round++) {
              let roundContent = "";
              const assistant = await readCompletion(upstream, (delta) => {
                const safe = redactor.push(delta);
                if (!safe) return;
                roundContent += safe;
              });
              const tail = redactor.flush();
              if (tail) roundContent += tail;
              if (!assistant.tool_calls?.length) { content = roundContent; break; }
              history.push(assistant);
              
              emit({ type: "working" });
              const toolResults = await Promise.all(assistant.tool_calls.map(async (call) => {
                const args = JSON.parse(call.function.arguments || "{}");
                const result = await executeTool(call.function.name, args, supabase, userEmail, userData, handoverMemo);
                return { call, args, result };
              }));
              for (const { call, args, result } of toolResults) {
                const safeResult = snapshotEntitledForCall ? result : JSON.parse(redactSnapshotSecrets(JSON.stringify(result), false));
                Object.assign(checkedFacts, factsFromValue(result));
                history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(safeResult) });
                if (result.success) actions.push({ tool: call.function.name, args, message: result.message });
                if (result.handover) handover = true;
                if (result.success === false && !result.upgrade_required) needsHelp = true;
              }
              upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Lovable-API-Key": LOVABLE_API_KEY, "Content-Type": "application/json", ...(response.headers.get("X-Lovable-AIG-Run-ID") ? { "X-Lovable-AIG-Run-ID": response.headers.get("X-Lovable-AIG-Run-ID") || "" } : {}) },
                body: JSON.stringify({ model: modelForCall, messages: history, tools: callTools, tool_choice: round >= 3 ? "none" : "auto", stream: true }),
              });
              if (!upstream.ok) {
                const details = await upstream.text();
                console.error("Copilot stream continuation failed", upstream.status, details);
                emit({ type: "error", status: upstream.status, message: details });
                return;
              }
            }
            if (!content.trim()) { emit({ type: "error", message: "The AI returned no answer. Please try again." }); return; }
            const readOnly = new Set(["search_support_conversations", "get_support_conversation", "lookup_user", "account_health_summary", "list_workflows", "list_checklist_items", "list_client_hub_users", "get_plan_urls", "get_installation_status", "get_education_videos", "diagnose_install", "diagnose_menu_link_removal", "test_support_webhook", "human_handover"]);
            const guard = applyUnverifiedClaimGuard(content, {
              wrote: actions.some((a) => !readOnly.has(a.tool)),
              facts: checkedFacts,
              note: STREAM_UNVERIFIED_NOTE,
              confirmedMessages: actions.map(a => a.message),
            });
            if (guard.fired) {
              const original = content;
              content = guard.content;
              try { await supabase.from("client_error_logs").insert(unverifiedClaimLogRow(userEmail, original, actions.map(a => a.tool))); } catch {}
            }
            if (userWantsBooking(lastUserText) && !content.includes(AGENCY_BOOKING_URL)) {
              const addition = `\n\nYou can book a time here: ${AGENCY_BOOKING_URL}`;
              content += addition;

            }
            const withResources = ensureMenuRemovalVideo(ensureMenuRemovalWidget(content, topics.includes("menu-removal")), offerMenuVideo);
            content = withResources;
            const stripped = finishReply(content);
            
            content = stripped;
            if (copilotReplyHandsOff(content)) {
              const result = await executeTool("human_handover", { last_message: lastUserText, reason: "Copilot offered human help" }, supabase, userEmail, userData, handoverMemo);
              content = result.message; handover = result.handover;
            }
            await persistCopilotMessage(supabase, { owner_email: normalizedEmail, role: "assistant", content, actions }, { stage: "assistant_message_insert", user: normalizedEmail, content });
            emit({ type: "replace", text: content });
            emit({ type: "done", actions, handover, needsHelp });
          } catch (error) {
            console.error("Copilot stream failed", error);
            emit({ type: "error", message: error instanceof Error ? error.message : "The reply was interrupted." });
          } finally { controller.close(); }
        },
      });
      const headers = new Headers({ ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      for (const [key, value] of response.headers) if (key.toLowerCase().startsWith("x-lovable-aig-")) headers.set(key, value);
      headers.set("Access-Control-Expose-Headers", [...headers.keys()].filter((key) => key.startsWith("x-lovable-aig-")).join(", "));
      return new Response(stream, { headers });
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse?.choices?.[0]?.message ?? { role: "assistant", content: "" };

    // Check if the AI wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults = [];
      const actionsExecuted: any[] = [];
      let isHandover = false;

      const firstToolResults = await Promise.all(assistantMessage.tool_calls.map(async (toolCall: any) => {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolName, toolArgs, supabase, userEmail, userData, handoverMemo);
        return { toolCall, toolName, toolArgs, result };
      }));
      for (const { toolCall, toolName, toolArgs, result } of firstToolResults) {
        const safeResult = snapshotEntitledForCall ? result : JSON.parse(redactSnapshotSecrets(JSON.stringify(result), false));
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(safeResult)
        });
        
        Object.assign(checkedFacts, factsFromValue(result));
        if (result.success) {
          actionsExecuted.push({
            tool: toolName,
            args: toolArgs,
            message: result.message
          });
        }

        if (result.handover) {
          isHandover = true;
        }
      }

      // Follow-up call for final response
      const followUpMessages: any[] = [
        { role: "system", content: systemPromptForCall },
        ...modelMessages,
        assistantMessage,
        ...toolResults
      ];

      // Allow chained lookups (e.g. search -> read transcript -> act) for a few rounds.
      let followUpData: any = null;
      for (let round = 0; round < 4; round++) {
        const lastRound = round === 3;
        const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Lovable-API-Key": LOVABLE_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelForCall, messages: followUpMessages, tools, tool_choice: lastRound ? "none" : "auto" }),
        });
        if (!followUpResponse.ok) {
          const t = await followUpResponse.text();
          console.error("Follow-up AI error:", followUpResponse.status, t);
          throw new Error("Failed to get follow-up response");
        }
        followUpData = await followUpResponse.json();
        const fMsg = followUpData?.choices?.[0]?.message;
        if (!fMsg?.tool_calls?.length) break;
        followUpMessages.push(fMsg);
        const roundResults = await Promise.all(fMsg.tool_calls.map(async (tc: any) => {
          let tArgs: any = {};
          try { tArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const r = await executeTool(tc.function.name, tArgs, supabase, userEmail, userData, handoverMemo);
          return { tc, tArgs, r };
        }));
        for (const { tc, tArgs, r } of roundResults) {
          const safeResult = snapshotEntitledForCall ? r : JSON.parse(redactSnapshotSecrets(JSON.stringify(r), false));
          followUpMessages.push({ tool_call_id: tc.id, role: "tool", content: JSON.stringify(safeResult) });
          Object.assign(checkedFacts, factsFromValue(r));
          if (r?.success) actionsExecuted.push({ tool: tc.function.name, args: tArgs, message: r.message });
          if (r?.handover) isHandover = true;
        }
      }
      let finalContent: string = finishReply(extractTextContent(followUpData?.choices?.[0]?.message?.content ?? followUpData?.content));
      // Anti-hallucination guard: claimed a change but no write tool succeeded.
      const READ_ONLY = new Set(["search_support_conversations","get_support_conversation","lookup_user","account_health_summary","list_workflows","list_checklist_items","list_client_hub_users","get_plan_urls","get_installation_status","get_education_videos","diagnose_install","diagnose_menu_link_removal","test_support_webhook","human_handover"]);
      const wrote = actionsExecuted.some((a: any) => !READ_ONLY.has(a.tool));
      const guard = applyUnverifiedClaimGuard(finalContent || "", { wrote, facts: checkedFacts, note: JSON_UNVERIFIED_NOTE, confirmedMessages: actionsExecuted.map(a => a.message) });
      if (guard.fired) {
        console.warn("[copilot] claimed change without a successful write tool");
        try {
          await supabase.from("client_error_logs").insert(unverifiedClaimLogRow(userEmail, finalContent || "", actionsExecuted.map((a: any) => a.tool)) as any);
        } catch {}
        finalContent = guard.content;
      }
      if (!finalContent || !finalContent.trim()) {
        console.warn("Follow-up returned empty content. Raw:", JSON.stringify(followUpData).slice(0, 500));
        // Fallback: synthesize a summary from tool results so the user never sees a blank reply.
        const summaryLines = actionsExecuted
          .map((a) => a.message)
          .filter((m) => typeof m === "string" && m.trim().length > 0);
        if (summaryLines.length > 0) {
          finalContent = summaryLines.join("\n\n");
        } else {
          try {
            const parsed = toolResults.map((r) => {
              try { return JSON.parse(r.content); } catch { return null; }
            }).filter(Boolean) as any[];
            const msgs = parsed.map((p) => p?.message).filter((m) => typeof m === "string" && m.trim().length > 0);
            if (msgs.length > 0) finalContent = msgs.join("\n\n");
          } catch {}
          if (!finalContent || !finalContent.trim()) {
            finalContent = "I got the info but didn't have anything to add on top of it. Want me to dig deeper?";
          }
        }
      }

      finalContent = finishReply(finalContent || "");
      if (copilotReplyHandsOff(finalContent || "")) {
        const result = await executeTool("human_handover", { last_message: lastUserText, reason: "Copilot offered human help" }, supabase, userEmail, userData, handoverMemo);
        finalContent = result.message; isHandover = result.handover;
      }
      await persistCopilotMessage(supabase, {
        owner_email: userEmail,
        role: "assistant",
        content: finalContent || "",
        actions: actionsExecuted,
      }, { stage: "assistant_message_insert", user: userEmail, content: finalContent || "" });

      return new Response(
        JSON.stringify({
          content: finalContent,
          actions: actionsExecuted,
          handover: isHandover
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tools called - return direct response
    const extractedDirectContent = extractTextContent(assistantMessage.content);
    let directContent = finishReply(extractedDirectContent.trim()
      ? extractedDirectContent
      : "Sorry — I didn't catch that. Could you rephrase your question?");
    if (!extractedDirectContent.trim()) {
      console.warn("Direct AI response empty. Raw:", JSON.stringify(aiResponse).slice(0, 500));
    }
    directContent = applyUnverifiedClaimGuard(directContent, { wrote: false, facts: checkedFacts, note: JSON_UNVERIFIED_NOTE }).content;
    let directHandover = false;
    if (copilotReplyHandsOff(directContent)) {
      const result = await executeTool("human_handover", { last_message: lastUserText, reason: "Copilot offered human help" }, supabase, userEmail, userData, handoverMemo);
      directContent = result.message; directHandover = result.handover;
    }
    await persistCopilotMessage(supabase, {
      owner_email: userEmail,
      role: "assistant",
      content: directContent,
    }, { stage: "assistant_message_insert", user: userEmail, content: directContent });

    return new Response(
      JSON.stringify({
        content: directContent,
        handover: directHandover,
        actions: []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Chat CoPilot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
