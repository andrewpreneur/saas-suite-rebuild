export interface VideoModule {
  id: string;
  name: string;
}

export interface VideoCategory {
  id: string;
  name: string;
  modules: VideoModule[];
}

export const VIDEO_CATEGORIES: VideoCategory[] = [
  {
    id: "foundational-setup",
    name: "Foundational Setup",
    modules: [
      { id: "new-contact", name: "Create a New Contact" },
      { id: "configure-profile-billing", name: "Configure Your Profile & Billing" },
      { id: "mobile-app", name: "Mobile App Walkthrough" },
      { id: "import-contacts", name: "Import and engage with all your contacts instantly" },
      { id: "generate-leads", name: "Generate New Leads with a High-Converting Funnel" },
      { id: "multi-channel", name: "Set Up Multi-Channel Communication & Start Engaging in Minutes" },
      { id: "first-campaign", name: "Launch Your First Campaign to Drive Engagement" },
      { id: "drip-campaigns", name: "Nurture Leads with Automated Drip Campaigns" },
      { id: "scheduling", name: "Book More Appointments with Automated Scheduling" },
      { id: "sales-pipeline", name: "Accelerate Deal Closures with a Streamlined Sales Pipeline" }
    ]
  },
  {
    id: "marketing-lead-generation",
    name: "Marketing & Lead Generation",
    modules: [
      { id: "social-media-planner", name: "Manage All Your Social Media Posts in One Place" },
      { id: "facebook-lead-ads", name: "Capture New Leads with Facebook & Instagram Lead Ads" },
      { id: "sms-campaign", name: "Reach Customers with Your First SMS Campaign" }
    ]
  },
  {
    id: "sales-conversation", 
    name: "Sales & Conversation",
    modules: [
      { id: "email-sync", name: "Seamlessly Manage Your Sales Conversations" },
      { id: "live-chat", name: "Engage Website Visitors in Real Time with Live Chat" },
      { id: "social-messaging", name: "Streamline Facebook & Instagram Conversations for Faster Response" },
      { id: "a2p-registration", name: "A2P Registration: How to Verify Your Phone Number" }
    ]
  },
  {
    id: "website-content",
    name: "Website & Content", 
    modules: [
      { id: "professional-website", name: "Launch a Professional Website in Less Than a Day" },
      { id: "wordpress-migration", name: "Migrate Your WordPress Site Seamlessly" },
      { id: "connect-domain", name: "Connect Your Domain" },
      { id: "documents-contracts", name: "Create and Manage Documents & Contracts" }
    ]
  },
  {
    id: "commerce",
    name: "Commerce",
    modules: [
      { id: "first-product", name: "Launch Your First Product and Start Selling" },
      { id: "online-course", name: "Launch Your First Online Course and Start Earning" },
      { id: "stripe-payments", name: "Start Collecting Payments with Stripe" },
      { id: "payment-link", name: "Accept Payments Easily with a Custom Payment Link" },
      { id: "invoices", name: "Generate and Send Professional Invoices" },
      { id: "automated-payments", name: "How to Make Automated Payment Processes & Automations" }
    ]
  },
  {
    id: "ai-tools",
    name: "AI & Automation Tools",
    modules: [
      { id: "voice-ai-agent", name: "How to Create Your First Voice AI Agent" },
      { id: "conversation-ai-appointments", name: "Book Appointments through Conversation AI" },
      { id: "ai-studio-vibe-coding", name: "AI Studio: Vibe Coding" },
      { id: "automations-101-workflows", name: "Automations 101: Workflows" }
    ]
  }
];

// Helper to get video categories with count labels for UI
export const getVideoCategoriesWithCounts = (): VideoCategory[] => {
  return VIDEO_CATEGORIES.map(category => ({
    ...category,
    name: `${category.name} (${category.modules.length} videos)`
  }));
};

/** Hub player id when it differs from the catalogue id. Checklist links must use the player id or the step does not expand. */
const HUB_PLAYBACK_MODULE_IDS: Record<string, string> = {
  "mobile-app": "mobile-app-walkthrough",
};

export function catalogModuleId(moduleId: string): string {
  const entry = Object.entries(HUB_PLAYBACK_MODULE_IDS).find(([, hubId]) => hubId === moduleId);
  return entry ? entry[0] : moduleId;
}

/** Lesson name for a stored checklist link (`category:module`, a bare module id, or the hub playback id). */
export function linkedVideoLabel(videoId: string): string | null {
  const raw = videoId.trim();
  if (!raw) return null;
  if (!raw.includes(":")) {
    const moduleId = catalogModuleId(raw);
    for (const category of VIDEO_CATEGORIES) {
      const module = category.modules.find((item) => item.id === moduleId);
      if (module) return module.name;
    }
    return null;
  }
  const [categoryId, moduleRaw] = raw.split(":");
  const moduleId = catalogModuleId(moduleRaw);
  const category = VIDEO_CATEGORIES.find((item) => item.id === categoryId);
  return category?.modules.find((item) => item.id === moduleId)?.name ?? null;
}
