// Catalogue the Client Hub actually plays. Keep this aligned with src/constants/videoCategories.ts.
// The hub opens a checklist step only when linked_video is `category:module` (or a bare module id
// that exists on exactly one lesson). A missing lesson must be rejected, not replaced with a
// nearby one — "Connect Your Domain" was saved as `scheduling` (appointments) because this list
// used to omit connect-domain.

export type EducationModule = {
  categoryId: string;
  categoryName: string;
  moduleId: string;
  name: string;
};

export const EDUCATION_MODULES: EducationModule[] = [
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "new-contact", name: "Create a New Contact" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "configure-profile-billing", name: "Configure Your Profile & Billing" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "mobile-app", name: "Mobile App Walkthrough" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "import-contacts", name: "Import and engage with all your contacts instantly" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "generate-leads", name: "Generate New Leads with a High-Converting Funnel" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "multi-channel", name: "Set Up Multi-Channel Communication & Start Engaging in Minutes" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "first-campaign", name: "Launch Your First Campaign to Drive Engagement" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "drip-campaigns", name: "Nurture Leads with Automated Drip Campaigns" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "scheduling", name: "Book More Appointments with Automated Scheduling" },
  { categoryId: "foundational-setup", categoryName: "Foundational Setup", moduleId: "sales-pipeline", name: "Accelerate Deal Closures with a Streamlined Sales Pipeline" },
  { categoryId: "marketing-lead-generation", categoryName: "Marketing & Lead Generation", moduleId: "social-media-planner", name: "Manage All Your Social Media Posts in One Place" },
  { categoryId: "marketing-lead-generation", categoryName: "Marketing & Lead Generation", moduleId: "facebook-lead-ads", name: "Capture New Leads with Facebook & Instagram Lead Ads" },
  { categoryId: "marketing-lead-generation", categoryName: "Marketing & Lead Generation", moduleId: "sms-campaign", name: "Reach Customers with Your First SMS Campaign" },
  { categoryId: "sales-conversation", categoryName: "Sales & Conversation", moduleId: "email-sync", name: "Seamlessly Manage Your Sales Conversations" },
  { categoryId: "sales-conversation", categoryName: "Sales & Conversation", moduleId: "live-chat", name: "Engage Website Visitors in Real Time with Live Chat" },
  { categoryId: "sales-conversation", categoryName: "Sales & Conversation", moduleId: "social-messaging", name: "Streamline Facebook & Instagram Conversations for Faster Response" },
  { categoryId: "sales-conversation", categoryName: "Sales & Conversation", moduleId: "a2p-registration", name: "A2P Registration: How to Verify Your Phone Number" },
  { categoryId: "website-content", categoryName: "Website & Content", moduleId: "professional-website", name: "Launch a Professional Website in Less Than a Day" },
  { categoryId: "website-content", categoryName: "Website & Content", moduleId: "wordpress-migration", name: "Migrate Your WordPress Site Seamlessly" },
  { categoryId: "website-content", categoryName: "Website & Content", moduleId: "connect-domain", name: "Connect Your Domain" },
  { categoryId: "website-content", categoryName: "Website & Content", moduleId: "documents-contracts", name: "Create and Manage Documents & Contracts" },
  { categoryId: "commerce", categoryName: "Commerce", moduleId: "first-product", name: "Launch Your First Product and Start Selling" },
  { categoryId: "commerce", categoryName: "Commerce", moduleId: "online-course", name: "Launch Your First Online Course and Start Earning" },
  { categoryId: "commerce", categoryName: "Commerce", moduleId: "stripe-payments", name: "Start Collecting Payments with Stripe" },
  { categoryId: "commerce", categoryName: "Commerce", moduleId: "payment-link", name: "Accept Payments Easily with a Custom Payment Link" },
  { categoryId: "commerce", categoryName: "Commerce", moduleId: "invoices", name: "Generate and Send Professional Invoices" },
  { categoryId: "commerce", categoryName: "Commerce", moduleId: "automated-payments", name: "How to Make Automated Payment Processes & Automations" },
  { categoryId: "ai-tools", categoryName: "AI & Automation Tools", moduleId: "voice-ai-agent", name: "How to Create Your First Voice AI Agent" },
  { categoryId: "ai-tools", categoryName: "AI & Automation Tools", moduleId: "conversation-ai-appointments", name: "Book Appointments through Conversation AI" },
  { categoryId: "ai-tools", categoryName: "AI & Automation Tools", moduleId: "ai-studio-vibe-coding", name: "AI Studio: Vibe Coding" },
  { categoryId: "ai-tools", categoryName: "AI & Automation Tools", moduleId: "automations-101-workflows", name: "Automations 101: Workflows" },
];

/** Player id the live hub expands. `mobile-app` is the catalogue id; the player lesson is `mobile-app-walkthrough`. */
const HUB_PLAYBACK_MODULE_IDS: Record<string, string> = {
  "mobile-app": "mobile-app-walkthrough",
};

function catalogModuleId(moduleId: string): string {
  const entry = Object.entries(HUB_PLAYBACK_MODULE_IDS).find(([, hubId]) => hubId === moduleId);
  return entry ? entry[0] : moduleId;
}

function playbackModuleId(moduleId: string): string {
  return HUB_PLAYBACK_MODULE_IDS[moduleId] ?? moduleId;
}

export function linkedVideoValue(categoryId: string, moduleId: string): string {
  return `${categoryId}:${playbackModuleId(moduleId)}`;
}

export type LinkedVideoResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function resolveLinkedVideo(
  raw: string | null | undefined,
  extraIds?: ReadonlySet<string>,
): LinkedVideoResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, error: "link_to is video but linked_video is empty. Pass a category:module id from get_education_videos." };
  }
  if (extraIds?.has(value)) return { ok: true, value };

  const colon = value.indexOf(":");
  if (colon > 0) {
    const categoryId = value.slice(0, colon);
    const moduleId = catalogModuleId(value.slice(colon + 1));
    const match = EDUCATION_MODULES.find((item) => item.categoryId === categoryId && item.moduleId === moduleId);
    if (!match) {
      return { ok: false, error: `Unknown education video "${value}". Use get_education_videos. Domain setup is website-content:connect-domain. scheduling is appointments, not domains.` };
    }
    return { ok: true, value: linkedVideoValue(match.categoryId, match.moduleId) };
  }

  const moduleId = catalogModuleId(value);
  const matches = EDUCATION_MODULES.filter((item) => item.moduleId === moduleId);
  if (matches.length === 1) return { ok: true, value: linkedVideoValue(matches[0].categoryId, matches[0].moduleId) };
  if (matches.length === 0) {
    return { ok: false, error: `Unknown education video "${value}". Use get_education_videos. Domain setup is website-content:connect-domain. Do not substitute another lesson.` };
  }
  return { ok: false, error: `Video "${value}" matches more than one lesson. Pass category:module.` };
}

export function formatEducationCatalog(customVideos: Array<{ id: string; title: string }> = []): string {
  const groups = new Map<string, EducationModule[]>();
  for (const item of EDUCATION_MODULES) {
    const rows = groups.get(item.categoryName) ?? [];
    rows.push(item);
    groups.set(item.categoryName, rows);
  }
  const standard = [...groups.entries()]
    .map(([name, rows]) => `**${name}:**\n` + rows.map((row) => `  - "${row.name}" (linked_video: ${linkedVideoValue(row.categoryId, row.moduleId)})`).join("\n"))
    .join("\n\n");
  const custom = customVideos.length
    ? `\n\n**Custom Videos:**\n` + customVideos.map((video) => `  - "${video.title}" (linked_video: ${video.id})`).join("\n")
    : "";
  return standard + custom +
    `\n\nPass linked_video exactly as shown. website-content:connect-domain is Connect Your Domain. foundational-setup:scheduling is Book More Appointments. Never substitute one lesson for another.`;
}
