import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { checkInstallStatus } from "@/lib/installStatus";
import { useHubUrls } from "@/lib/hubUrl";

/**
 * Top-of-dashboard card showing the agency's live Client Hub URL, plus a
 * warning when we have no menu link on file (i.e. install never completed).
 */
export default function HubUrlCard() {
  const { email } = useUser();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [menuLinkOnFile, setMenuLinkOnFile] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!email) return;
    let active = true;
    (async () => {
      const { data: user } = await supabase
        .from("saas_suite_users")
        .select("agency_id")
        .ilike("email", email)
        .maybeSingle();
      const id = (user as { agency_id?: string } | null)?.agency_id ?? null;
      if (!active) return;
      setAgencyId(id);

      if (!id) {
        setMenuLinkOnFile(false);
        return;
      }
      // Use the same account-wide source of truth as every other install prompt.
      // This recognizes confirmation, sibling/renamed agency IDs, saved menu
      // settings, and real hub activity instead of checking only the primary ID.
      const installed = await checkInstallStatus(email);
      if (!active) return;
      setMenuLinkOnFile(installed);
    })();
    return () => {
      active = false;
    };
  }, [email]);

  const hubUrlFor = useHubUrls([agencyId]);
  if (!agencyId) return null;

  const url = hubUrlFor(agencyId);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Client Hub URL copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4" data-tip-target="dashboard-hub-url">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your Client Hub URL
          </p>
          <p className="mt-1 truncate font-mono text-sm text-foreground">{url}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy} aria-label="Copy Client Hub URL">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </a>
          </Button>
        </div>
      </div>

      {menuLinkOnFile === false && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-400/70 bg-amber-50/70 p-3 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">Installation not finished</p>
            <p className="text-muted-foreground">
              We don't have a menu link on file yet, so your clients can't see this hub inside
              HighLevel. Finish the installation guide to go live.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
