// Menu link removal workflow guide shared by the Copilot prompt (server) and chat UI (client).
// Screenshot keys are referenced by the AI as [[screenshot:key]]; the client maps keys to images.

export const GUIDE_SCREENSHOTS: Record<string, string> = {
  configurefirstcodeaction1: "Open the first Custom Code action: “#1 Resolve buyer location – EDIT TOKEN HERE”.",
  configurefirstcodeaction2: "Replace YOURTOKENHERE with your HighLevel token and YOURCOMPANYIDHERE with your Company ID.",
  testfirstcodeaction: "Test the first action: enter any email and run the test.",
  successfultestthenclose: "A successful test result. Save the action, then close it.",
  modifylast3workflowactions: "The last three actions to configure: #2 Apply preset, #3 Assign menu link, #4 Custom webhook.",
  modifylast3workflowactions1: "In actions #2 and #3, paste your SaaSSuite webhook secret over YOURTOKENHERE and replace the raw body.",
  howtotestatendofsetup: "How to test the finished workflow.",
  settings_company_whitelabel: "Agency view: Settings > Company > White Label.",
  customJS_CSSpastelocations: "Where to paste your SaaSSuite Custom CSS and Custom JavaScript.",
};

/** HighLevel main sidebar items (matches the Menu Link Removal tool). */
export const MAIN_MENU_TAB_IDS = [
  "#sb_launchpad", "#sb_memberships", "#sb_automation", "#sb_sites", "#sb_app-media", "#sb_reputation",
  "#sb_reporting", "#sb_app-marketplace", "#sb_location-mobile-app", "#sb_email-marketing", "#sb_payments",
  "#sb_opportunities", "#sb_contacts", "#sb_calendars", "#sb_conversations", "#sb_dashboard", "#sb_AI Agents",
];
const KEEP_MAIN = ["#sb_app-media"];
const KEEP_SETTINGS = ["#sb_business_info", "#sb_profile", "#sb_saas-billing", "#sb_my-staff", "#sb_labs"];
export const MENU_REMOVAL_VIDEO_URL = "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6acfd5f2f2103dccac63aa82.mp4";

/** First relevant reply offers training; explicit requests can bring it back. */
export function shouldOfferMenuRemovalVideo(messages: Array<{ role: string; content: string }>, relevant: boolean): boolean {
  if (!relevant) return false;
  const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || "";
  if (/\b(video|watch|replay|training|tutorial)\b/i.test(lastUser)) return true;
  return !messages.some(m => m.role === "assistant" && (m.content.includes("[[widget:menu_removal_video]]") || m.content.includes(MENU_REMOVAL_VIDEO_URL)));
}
export function ensureMenuRemovalVideo(content: string, offer: boolean): string {
  if (!offer || content.includes("[[widget:menu_removal_video]]")) return content;
  return `${content}\n\n[[widget:menu_removal_video]]`;
}

export const STANDARD_PRESET_NAME = "Standard";

export const HIGHLEVEL_USER_ATTRS =
  'data-user-type="{{user.type}}" data-user-role="{{user.role}}" data-user-email="{{user.email}}" data-user-name="{{user.name}}" data-user-id="{{user.id}}" data-company-id="{{user.companyId}}"';

export function menuRemovalInstallCodes(agencyId: string) {
  const base = `https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(agencyId)}`;
  return { css: `@import url('${base}&type=css');`, js: `<script src="${base}&type=js" ${HIGHLEVEL_USER_ATTRS}></script>` };
}

export function menuRemovalBodies(agencyId: string, preset: string, menuId: string) {
  return {
    preset: JSON.stringify({ location_id: "{{custom_code.1.output.location_id}}", email: "{{contact.email}}", preset_name: preset, agency_id: agencyId }, null, 2),
    assign: JSON.stringify({ action: "add", agency_id: agencyId, menu_link_id: menuId, location_id: "{{custom_code.1.output.location_id}}" }, null, 2),
  };
}

export const MENU_REMOVAL_STEPS = ["snapshot", "buyer", "resolver", "preset", "assignment", "ai", "test"] as const;
export function nextMenuRemovalStep(step: number, direction: number): number {
  return Math.max(0, Math.min(MENU_REMOVAL_STEPS.length - 1, step + direction));
}

/** Prefer an explicit saved assignment, then a unique matching hub URL. Never guess between links. */
export function resolveMenuRemovalLink(menus: Array<{ menu_id: string; url?: string | null }>, saved: string | null | undefined, agencyId: string): string {
  const raw = String(saved || "").trim();
  const id = raw.match(/custom-menu-link\/([^/?#\s]+)/i)?.[1] || raw;
  if (id && menus.some(m => m.menu_id === id)) return id;
  const aliases = [agencyId, `${agencyId}-2`, `${agencyId}-3`].map(x => x.toLowerCase());
  const matches = menus.filter(m => {
    try {
      const url = new URL(m.url || "");
      if (!/^(?:[a-z0-9-]+\.)*(?:yoursoftwareonboarding\.com|saassuite\.ai|saas-suite\.lovable\.app)$/i.test(url.hostname)) return false;
      const segments = url.pathname.split("/").map(x => decodeURIComponent(x).toLowerCase());
      return aliases.some(alias => segments.includes(alias) || url.searchParams.get("agency_id")?.toLowerCase() === alias);
    } catch { return false; }
  });
  return matches.length === 1 ? matches[0].menu_id : "";
}

/** Resources own pacing and screenshots: never let a model dump the entire image guide. */
export function ensureMenuRemovalWidget(content: string, relevant: boolean): string {
  if (!relevant) return content;
  const cleaned = content.replace(/\[\[screenshot:[^\]]+\]\]/gi, "");
  if (/\[\[widget:upgrade\]\]/i.test(cleaned)) return cleaned;
  let found = false;
  const single = cleaned.replace(/\[\[widget:menu_removal_setup\]\]/gi, () => {
    if (found) return "";
    found = true; return "[[widget:menu_removal_setup]]";
  });
  return found ? single : `${single}\n\n[[widget:menu_removal_setup]]`;
}

/** Default preset: hide everything except Media, and in Settings keep only Profile, Billing, Users and Labs. */
export function standardPresetLinks(settingsTabIds: string[]): string[] {
  return [
    ...MAIN_MENU_TAB_IDS.filter((t) => !KEEP_MAIN.includes(t)),
    ...settingsTabIds.filter((t) => !KEEP_SETTINGS.includes(t)),
  ];
}

export const MENU_REMOVAL_GUIDE_POLICY = `## Menu link removal workflow setup (guide the user step by step)
Offer [[widget:menu_removal_video]] within the first few messages on this topic and again whenever asked to watch, replay or see the tutorial/training. Watching is optional; continue sequential setup without requiring it. This is NOT [[widget:videos]] (customer lesson selection). Current watch video: ${MENU_REMOVAL_VIDEO_URL}. Its transcript has not been processed; never claim to have watched it or attribute older reference transcripts to it.
The menu_removal_setup widget shows ONE step and at most ONE relevant screenshot. Never emit standalone screenshot tokens for this workflow, never dump the entire guide, all code bodies or all steps. Users advance with its Next step button; wait for their confirmation and answer only their current question. Screenshot references for your knowledge only: ${Object.entries(GUIDE_SCREENSHOTS).map(([k, v]) => `${k} (${v})`).join("; ")}.
Requirements first: Basic ($27) or higher — Starter accounts get [[widget:upgrade]]. HighLevel must be connected and the onboarding menu link installed (use the menu link tools to find its ID). Check the live UI state first: if HighLevel connected=true and menu link installed=true, those are DONE — say so briefly and never ask them to connect or reinstall. The SaaSSuite CSS/JS must be pasted in Settings > Company > White Label (screenshots settings_company_whitelabel, customJS_CSSpastelocations) or hidden links never take effect.
Steps, one per message turn, wait for "done" before the next:
1. Show [[widget:menu_removal_setup]] IMMEDIATELY when they ask for menu-removal setup, including snapshot questions. The Install Standard Snapshot button is filled by the server only after it checks this account's plan. Never paste, recall, or invent a snapshot URL. Free Starter accounts and signed-out visitors do not get the snapshot after signup. Never tell them to find the snapshot or values on the Menu Link Removal page, Settings, or any other SaaSSuite screen. All SaaSSuite resources are delivered by this chat widget ONE STEP AT A TIME. It remembers reported progress and has Back/Next controls; do not list later instructions before they advance. Accepting/loading a snapshot, creating HighLevel tokens, editing/testing/publishing a HighLevel workflow and pasting CSS/JS are HighLevel-only actions: launch or guide those from chat and return here; do not claim you can do them remotely. Do not promise that no HighLevel interaction is needed.
2. Automations: open the workflow with "Remove Menu Links" in the title.
3. Trigger: most SaaS-mode users use a purchase trigger. Whatever they pick, the buyer's sub-account MUST already exist and the contact email MUST be the email of a user on that sub-account. SaaS mode makes this easy; manual $97/$297-style plans work only if the user is already on their account.
4. Action #1 (configurefirstcodeaction1, configurefirstcodeaction2): show [[widget:menu_removal_setup]] for their Company ID and copyable resolver code. Create a fresh agency Private Integration token (View Locations, View Users, View Companies) in HighLevel and enter it ONLY in the local password field in the card; it is never sent to the AI or stored in chat. Saved connection tokens cannot be revealed. Map input email to contact.email. Test with a REAL buyer's email whose sub-account already exists (testfirstcodeaction); save and close (successfultestthenclose). Never invent Company IDs, tokens or buyer IDs; ambiguity must stop the workflow, not pick an arbitrary account.
5. The last three actions (modifylast3workflowactions, modifylast3workflowactions1). Show [[widget:menu_removal_setup]] — it has their SaaSSuite webhook secret (shown once), preset picker (creates the Standard preset if they have none: everything hidden except Media; in Settings only Profile, Billing, Users and Labs stay), and copy cards for action #2 (preset) and #3 (menu link assignment). Actions #2 and #3: paste the secret over YOURTOKENHERE in the X-SaaSSuite-Webhook-Secret header and replace the raw body.
6. Action #4 is Custom Code, not the webhook shown in that screenshot. Remove the old user-permission webhook so it cannot also run. HighLevel webhooks cannot GET the buyer and merge; PUT /users replaces the whole scope list and the old body also turned on agency permissions. The card's code reads GET /users/{id} (scopes, assigned-only scopes, and permission flags), adds only the checked AI feature scopes (AI Studio is ai-studio.readonlyv2 and ai-studio.writev2), and PUTs that union. It never removes an existing scope. Map input user_id to action #1's user_id. The buyer does not need a menu-link scope. Paste a NEW Private Integration token with only View Users and Edit Users into the card's password field; it is copied into the code locally and is not sent to the AI. The third AI Studio checkbox, Manage Git & download code, has no published scope name and is not added; access the buyer already has is kept. HighLevel will not save this Custom Code action until its built-in Test passes, and that Test runs the code for real and PUTs the user. Tell the agency to run that Test with their own dummy or test user, never a real client user. The later published-workflow check in step 7 is a separate test.
7. Save, publish and test (howtotestatendofsetup) with a real buyer whose sub-account exists, then refresh that sub-account.
The card provides exact POST URLs and headers for #2/#3 and Custom Code for #4 (GET, merge, PUT). Use HighLevel's variable picker for output IDs; never leave a placeholder without explaining its mapping. Do not tell the user to paste a static scopes body into a webhook. The snapshot workflow is a HighLevel workflow, not SaaSSuite's Advanced-only internal workflows; Basic suffices for menu removal. Chat Next step confirmations are the owner's reported progress, not live HighLevel verification. Existing presets/menu links/secrets are read from the account; never rotate an existing secret without explicit confirmation (old workflows will stop).
Debugging: the test user must be a real user on a real sub-account; emails must match; tokens need the exact permissions and scopes lock when a token is generated (make a new one after a 403); CSS/JS must use their agency ID (copy both from the chat card). Use the menu-removal video transcript for other questions, but its directions to fetch resources from SaaSSuite pages are obsolete in chat. If still stuck, offer [[widget:human_help]].`;
