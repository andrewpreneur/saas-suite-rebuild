import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2 } from "lucide-react";
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
      toast.success("Copied to clipboard!");
      setCopiedSub(true);
      trackEvent("menu_link_copied", `Copied ${which} menu link`, { url: text, which });
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const markInstalled = (which: "sub") => {
    setInstalledSub(true);
    trackEvent("menu_link_installed", `Marked ${which} menu link installed`, { which });
    toast.success("Awesome — menu link installed!");
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Add Your Menu Link</h2>
        <p className="text-muted-foreground mt-2">
          Add this URL to your HighLevel sub accounts to connect your SaaS Suite.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              1
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">Sub Account Menu Link (Client Hub)</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Add this link to <strong>all sub accounts</strong> (or just a demo account for testing). This is what your clients will see.
              </p>

              <div className="flex items-center gap-2 bg-white dark:bg-background p-3 rounded-lg border">
                <code className="text-sm flex-1 truncate font-mono">{v2Url}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(v2Url, "sub")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              {!agencyId && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Complete the branding step to generate your unique agency URL.
                </p>
              )}

              <div className="mt-3 text-sm text-muted-foreground">
                <strong>Steps:</strong>
                <ol className="list-decimal ml-5 mt-1 space-y-1">
                  <li>Go to a Sub Account → Settings → Custom Menu Link</li>
                  <li>Create a new menu link with the URL above</li>
                  <li>Title it "Onboarding" or "Training"</li>
                  <li>Save and refresh the page</li>
                </ol>
              </div>

              {copiedSub && !installedSub && (
                <Button className="mt-3" size="sm" onClick={() => markInstalled("sub")}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> I've installed it
                </Button>
              )}
              {installedSub && (
                <p className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Installed
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuLinksStep;
