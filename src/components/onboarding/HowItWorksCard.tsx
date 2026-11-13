import { Link2, Code2, RefreshCw } from "lucide-react";

const STEPS = [
  {
    icon: Link2,
    title: "1. Menu links",
    body: "Add one Custom Menu Link per plan in HighLevel (Plan 1, Plan 2, Plan 3). Each link opens that plan's Client Hub, so sub-accounts on different plans see the right content.",
  },
  {
    icon: Code2,
    title: "2. JavaScript + CSS",
    body: "Paste the install code once in HighLevel → Settings → Company → Custom JS/CSS. It loads your branding, hides or reorders menu links, and places the widgets.",
  },
  {
    icon: RefreshCw,
    title: "3. Updates push automatically",
    body: "After install, every change you save in SaaS Suite is served live to HighLevel — no re-pasting. Users just hard refresh (Ctrl/Cmd + Shift + R) to see it.",
  },
];

export default function HowItWorksCard() {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5" data-tour="install-how-it-works">
      <h3 className="font-semibold mb-3">How the install works</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
