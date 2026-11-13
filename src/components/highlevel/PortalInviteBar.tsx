import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ghl } from "./ghlApi";
import { useGhl } from "./useGhl";

/** Logged-in vs total HighLevel sub-accounts, with a copyable portal link. Only renders when connected. */
export default function PortalInviteBar() {
  const { agencyId, connected } = useGhl();
  const [stats, setStats] = useState<{ total_accounts: number; logged_in: number; not_logged_in_with_email: number; portal_url: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    if (!agencyId || !connected) return;
    ghl("portal_stats", agencyId).then(setStats).catch(() => setStats(null));
  }, [agencyId, connected]);

  if (!connected || !stats) return null;
  const pct = stats.total_accounts ? Math.round((stats.logged_in / stats.total_accounts) * 100) : 0;
  const link = inviteLink || stats.portal_url;

  const share = async () => {
    setOpen(true);
    if (!agencyId) return;
    setLoadingLink(true);
    try {
      const r = await ghl<{ invite_link?: string; portal_url?: string }>("invite_portal", agencyId);
      setInviteLink(r.invite_link || r.portal_url || stats.portal_url);
    } catch (e: any) {
      setInviteLink(stats.portal_url);
      if (!stats.portal_url) toast.error(e.message);
    } finally {
      setLoadingLink(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Portal invite link copied");
    } catch {
      toast.error("Couldn't copy. Select the link instead.");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-4 animate-in fade-in slide-in-from-top-1 duration-500 motion-reduce:animate-none">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span className="font-medium text-foreground">{stats.logged_in.toLocaleString()} logged in</span>
            <span className="text-muted-foreground">of {stats.total_accounts.toLocaleString()} HighLevel accounts · {pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-out" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={share}>
          <Link2 className="w-4 h-4" /> Share portal link
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share your portal link</DialogTitle>
            <DialogDescription>Copy this link and send it to your sub-accounts.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-mono break-all min-h-10">
            {loadingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : link}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button variant="accent" onClick={copy} disabled={!link || loadingLink}>
              <Copy className="w-4 h-4" /> Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
