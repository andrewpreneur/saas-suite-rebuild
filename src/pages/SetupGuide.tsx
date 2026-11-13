import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Code2,
  ExternalLink,
  Filter,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  ListChecks,
  MessageSquare,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import PageSEO from "@/components/PageSEO";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import saassuiteLogo from "@/assets/saassuitelogo-dark.png";
import { installSnippets } from "@/lib/installSnippets";

type Icon = typeof BookOpen;

type FeatureRow = {
  feature: string;
  starter: string;
  basic: string;
  advanced: string;
};

type GuideSection = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
  icon: Icon;
  accent: "primary" | "success" | "offer" | "heart";
  bullets: string[];
  steps?: string[];
  details?: { title: string; body: string }[];
  callout?: string;
  cta?: { label: string; href: string };
};

const sections: GuideSection[] = [
  {
    id: "start-here",
    label: "Start here",
    eyebrow: "Orientation",
    title: "Know what SaaSSuite controls before you install anything",
    summary:
      "SaaSSuite is the layer your agency uses to teach, guide, support, and track HighLevel customers from one owner dashboard.",
    icon: LayoutDashboard,
    accent: "primary",
    bullets: [
      "The Dashboard is for the agency owner and team: activity, client progress, open support, installation status, announcements, and quick actions.",
      "The Client Hub is what customers see inside HighLevel: welcome content, onboarding videos, checklists, support, links, and next steps.",
      "Admins who are invited to an account land directly in the platform; agency owners are the people who should complete setup.",
      "The walkthrough video lives on the SaaSSuite Walkthrough page, and the interactive tour introduces the main dashboard areas after sign-in.",
    ],
    steps: [
      "Open the walkthrough video so you understand the owner dashboard and Client Hub.",
      "Create the HighLevel custom menu link for your Client Hub.",
      "Install the dynamic Custom JS and Custom CSS lines one time in HighLevel Agency View.",
      "Customize Home, Education, Support, and Theme in Client Hub.",
      "Send one internal client through the Hub before announcing it to customers.",
    ],
    cta: { label: "Open SaaSSuite", href: "/login" },
  },
  {
    id: "installation",
    label: "Install in HighLevel",
    eyebrow: "One-time setup",
    title: "Install the Client Hub menu link, CSS, and JavaScript",
    summary:
      "HighLevel needs one custom menu link and two agency-level code lines. After that, SaaSSuite changes sync without re-copying code.",
    icon: Code2,
    accent: "success",
    bullets: [
      "Create the Client Hub link in a HighLevel sub-account under Settings → Custom Menu Link, using the Hub URL shown in SaaSSuite.",
      "Copy the menu-link ID from HighLevel and save it in SaaSSuite so the link can be reordered, highlighted, and used for login navigation.",
      "Paste the JavaScript line in HighLevel Agency View → Settings → Company → White Label → Custom JS.",
      "Paste the CSS import as the first line in White Label → Custom CSS.",
      "Dynamic installation is the default. It lets menu changes, LaunchPad replacement, auto-navigation, and widget updates reflect within about five minutes.",
    ],
    steps: [
      "In SaaSSuite, open Client Hub → Installation Guide or run the onboarding setup wizard.",
      "Copy the Client Hub URL, then create a HighLevel custom menu link named Onboarding, Training, or Client Hub.",
      "Save the HighLevel menu-link ID in SaaSSuite. Use the exact ID from the custom menu link URL.",
      "In HighLevel Agency View, paste the dynamic JavaScript into Custom JS and the dynamic CSS import into Custom CSS.",
      "Save HighLevel, refresh a sub-account, and confirm the menu link opens your Client Hub.",
    ],
    details: [
      {
        title: "Dynamic JavaScript placeholder",
        body: installSnippets("YOUR_AGENCY_ID").js,
      },
      {
        title: "Dynamic CSS placeholder",
        body: "@import url('https://backend-disconnected.invalid/functions/v1/dynamic-styles?agency_id=YOUR_AGENCY_ID&type=css');",
      },
      {
        title: "Where the code goes",
        body: "HighLevel Agency View → Settings → Company → White Label → Custom JS and Custom CSS. Do not paste these into a single sub-account's page builder.",
      },
    ],
    callout:
      "Use only the code shown inside your own SaaSSuite account. The placeholders here are examples and should never be installed as-is.",
  },
  {
    id: "platform-map",
    label: "How it works",
    eyebrow: "Platform map",
    title: "The owner tools and client tools work together",
    summary:
      "SaaSSuite separates agency operations from the customer-facing Hub so owners can manage everything without exposing internal settings.",
    icon: BookOpen,
    accent: "offer",
    bullets: [
      "Dashboard tracks users, logins, onboarding completions, open tickets, chat activity, and setup status.",
      "Client Hub Manager controls what customers see across Home, Education, Support, Popup, and Theme.",
      "Education controls standard videos, uploaded videos, categories, ordering, and plan-specific lesson visibility.",
      "Settings holds profile, invited admins, team permissions, billing, custom domain, Slack, and external platform connections.",
      "Community includes the Academy, Snapshot Vault, prompts, skills, ideas, feed, and a way to message the SaaSSuite team.",
    ],
    details: [
      {
        title: "Owners vs admins",
        body: "Owners manage the account and setup. Admins can be invited for day-to-day work and can be limited by area, assignment, and permission level.",
      },
      {
        title: "Plan-specific Hubs",
        body: "Advanced accounts can maintain different onboarding experiences for multiple SaaS plan levels while sharing the same install foundation.",
      },
    ],
  },
  {
    id: "onboarding-education",
    label: "Onboarding & education",
    eyebrow: "Client experience",
    title: "Customize what customers learn first",
    summary:
      "Build the first-run experience customers see: welcome video, training library, checklists, helpful links, and next steps.",
    icon: GraduationCap,
    accent: "primary",
    bullets: [
      "Choose a welcome video from a URL, embed code, a standard training video, or one of your uploaded videos.",
      "Upload a thumbnail so the welcome video looks branded before the customer presses play.",
      "Turn training videos on or off, reorder them, and add custom videos or custom categories for your agency's process.",
      "Use onboarding checklists and daily checklists to guide customers through setup and repeatable account tasks.",
      "Add helpful links, announcements, custom next-step text, or a next-step button for calls, forms, communities, or documents.",
      "Customize login copy, login method, popups, colors, button style, and the Client Hub theme.",
    ],
    details: [
      {
        title: "Standard training categories",
        body: "Foundational Setup, Marketing & Lead Generation, Sales & Conversation, Website & Content, Commerce, and AI & Automation Tools.",
      },
      {
        title: "Simplified onboarding",
        body: "You can publish a cleaner video-only onboarding path when a customer only needs training and not the full Client Hub experience.",
      },
    ],
    cta: { label: "Open Client Hub", href: "/app/client-hub" },
  },
  {
    id: "support-customization",
    label: "Customize support",
    eyebrow: "AI, tickets, humans",
    title: "Decide how customers get help and who answers",
    summary:
      "Support settings control AI chat, human handoff, ticketing, support text, notifications, knowledge base behavior, and CRM updates.",
    icon: Headphones,
    accent: "heart",
    bullets: [
      "The original Client Hub AI Chat toggle controls whether customers see the AI support agent.",
      "Human Chat controls whether customers can reach a real person from chat.",
      "Handling mode decides whether your agency answers or SaaSSuite handles and responds for eligible Advanced accounts.",
      "Customize support tab headings, button text, agent name, bot icon, support prompts, training context, and ticket availability.",
      "Use the white-label knowledge base and article visibility settings to control what help content customers can read.",
      "Send support updates from your own CRM by adding the support updates webhook URL in the Notifications area. The Support Response email uses one fixed From address on your verified GoHighLevel sending domain so replies return to the ticket.",
    ],
    steps: [
      "Open Client Hub → Support.",
      "Set AI Chat, Human Chat, and ticketing visibility.",
      "Choose whether your agency handles support or SaaSSuite handles it where available.",
      "Customize the prompt, article visibility, buttons, and support wording.",
      "Configure notifications, Slack, and CRM webhooks so the right team sees new work.",
    ],
    callout:
      "If SaaSSuite Handles & Responds is active, customer support alerts route to the SaaSSuite handling path instead of your agency team alerts.",
  },
  {
    id: "ticketing",
    label: "Support ticketing",
    eyebrow: "Customer requests",
    title: "Tickets keep customer requests organized from intake to reply",
    summary:
      "Customers submit tickets from the support area; your team manages assignment, status, replies, files, and notifications from the owner support screen.",
    icon: Ticket,
    accent: "success",
    bullets: [
      "Customers submit a category, request text, contact details, and optional attachments.",
      "Tickets can be Open, In Progress, Responded, or Completed, and customer replies can reopen closed work when follow-up is needed.",
      "Owners and permitted admins can assign tickets, filter by assigned or unassigned work, reply, and attach response images.",
      "Default assignment can be owner, one person, round robin, or by ticket type with a separate chat fallback.",
      "Notification checkboxes choose Email and Slack delivery for chat assigned, ticket assigned, assigned updates, new unassigned chats, and new unassigned tickets.",
      "Webhook payloads include useful ticket, customer, account, agency, assignee, and reply context so CRM workflows can route updates correctly.",
      "Ticket emails use one fixed From address on the agency’s verified GoHighLevel sending domain, such as support@mail.youragency.com. A personal or Google Workspace From address, such as {{assigned_to_email}} or moe@agency.com, delivers the customer’s reply to that inbox.",
    ],
    steps: [
      "In the Support Response workflow triggered by the customer updates webhook, set From Email to one fixed address on a domain verified in GoHighLevel Email Services, such as support@mail.youragency.com.",
      "Set From Name to {{inboundWebhookRequest.assigned_to_name}}, then publish the workflow.",
      "Publish an Email Reply to SaaSSuite workflow: trigger Customer Replied, channel Email, allow re-entry, and POST to the agency inbound reply URL. That URL includes ?key=.",
      "In that webhook’s Custom Data, map customer_email, customer_name, and customer_reply to Message Body. Add ticket_number when you have the number, and subject so [#239] can be matched.",
      "Send a test ticket response to your own email, reply to it, and confirm the reply shows on the ticket in SaaSSuite.",
    ],
    details: [
      {
        title: "Common ticket types",
        body: "Technical Issue, Billing, Feature Request, Website Edits, Account Access, and Other.",
      },
      {
        title: "Manual assignment wins",
        body: "Once a customer has a rep, SaaSSuite keeps that person unless an owner or permitted admin changes it by hand.",
      },
      {
        title: "Support Response From Name",
        body: "{{inboundWebhookRequest.assigned_to_name}}",
      },
      {
        title: "Support Response From Email",
        body: "One fixed address on a verified GoHighLevel sending domain, such as support@mail.youragency.com.",
      },
    ],
    callout:
      "Customer replies return to the ticket when the email is sent from the verified GoHighLevel domain and the published Customer Replied workflow posts Message Body to the inbound reply URL.",
  },
  {
    id: "automation-growth",
    label: "Automation & growth",
    eyebrow: "Scale tools",
    title: "Use automation, branding, and reporting to improve the offer",
    summary:
      "SaaSSuite includes supporting tools for a cleaner HighLevel experience, branded presentation, customer health, and repeatable workflows.",
    icon: WandSparkles,
    accent: "offer",
    bullets: [
      "Menu Link Removal hides unnecessary HighLevel sidebar links globally or by sub-account, with presets you can pause, copy, or delete.",
      "Branding Tool customizes HighLevel visuals such as colors, fonts, login styling, button styling, and generated branding CSS.",
      "Workflows can trigger webhooks when customers complete videos, log in, complete checklist items, engage AI support, or request human help.",
      "SaaS Health, login tracking, onboarding tracking, and client lists help owners spot adoption and follow-up opportunities.",
      "Affiliate Dashboard, Community, Academy resources, prompts, skills, snapshots, release announcements, and optional onboarding calls support growth.",
    ],
    callout:
      "The AI Offer & Ads Tool is still listed in older pricing copy, but it is currently hidden in the app and should not be treated as an active customer tool.",
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    eyebrow: "Fix common issues",
    title: "Most setup issues come from link IDs, code placement, or stale HighLevel pages",
    summary:
      "Use these checks before rebuilding anything. Dynamic install is designed so most fixes happen inside SaaSSuite, then sync to HighLevel.",
    icon: CircleHelp,
    accent: "heart",
    bullets: [
      "If the Hub menu link is missing, confirm the custom menu link exists in the target HighLevel sub-account and the saved URL opens the Hub.",
      "If the menu link does not move or LaunchPad still shows, confirm the saved menu-link ID exactly matches the HighLevel custom menu link ID.",
      "If styling looks old, wait up to five minutes, hard refresh HighLevel, and confirm the dynamic CSS import is the first line in Custom CSS.",
      "If auto-navigation does not run, confirm the dynamic JS line is in Agency View White Label Custom JS, not in a page builder or sub-account-only area.",
      "If support is hidden, check AI Chat, Human Chat, Support Ticketing, and the customer's current plan/Human Chat handling mode.",
      "If notifications do not arrive, check the Notifications tab, Slack connection, assignment mode, and whether the account is handled by SaaSSuite instead of the agency.",
      "If a customer’s email reply never appears on the ticket, confirm From Email is a verified GoHighLevel sending-domain address, the Email Reply workflow is published with re-entry on, and Custom Data maps customer_reply to Message Body.",
    ],
    steps: [
      "Confirm the Hub URL opens in a private browser window.",
      "Confirm the HighLevel custom menu link ID matches SaaSSuite.",
      "Confirm Custom JS and Custom CSS were pasted in Agency View → White Label.",
      "Hard refresh HighLevel and wait for dynamic changes to sync.",
      "Use the owner Support screen to confirm tickets, assignments, and notification choices.",
    ],
  },
];

const featureRows: FeatureRow[] = [
  {
    feature: "Client Hub and Dashboard",
    starter: "Included",
    basic: "Included",
    advanced: "Included",
  },
  {
    feature: "Brandless onboarding videos",
    starter: "25+ videos",
    basic: "25+ videos plus video toggles",
    advanced: "25+ videos plus plan-specific paths",
  },
  {
    feature: "Custom videos and checklists",
    starter: "Included",
    basic: "Included",
    advanced: "Included across custom plan experiences",
  },
  {
    feature: "White-label knowledge base",
    starter: "Included",
    basic: "Included",
    advanced: "Editor, widget, and article library",
  },
  {
    feature: "Support ticketing",
    starter: "Included",
    basic: "Included",
    advanced: "Included with advanced routing options",
  },
  {
    feature: "Users",
    starter: "Up to 1 user",
    basic: "Up to 5 users",
    advanced: "Unlimited users",
  },
  {
    feature: "Simplified onboarding",
    starter: "Not included",
    basic: "Included",
    advanced: "Included",
  },
  {
    feature: "Menu Link Removal",
    starter: "Not included",
    basic: "Included",
    advanced: "Included",
  },
  {
    feature: "Branding Tool",
    starter: "Not included",
    basic: "Included",
    advanced: "Included",
  },
  {
    feature: "AI chat support access",
    starter: "Not included",
    basic: "Included access",
    advanced: "Unlimited AI chat support",
  },
  {
    feature: "Human support handling",
    starter: "Agency handles",
    basic: "Agency handles",
    advanced: "Agency handles or SaaSSuite handles where enabled",
  },
  {
    feature: "Subaccounts",
    starter: "Starter limits apply",
    basic: "Basic limits apply",
    advanced: "Unlimited subaccounts",
  },
  {
    feature: "Custom SaaS plan onboarding experiences",
    starter: "One experience",
    basic: "One experience",
    advanced: "Three custom experiences",
  },
  {
    feature: "SaaS Health, login and onboarding tracking",
    starter: "Dashboard basics",
    basic: "Dashboard basics",
    advanced: "Advanced tracking and health tools",
  },
  {
    feature: "Workflows",
    starter: "Not included",
    basic: "Not included",
    advanced: "Included",
  },
  {
    feature: "Voice AI onboarding and support",
    starter: "Not included",
    basic: "Not included",
    advanced: "Included where configured",
  },
  {
    feature: "Community, Academy, prompts, skills, snapshots",
    starter: "Included",
    basic: "Included",
    advanced: "Included",
  },
  {
    feature: "Onboarding calls",
    starter: "Optional add-on when available",
    basic: "Included access",
    advanced: "Included access",
  },
  {
    feature: "Premium Support",
    starter: "Separate upgrade",
    basic: "Separate upgrade",
    advanced: "Separate support entitlement, not a separate software tier",
  },
];

const quickLinks = [
  { label: "Open app", href: "/login", icon: ArrowRight },
  { label: "Community", href: "/community", icon: Users },
  { label: "Pricing", href: "/pricing", icon: Sparkles },
];

const setupChecklist = [
  "Create the HighLevel custom menu link.",
  "Save the menu-link ID in SaaSSuite.",
  "Paste dynamic JS and CSS in HighLevel Agency View.",
  "Customize Home, Education, Support, Popup, and Theme.",
  "Invite admins and assign permissions only where needed.",
  "Configure default ticket/chat assignment and notifications.",
  "Review the client Hub on desktop and phone before launch.",
];

const accentClasses: Record<GuideSection["accent"], string> = {
  primary: "border-primary/20 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  offer: "border-offer/30 bg-offer/10 text-offer",
  heart: "border-heart/30 bg-heart/10 text-heart",
};

const sectionSearchText = (section: GuideSection) =>
  [
    section.label,
    section.eyebrow,
    section.title,
    section.summary,
    ...section.bullets,
    ...(section.steps || []),
    ...(section.details || []).flatMap((detail) => [detail.title, detail.body]),
    section.callout || "",
  ]
    .join(" ")
    .toLowerCase();

const SetupGuide = () => {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections.filter((section) => sectionSearchText(section).includes(normalizedQuery));
  }, [normalizedQuery]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "SaaSSuite Setup Guide",
    description:
      "A public knowledge base for installing, customizing, and operating SaaSSuite across onboarding, Client Hub, support, ticketing, and plan features.",
    author: { "@type": "Organization", name: "SaaSSuite" },
    publisher: { "@type": "Organization", name: "SaaSSuite" },
    mainEntityOfPage: "https://saassuite.ai/setup",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageSEO
        title="SaaSSuite Setup Guide — Installation, Client Hub & Support Docs"
        description="Learn how to install SaaSSuite, customize Client Hub onboarding and support, manage tickets, and compare Starter, Basic, and Advanced features."
        path="/setup"
        jsonLd={jsonLd}
      />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="SaaSSuite home">
            <img src={saassuiteLogo} alt="" className="h-9 w-9 rounded-md" />
            <div className="leading-tight">
              <span className="block text-sm font-bold">SaaSSuite</span>
              <span className="block text-xs text-muted-foreground">Setup Guide</span>
            </div>
          </Link>
          <nav className="hidden items-center gap-2 md:flex" aria-label="Setup guide quick links">
            {quickLinks.map((item) => {
              const IconComponent = item.icon;
              return (
                <Button key={item.label} asChild variant="ghost" size="sm">
                  <Link to={item.href}>
                    <IconComponent className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/70 bg-gradient-background">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
            <div className="animate-fade-in">
              <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                Public knowledge base
              </Badge>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Set up SaaSSuite from install to support launch
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                A complete, account-safe guide for installing SaaSSuite in HighLevel, customizing
                the Client Hub, managing onboarding, and running customer support.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-h-11">
                  <a href="#installation">
                    Start installation
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-h-11">
                  <a href="#plans">
                    Compare plans
                    <Filter className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 animate-fade-in lg:pt-6">
              <div className="rounded-lg border border-border/80 bg-card p-5 shadow-elevated">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">Recommended launch order</p>
                    <p className="text-sm text-muted-foreground">
                      Work from install to support, then launch.
                    </p>
                  </div>
                </div>
                <ol className="mt-5 space-y-3">
                  {setupChecklist.slice(0, 5).map((item, index) => (
                    <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Install pieces", value: "3", hint: "Hub link, JS, CSS" },
                  {
                    label: "Core areas",
                    value: "5",
                    hint: "Home, Education, Support, Popup, Theme",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border bg-card p-4 shadow-card"
                  >
                    <p className="text-3xl font-bold text-primary">{item.value}</p>
                    <p className="mt-1 text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 bg-card/35">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search setup, tickets, custom CSS, onboarding videos, Slack, plans..."
                className="h-11 rounded-lg pl-10"
                aria-label="Search setup guide"
              />
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-14">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-border bg-card p-4 shadow-card">
              <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                On this page
              </p>
              <nav className="space-y-1" aria-label="Setup guide sections">
                {sections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <IconComponent className="h-4 w-4" />
                      {section.label}
                    </a>
                  );
                })}
                <a
                  href="#plans"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Plans and features
                </a>
              </nav>
            </div>
          </aside>

          <div className="min-w-0 space-y-8">
            <div className="lg:hidden">
              <div
                className="flex gap-2 overflow-x-auto pb-2"
                aria-label="Setup guide mobile sections"
              >
                {[
                  ...sections,
                  { id: "plans", label: "Plans", icon: ShieldCheck } as GuideSection,
                ].map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
                    >
                      <IconComponent className="h-4 w-4" />
                      {section.label}
                    </a>
                  );
                })}
              </div>
            </div>

            {filteredSections.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-card">
                <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-3 text-xl font-semibold">
                  No guide sections matched that search
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Try searching for install, support, ticket, onboarding, branding, or Slack.
                </p>
              </div>
            ) : (
              filteredSections.map((section) => (
                <GuideSectionCard key={section.id} section={section} />
              ))
            )}

            <section
              id="plans"
              className="scroll-mt-24 rounded-lg border border-border bg-card shadow-elevated"
            >
              <div className="border-b border-border p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                      Plan guide
                    </Badge>
                    <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                      Starter, Basic, and Advanced features
                    </h2>
                    <p className="mt-2 max-w-3xl text-muted-foreground">
                      This table covers customer-facing SaaSSuite software access. Premium Support
                      is a separate support entitlement layered on top of Advanced access, not a
                      fourth software workspace.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link to="/pricing">
                      View pricing
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Feature</th>
                      <th className="px-5 py-3 font-semibold">Starter</th>
                      <th className="px-5 py-3 font-semibold">Basic</th>
                      <th className="px-5 py-3 font-semibold">Advanced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {featureRows.map((row) => (
                      <tr key={row.feature} className="align-top">
                        <th className="px-5 py-4 font-semibold text-foreground">{row.feature}</th>
                        <td className="px-5 py-4 text-muted-foreground">{row.starter}</td>
                        <td className="px-5 py-4 text-muted-foreground">{row.basic}</td>
                        <td className="px-5 py-4 text-muted-foreground">{row.advanced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-gradient-card p-5 shadow-elevated sm:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/10">
                    Launch checklist
                  </Badge>
                  <h2 className="mt-3 text-2xl font-bold">Before you send customers to the Hub</h2>
                  <p className="mt-2 text-muted-foreground">
                    Review the install, Hub presentation, support routing, and team permissions once
                    from the customer point of view.
                  </p>
                </div>
                <Button asChild size="lg" className="min-h-11 shrink-0">
                  <Link to="/login">
                    Open my dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {setupChecklist.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-md border border-border bg-background/70 p-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const GuideSectionCard = ({ section }: { section: GuideSection }) => {
  const IconComponent = section.icon;
  return (
    <section
      id={section.id}
      className="scroll-mt-24 rounded-lg border border-border bg-card shadow-card animate-fade-in"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border",
              accentClasses[section.accent],
            )}
          >
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {section.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{section.title}</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{section.summary}</p>
            {section.cta && (
              <Button asChild variant="outline" className="mt-4">
                <Link to={section.cta.href}>
                  {section.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              What to know
            </h3>
            <ul className="space-y-3">
              {section.bullets.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            {section.steps && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  Setup steps
                </h3>
                <ol className="space-y-3">
                  {section.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="leading-6">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {section.details?.map((detail) => (
              <div key={detail.title} className="rounded-lg border border-border bg-background p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  {detail.title.includes("placeholder") ? (
                    <Code2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Link2 className="h-4 w-4 text-primary" />
                  )}
                  {detail.title}
                </h3>
                <p className="mt-2 break-words font-mono text-xs leading-6 text-muted-foreground">
                  {detail.body}
                </p>
              </div>
            ))}

            {section.callout && (
              <div className="rounded-lg border border-offer/30 bg-offer/10 p-4 text-sm leading-6 text-muted-foreground">
                <div className="mb-1 flex items-center gap-2 font-semibold text-offer">
                  <Sparkles className="h-4 w-4" />
                  Note
                </div>
                {section.callout}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SetupGuide;
