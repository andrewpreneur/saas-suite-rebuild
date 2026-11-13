import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  ListVideo,
  Route as RouteIcon,
  Headphones,
  Zap,
  Palette,
  Megaphone,
  Mail,
  Gift,
  Handshake,
  LayoutGrid,
  PhoneCall,
  Settings,
  Play,
  Sparkles,
  MousePointerClick,
} from "lucide-react";
import PageSEO from "@/components/PageSEO";

type Kind = "tab" | "view" | "button" | "toggle" | "field" | "section";
type Node = {
  name: string;
  kind?: Kind;
  children?: Node[];
};
type Root = {
  name: string;
  icon: any;
  path: string;
  group: "workspace" | "branding" | "footer";
  children?: Node[];
};

const NODES: Root[] = [
  {
    name: "Client Hub",
    icon: LayoutDashboard,
    path: "/app/client-hub",
    group: "workspace",
    children: [
      {
        name: "Header bar", kind: "section", children: [
          { name: "Plan switcher (Plan 1 / 2 / 3)", kind: "field" },
          { name: "Copy Plan URL", kind: "button" },
          { name: "Create Plan N URL", kind: "button" },
          { name: "Sync Plans", kind: "button", children: [
            { name: "Sync Plans dialog", kind: "section" },
          ]},
          { name: "Learn more", kind: "button", children: [
            { name: "Video embed panel", kind: "section" },
          ]},
          { name: "Installation Guide", kind: "button", children: [
            { name: "Installation Guide dialog", kind: "section" },
          ]},
        ],
      },
      {
        name: "Live Preview tab switcher", kind: "toggle", children: [
          { name: "Education tab (Pencil = rename)", kind: "tab" },
          { name: "Home tab (Pencil = rename)", kind: "tab" },
          { name: "Support tab (Pencil = rename)", kind: "tab" },
          { name: "Popup tab", kind: "tab" },
          { name: "Brand color swatch (Primary/Sec/Ter)", kind: "button", children: [
            { name: "Edit Brand Colors dialog", kind: "section", children: [
              { name: "3 ColorPickers + Save", kind: "field" },
            ]},
          ]},
        ],
      },
      {
        name: "Education panel", kind: "section", children: [
          { name: "Quick Set Up preset pills", kind: "section", children: [
            { name: "CRM", kind: "toggle" },
            { name: "Payments", kind: "toggle" },
            { name: "Websites & Automations", kind: "toggle" },
            { name: "Sales", kind: "toggle" },
            { name: "Courses", kind: "toggle" },
          ]},
          { name: "Learning Modules list", kind: "section", children: [
            { name: "Eye toggle per category", kind: "toggle" },
            { name: "Click row → load videos", kind: "button" },
            { name: "Add Module", kind: "button", children: [
              { name: "Create Custom Module dialog", kind: "section", children: [
                { name: "Module name input + Save", kind: "field" },
              ]},
            ]},
          ]},
          { name: "Video list (selected module)", kind: "section", children: [
            { name: "Add Custom Video", kind: "button", children: [
              { name: "Inline form: title / desc / URL / embed switch / plan checkboxes", kind: "field" },
            ]},
            { name: "Show/Hide switch per video", kind: "toggle" },
            { name: "Drag handle (reorder)", kind: "button" },
            { name: "Edit Custom Video (pencil)", kind: "button", children: [
              { name: "Edit dialog: title / desc / URL / embed checkbox", kind: "field" },
            ]},
            { name: "Delete Custom Video (trash)", kind: "button" },
          ]},
        ],
      },
      {
        name: "Home panel", kind: "section", children: [
          { name: "Quick Actions dropdown", kind: "button", children: [
            { name: "Customize Login", kind: "button", children: [
              { name: "Customize Login dialog", kind: "section", children: [
                { name: "Enable Login switch", kind: "toggle" },
                { name: "Method: Email / Name / Both", kind: "field" },
                { name: "Welcome Headline", kind: "field" },
                { name: "Welcome Subheadline", kind: "field" },
                { name: "Save Login Settings", kind: "button" },
              ]},
            ]},
            { name: "Add Checklist Item → scrolls & appends", kind: "button" },
            { name: "Daily Checklist → scroll to section", kind: "button" },
            { name: "Add Custom Video → jumps to Education", kind: "button" },
            { name: "Add Welcome Video → enable & scroll", kind: "button" },
            { name: "Add Announcement → enable & scroll", kind: "button" },
            { name: "Custom Links → scroll to section", kind: "button" },
          ]},
          { name: "Section 3-dot menu (each section)", kind: "button", children: [
            { name: "Hide / Show section", kind: "toggle" },
            { name: "Delete section", kind: "button" },
          ]},
          { name: "Welcome section", kind: "section", children: [
            { name: "Inline edit headline", kind: "field" },
            { name: "Inline edit subheadline", kind: "field" },
          ]},
          { name: "Announcement Bar", kind: "section", children: [
            { name: "Headline / paragraph inline edit", kind: "field" },
            { name: "Image placeholder", kind: "button", children: [
              { name: "Announcement Image dialog", kind: "section", children: [
                { name: "Upload file / Image URL + Save", kind: "field" },
              ]},
            ]},
          ]},
          { name: "Welcome Video", kind: "section", children: [
            { name: "URL / Embed Code toggle", kind: "toggle" },
            { name: "URL input or Embed textarea", kind: "field" },
          ]},
          { name: "Onboarding Checklist", kind: "section", children: [
            { name: "Per-item: title / description inline", kind: "field" },
            { name: "Link to: None / URL / Video", kind: "field" },
            { name: "Delete item (trash)", kind: "button" },
            { name: "Add checklist item", kind: "button" },
          ]},
          { name: "What to do next", kind: "section", children: [
            { name: "Enable toggle", kind: "toggle" },
            { name: "Prioritize: Videos / Checklist / Text / URL", kind: "field" },
          ]},
          { name: "Daily Checklist", kind: "section", children: [
            { name: "Title (inline)", kind: "field" },
            { name: "Enable toggle", kind: "toggle" },
            { name: "3 task inputs", kind: "field" },
            { name: "Save Daily Checklist", kind: "button" },
          ]},
          { name: "Custom Buttons & Links", kind: "section", children: [
            { name: "Label / URL / Color per slot", kind: "field" },
            { name: "Trash (clear slot)", kind: "button" },
            { name: "Add custom button or link", kind: "button" },
          ]},
          { name: "Save Home Settings", kind: "button" },
        ],
      },
      {
        name: "Support panel", kind: "section", children: [
          { name: "Purchase a Customer Support Rep", kind: "button", children: [
            { name: "Upgrade dialog → payment link", kind: "section" },
          ]},
          { name: "Welcome text (inline headline/sub)", kind: "field" },
          { name: "Support Links (up to 3)", kind: "section", children: [
            { name: "Text / URL / Color per link", kind: "field" },
            { name: "Trash (clear)", kind: "button" },
            { name: "Add Support Link", kind: "button" },
          ]},
          { name: "AI Chat Support (Advanced)", kind: "section", children: [
            { name: "AI Chat enable switch", kind: "toggle" },
            { name: "Import Default Prompts", kind: "button", children: [
              { name: "Overwrite confirm dialog (type CONFIRM)", kind: "section" },
            ]},
            { name: "Personality / Goals / Instructions", kind: "field" },
            { name: "Training Doc URL", kind: "field" },
            { name: "Onboarding Doc URL (copy)", kind: "button" },
            { name: "Transcribe N custom videos", kind: "button", children: [
              { name: "Preflight results dialog", kind: "section" },
              { name: "View N failures dialog", kind: "section" },
            ]},
            { name: "AI Chat icon (phone preview)", kind: "button", children: [
              { name: "Set AI Chat Icon dialog", kind: "section", children: [
                { name: "Image URL / Upload + Use this icon", kind: "field" },
              ]},
            ]},
            { name: "Inline rename assistant name", kind: "field" },
          ]},
          { name: "Save Support Settings", kind: "button" },
          { name: "Customer Communications", kind: "section", children: [
            { name: "Tickets / AI Conversations switch", kind: "toggle" },
            { name: "Enable Support Ticketing switch", kind: "toggle" },
            { name: "Tickets table → Status Select per row", kind: "field" },
            { name: "AI Conversations → Chat Intervention", kind: "section", children: [
              { name: "Refresh contacts", kind: "button" },
              { name: "Select contact → thread", kind: "button" },
              { name: "Send owner message", kind: "button" },
            ]},
          ]},
          { name: "Inbound Webhook URL", kind: "section", children: [
            { name: "Save webhook", kind: "button" },
            { name: "Test webhook", kind: "button" },
          ]},
          { name: "Voice AI Support (Advanced)", kind: "section", children: [
            { name: "6 endpoint URLs (copy each)", kind: "button" },
            { name: "Label input + Generate Key", kind: "button", children: [
              { name: "One-time key banner + Copy + I've saved it", kind: "field" },
            ]},
            { name: "Revoke key", kind: "button" },
            { name: "Delete key (trash)", kind: "button" },
          ]},
        ],
      },
      {
        name: "Popup panel", kind: "section", children: [
          { name: "Enable Popup switch", kind: "toggle" },
        ],
      },
      {
        name: "V2 / V3 toggle (when available)", kind: "toggle",
      },
    ],
  },
  {
    name: "Dashboard",
    icon: BarChart3,
    path: "/app/dashboard",
    group: "workspace",
    children: [
      { name: "Activity Metrics", kind: "section" },
      { name: "SaaS Health", kind: "section", children: [
        { name: "User Status Tags", kind: "field" },
      ]},
      { name: "Clients Manager", kind: "section", children: [
        { name: "Invite Client", kind: "button" },
        { name: "Edit Client", kind: "button" },
        { name: "Remove Client", kind: "button" },
      ]},
    ],
  },
  {
    name: "Knowledge Base",
    icon: BookOpen,
    path: "/app/knowledge-base",
    group: "workspace",
    children: [
      { name: "Primary / Secondary / Tertiary Colors", kind: "field" },
      { name: "Categories list", kind: "section", children: [
        { name: "Fetch Articles", kind: "button" },
      ]},
      { name: "Manage Hidden Items", kind: "button" },
    ],
  },
  {
    name: "Simplified Onboarding",
    icon: ListVideo,
    path: "/app/simple-onboarding",
    group: "workspace",
    children: [
      { name: "Installation Guide", kind: "section", children: [
        { name: "Copy Custom CSS", kind: "button" },
        { name: "Add Menu Link ID (Plan 2 / Plan 3)", kind: "field" },
      ]},
      { name: "Custom Videos panel", kind: "section" },
      { name: "Advanced Mode toggle", kind: "toggle" },
      { name: "Onboarding Checklist panel", kind: "section" },
    ],
  },
  {
    name: "Workflows",
    icon: RouteIcon,
    path: "/app/workflows",
    group: "workspace",
    children: [
      { name: "Add Workflow", kind: "button", children: [
        { name: "Pick Trigger", kind: "section", children: [
          { name: "User completed video", kind: "field" },
          { name: "Existing user logged in", kind: "field" },
          { name: "New user logged in", kind: "field" },
          { name: "Onboarding checklist completed", kind: "field" },
          { name: "Engaged with AI Support", kind: "field" },
          { name: "Requested Human Handover", kind: "field" },
        ]},
        { name: "Set Webhook URL", kind: "field" },
      ]},
      { name: "Test Webhook", kind: "button" },
    ],
  },
  {
    name: "Snapshots",
    icon: LayoutGrid,
    path: "/app/snapshots",
    group: "workspace",
    children: [
      { name: "Snapshot Library", kind: "section" },
      { name: "Import Guide", kind: "section" },
    ],
  },
  {
    name: "Onboarding Calls",
    icon: PhoneCall,
    path: "/app/onboarding-calls",
    group: "workspace",
    children: [
      { name: "Purchase Calls", kind: "button" },
      { name: "Book a Call", kind: "button" },
      { name: "Call History", kind: "section" },
    ],
  },
  {
    name: "Menu Link Removal",
    icon: Zap,
    path: "/app/streamline",
    group: "branding",
    children: [
      { name: "Let AI Determine What to Keep", kind: "button" },
      { name: "Pick Menu Links Manually", kind: "button", children: [
        { name: "Toggle features", kind: "field" },
        { name: "Copy generated CSS", kind: "button" },
      ]},
      { name: "Auto-Remove Rules", kind: "button", children: [
        { name: "Copy Rule", kind: "button" },
      ]},
    ],
  },
  {
    name: "Branding Tool",
    icon: Palette,
    path: "/app/branding",
    group: "branding",
    children: [
      { name: "Classic Branding", kind: "section" },
      { name: "V2 Branding", kind: "section", children: [
        { name: "Colors / Fonts", kind: "field" },
        { name: "Login Customization", kind: "field" },
        { name: "Button Customization", kind: "field" },
      ]},
      { name: "Add-on Customizations", kind: "section", children: [
        { name: "Simple Mode tab", kind: "tab" },
        { name: "Advanced Mode tab", kind: "tab" },
      ]},
    ],
  },
  {
    name: "AI Marketing",
    icon: Megaphone,
    path: "/app/marketing",
    group: "branding",
    children: [
      { name: "AI Ad tab", kind: "tab", children: [
        { name: "Generate Ad", kind: "button" },
      ]},
      { name: "AI Offer tab", kind: "tab", children: [
        { name: "Generate Offer", kind: "button" },
      ]},
      { name: "AI Email tab", kind: "tab", children: [
        { name: "Generate Email Sequence", kind: "button" },
      ]},
    ],
  },
  {
    name: "Email Warmup",
    icon: Mail,
    path: "/app/email-warmup",
    group: "branding",
    children: [
      { name: "Submit Warmup Request", kind: "button" },
      { name: "28-Day Progress Tracker", kind: "section" },
    ],
  },
  {
    name: "My Free Leads",
    icon: Gift,
    path: "/app/free-leads",
    group: "branding",
    children: [
      { name: "Choose Categories", kind: "field" },
      { name: "Submit Request", kind: "button" },
      { name: "Fulfillment Status", kind: "section" },
    ],
  },
  {
    name: "Affiliate Dashboard",
    icon: Handshake,
    path: "/app/affiliate-dashboard",
    group: "branding",
    children: [
      { name: "Copy Referral Link", kind: "button" },
      { name: "Commissions", kind: "section" },
      { name: "Create Coupon Code", kind: "button" },
    ],
  },
  {
    name: "Walkthrough",
    icon: Play,
    path: "/app/walkthrough",
    group: "footer",
    children: [
      { name: "Start Interactive Tour", kind: "button" },
      { name: "Video Guides", kind: "section" },
    ],
  },
  {
    name: "Settings",
    icon: Settings,
    path: "/app/settings",
    group: "footer",
    children: [
      { name: "Profile tab", kind: "tab", children: [
        { name: "Save Profile", kind: "button" },
      ]},
      { name: "Admins tab", kind: "tab", children: [
        { name: "Invite Admin", kind: "button" },
        { name: "Remove Admin", kind: "button" },
      ]},
      { name: "Billing tab", kind: "tab", children: [
        { name: "Manage in Stripe", kind: "button" },
        { name: "Upgrade / Downgrade Plan", kind: "button" },
      ]},
      { name: "Custom Domain tab", kind: "tab", children: [
        { name: "Submit Custom Domain", kind: "button" },
      ]},
    ],
  },
];

const GROUP_LABEL: Record<string, string> = {
  workspace: "Workspace",
  branding: "Branding & Marketing",
  footer: "Account",
};

const GROUP_ACCENT: Record<string, string> = {
  workspace: "from-primary/80 to-primary",
  branding: "from-fuchsia-500/70 to-purple-600",
  footer: "from-slate-400 to-slate-600",
};

const KIND_STYLES: Record<Kind, string> = {
  tab:     "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300",
  view:    "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300",
  button:  "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  toggle:  "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  field:   "border-border bg-card text-foreground/80",
  section: "border-border bg-muted/40 text-foreground",
};
const KIND_LABEL: Record<Kind, string> = {
  tab: "TAB",
  view: "VIEW",
  button: "BUTTON",
  toggle: "TOGGLE",
  field: "FIELD",
  section: "SECTION",
};

function NodeCard({ node }: { node: Node }) {
  const kind = node.kind ?? "section";
  return (
    <div
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs shadow-sm ${KIND_STYLES[kind]}`}
    >
      {kind === "button" && <MousePointerClick className="h-3 w-3 opacity-70" />}
      <span className="font-medium">{node.name}</span>
      <span className="rounded-sm bg-background/60 px-1 text-[9px] font-semibold uppercase tracking-wider opacity-70">
        {KIND_LABEL[kind]}
      </span>
    </div>
  );
}

function HTree({ node }: { node: Node }) {
  const hasKids = node.children && node.children.length > 0;
  return (
    <div className="flex items-center gap-4">
      <NodeCard node={node} />
      {hasKids && (
        <div className="relative flex flex-col gap-2 py-1 pl-4">
          {/* vertical spine */}
          <span className="absolute left-0 top-1/2 h-[calc(100%-2.75rem)] -translate-y-1/2 border-l border-dashed border-border" />
          {node.children!.map((child, i) => (
            <div key={i} className="relative">
              {/* elbow into this child */}
              <span className="absolute -left-4 top-1/2 w-4 border-t border-dashed border-border" />
              <HTree node={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RootRow({ node }: { node: Root }) {
  const Icon = node.icon;
  const accent = GROUP_ACCENT[node.group];
  return (
    <div className="flex items-stretch gap-4">
      {/* Sidebar bar */}
      <Link
        to={node.path}
        className="group relative flex w-[220px] flex-shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
      >
        <span className={`absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b ${accent}`} />
        <Icon className="ml-1 h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        <span className="text-sm font-semibold text-foreground">{node.name}</span>
      </Link>

      {/* Connector from bar into tree */}
      <div className="flex items-center">
        <span className="w-6 border-t border-dashed border-border" />
      </div>

      {/* Tree */}
      <div className="flex flex-col gap-3 py-2">
        {node.children?.map((c, i) => (
          <HTree key={i} node={c} />
        ))}
      </div>
    </div>
  );
}

export default function Hierarchy() {
  const groups: Array<Root["group"]> = ["workspace", "branding", "footer"];
  return (
    <div className="min-h-screen bg-gradient-background">
      <PageSEO
        title="App Hierarchy — SaaSSuite Navigation Map"
        description="Visual map of every SaaSSuite tab and feature — see how to navigate the entire app at a glance."
        path="/hierarchy"
      />
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:py-14">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Navigation Map
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            SaaSSuite App Hierarchy
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Each bar on the left is a sidebar tab. Follow the branches to the
            right — every node is one button click, tab, or toggle away from
            the node that spawned it. Click a bar to jump into that tool.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {(["section","tab","button","toggle","field"] as Kind[]).map((k) => (
              <span key={k} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${KIND_STYLES[k]}`}>
                <span className="text-[9px] font-semibold uppercase tracking-wider">{KIND_LABEL[k]}</span>
              </span>
            ))}
          </div>
        </header>

        {groups.map((g) => {
          const items = NODES.filter((n) => n.group === g);
          if (!items.length) return null;
          return (
            <section key={g} className="mb-12">
              <div className="mb-4 flex items-center gap-3">
                <span className={`h-3 w-1 rounded-full bg-gradient-to-b ${GROUP_ACCENT[g]}`} />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABEL[g]}
                </h2>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/40 p-4">
                <div className="min-w-max space-y-6">
                  {items.map((node) => (
                    <RootRow key={node.name} node={node} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Not seeing a tab? Availability depends on your plan (Starter, Basic,
          Advanced) and enabled bonuses.
        </footer>
      </div>
    </div>
  );
}