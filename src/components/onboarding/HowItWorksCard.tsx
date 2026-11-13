import { Link2, Code2, RefreshCw } from "lucide-react";
import { Reveal, RevealItem } from "@/components/premium/Reveal";

const STEPS = [
  {
    icon: Link2,
    title: "Menu links",
    body: "Add one Custom Menu Link per plan in HighLevel (Plan 1, Plan 2, Plan 3). Each link opens that plan's Client Hub, so sub-accounts on different plans see the right content.",
  },
  {
    icon: Code2,
    title: "JavaScript and CSS",
    body: "Paste the install code once in HighLevel → Settings → Company → Custom JS/CSS. It loads your branding, hides or reorders menu links, and places the widgets.",
  },
  {
    icon: RefreshCw,
    title: "Updates push on their own",
    body: "After install, every change you save in SaaS Suite is served live to HighLevel, with no re-pasting. Users just hard refresh (Ctrl/Cmd + Shift + R) to see it.",
  },
];

export default function HowItWorksCard() {
  return (
    <section className="px-surface p-4 sm:p-6" data-tour="install-how-it-works">
      <h3 className="text-base font-semibold text-foreground">How the install works</h3>
      <p className="mt-0.5 text-small text-muted-foreground">
        Three parts. You only do the first two once.
      </p>
      <Reveal className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <RevealItem key={title} className="relative rounded-lg bg-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="px-icon-chip bg-card" aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <span className="px-eyebrow">Step {i + 1}</span>
            </div>
            <p className="text-body font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-small leading-relaxed text-muted-foreground">{body}</p>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}
