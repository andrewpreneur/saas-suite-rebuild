import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { popIn } from "@/lib/motion";
import { StepHeading } from "@/components/premium/onboarding/OnboardingShell";
import { CheckDot, CopyField } from "@/components/premium/onboarding/pieces";
import { toast } from "sonner";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import { useHubUrls } from "@/lib/hubUrl";

interface MenuLinksStepProps {
  agencyId: string | null;
}

const MenuLinksStep = ({ agencyId }: MenuLinksStepProps) => {
  const { trackEvent } = useSessionTracker();
  const [copiedSub, setCopiedSub] = useState(false);
  const [installedSub, setInstalledSub] = useState(false);

  const hubUrlFor = useHubUrls([agencyId]);
  const v2Url = hubUrlFor(agencyId, "[your-agency-name]");

  const copyToClipboard = async (text: string, which: "sub") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
      setCopiedSub(true);
      trackEvent("menu_link_copied", `Copied ${which} menu link`, { url: text, which });
    } catch (err) {
      toast.error("Could not copy. Select the link and copy it by hand.");
      return false;
    }
  };

  const markInstalled = (which: "sub") => {
    setInstalledSub(true);
    trackEvent("menu_link_installed", `Marked ${which} menu link installed`, { which });
    toast.success("Menu link installed");
  };

  const STEPS = [
    <>
      In HighLevel, open a sub-account, then{" "}
      <strong className="font-semibold text-foreground">Settings</strong> and{" "}
      <strong className="font-semibold text-foreground">Custom Menu Link</strong>.
    </>,
    <>Create a new menu link and paste the link above as its URL.</>,
    <>Name it "Onboarding" or "Training".</>,
    <>Save, then refresh the page.</>,
  ];

  return (
    <div>
      <StepHeading
        title="Add your menu link"
        subtitle="This link opens your Client Hub inside HighLevel. Add it to every sub-account, or to one demo account to test first."
      />

      <div className="px-surface p-4 sm:p-6">
        <p className="px-eyebrow mb-2">Your Client Hub link</p>
        <CopyField
          value={v2Url}
          label="Copy your Client Hub link"
          onCopy={() => copyToClipboard(v2Url, "sub")}
        />

        {!agencyId && (
          <p className="mt-3 flex items-center gap-1.5 text-small font-medium text-foreground">
            <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
            Go back and add your agency name to get your real link.
          </p>
        )}

        <ol className="mt-6 space-y-3">
          {STEPS.map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption font-semibold text-brand"
              >
                {i + 1}
              </span>
              <span className="text-body text-muted-foreground">{text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex min-h-[2.75rem] items-center border-t border-border pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {installedSub ? (
              <motion.p
                key="done"
                variants={popIn}
                initial="hidden"
                animate="show"
                className="flex items-center gap-2 text-body font-medium text-foreground"
              >
                <CheckDot checked />
                Menu link installed
              </motion.p>
            ) : copiedSub ? (
              <motion.div
                key="confirm"
                variants={popIn}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <Button variant="outline" onClick={() => markInstalled("sub")}>
                  I have added the link
                </Button>
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                variants={popIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="text-small text-muted-foreground"
              >
                Copy the link to get started. You can also do this later from the install checklist.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MenuLinksStep;
