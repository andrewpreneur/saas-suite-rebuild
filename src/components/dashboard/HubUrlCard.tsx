import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Globe, TriangleAlert } from "lucide-react";
import { CopyConfirmIcon } from "@/components/premium/dashboard/CopyConfirmIcon";
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

  const live = menuLinkOnFile !== false;

  return (
    <section className="px-surface flex h-full flex-col justify-between gap-4 p-4 sm:p-5" data-tip-target="dashboard-hub-url">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
            <Globe />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Your Client Hub</h2>
            <p className="text-small text-muted-foreground">The link your clients open</p>
          </div>
        </div>
        {menuLinkOnFile === null ? null : live ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-warning">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Not live yet
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 py-1 pl-3 pr-1">
          <p className="min-w-0 flex-1 truncate font-mono text-small text-foreground" title={url}>
            {url.replace(/^https?:\/\//, "")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            aria-label="Copy Client Hub URL"
            className="h-11 shrink-0 gap-1.5 px-3 sm:h-9"
          >
            <CopyConfirmIcon copied={copied} />
            <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
        <Button variant="outline" size="sm" asChild className="h-11 w-full sm:h-9">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open Client Hub
            <ExternalLink className="ml-2 size-4" aria-hidden="true" />
          </a>
        </Button>
        {!live && (
          <p className="text-small text-muted-foreground">
            <span className="font-medium text-foreground">Installation not finished.</span> We don't have a
            menu link on file yet, so your clients can't see this hub inside HighLevel. Finish the
            installation guide to go live.
          </p>
        )}
      </div>
    </section>
  );
}
