export const COPILOT_SUGGESTIONS = {
  setup: [
    "Have you already installed your custom menu link?",
    "Let's set up your agency branding",
    "Create your Plan 1 URL",
    "Show me my installation status",
  ],
  features: [
    "Enable support ticketing for my customers",
    "Turn on AI Chat Support",
    "Configure my welcome section",
    "Enable the daily checklist feature",
    "Set up login tracking",
  ],
  customization: [
    "Change my primary brand color",
    "Update the welcome headline",
    "Add an item to the onboarding checklist",
    "Rename my tab names",
    "Update my login page text",
  ],
  support: [
    "Set up the inbound webhook for tickets",
    "Configure my Native AI personality",
    "Customize the support tab buttons",
    "Enable announcements",
  ],
};

export const INITIAL_GREETING = `👋 Hi! I'm your SaaSSuite CoPilot.

I can help you configure and manage your entire SaaSSuite platform through conversation. Just tell me what you'd like to do!

Here are some things I can help with:
- **Toggle features** - Support ticketing, AI chat, daily checklist, and more
- **Customize branding** - Colors, welcome text, videos
- **Manage settings** - Login settings, support configuration, tab names
- **Set up checklists** - Onboarding and daily checklists

What would you like to configure today?`;

export const getAllSuggestions = (): string[] => {
  return [
    ...COPILOT_SUGGESTIONS.setup,
    ...COPILOT_SUGGESTIONS.features,
    ...COPILOT_SUGGESTIONS.customization,
    ...COPILOT_SUGGESTIONS.support,
  ];
};

export const getRandomSuggestions = (count: number = 4): string[] => {
  const all = getAllSuggestions();
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};
