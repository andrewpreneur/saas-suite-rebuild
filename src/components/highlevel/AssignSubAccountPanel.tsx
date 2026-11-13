import { useEffect, useState } from "react";
import { SectionCard } from "@/components/premium/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy, Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { ghl, ASSIGN_WEBHOOK_URL } from "./ghlApi";
import { useGhl } from "./useGhl";
import LocationList from "./LocationList";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { withDeadline } from "@/lib/loadSettle";

const copy = async (t: string) => {
  try {
    await navigator.clipboard.writeText(t);
    toast.success("Copied");
  } catch {
    toast.error("Could not copy. Select the text and copy it manually.");
  }
};

const CopyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" />
      <Button
        size="icon"
        variant="outline"
        aria-label={`Copy ${label}`}
        onClick={() => copy(value)}
      >
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

/** Webhook + payload to add/remove a sub-account on this plan's onboarding menu link from a HighLevel workflow. */
export function WebhookInstructions({ agencyId }: { agencyId: string | null }) {
  const body = `{
  "action": "add",
  "location_id": "{{location.id}}",
  "email": "{{contact.email}}",
  "agency_id": "${agencyId || "[YOUR AGENCY ID]"}"
}`;
  return (
    <div className="space-y-3 text-sm">
      <ol className="list-decimal pl-5 space-y-1 text-muted-foreground text-xs">
        <li>
          In HighLevel, add a <b>Custom Webhook</b> action to your workflow (method POST).
        </li>
        <li>
          Paste the URL below and add the header <code>X-SaaSSuite-Webhook-Secret</code> — create
          the secret in Menu Link Removal → Set Up Automation.
        </li>
        <li>
          Paste the body. Use <code>"action": "add"</code> to show this onboarding link in the
          sub-account, or <code>"remove"</code> to take it away.
        </li>
        <li>
          Send <code>location_id</code> or the buyer's login <code>email</code> (one is enough).
          Optional: <code>menu_link_id</code> to target a different menu link than the one saved for
          this plan.
        </li>
      </ol>
      <CopyRow label="Webhook URL (POST)" value={ASSIGN_WEBHOOK_URL} />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Request body</Label>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => copy(body)}>
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{body}</pre>
      </div>
      <p className="text-xs text-muted-foreground">
        Your HighLevel token needs the <code>custom-menu-link.write</code> scope for this.
      </p>
    </div>
  );
}

export function AssignWebhookGuide({
  agencyId,
  title,
}: {
  agencyId: string | null;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-muted/30">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium">
        {title}
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Keep your onboarding menu link hidden by default and turn it on per sub-account from a
          workflow — perfect when only some clients get a custom onboarding plan.
        </p>
        <WebhookInstructions agencyId={agencyId} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Client Hub tab: assign this plan's onboarding menu link to sub-accounts from SaaS Suite. */
export default function AssignSubAccountPanel({ agencyId }: { agencyId: string | null }) {
  const { connected, loading, error, locations, reload } = useGhl(agencyId);
  const [menu, setMenu] = useState<{ menu_id: string | null; menu?: any } | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [loc, setLoc] = useState<string>("");
  const [busy, setBusy] = useState<"add" | "remove" | null>(null);
  const [limitOffer, setLimitOffer] = useState(false);

  const loadMenu = async () => {
    if (!agencyId) {
      setMenu(null);
      setMenuLoading(false);
      return;
    }
    setMenuLoading(true);
    setMenuError(null);
    try {
      setMenu(await withDeadline(ghl("plan_menu", agencyId)));
    } catch (loadError) {
      setMenu({ menu_id: null });
      setMenuError(loadError instanceof Error ? loadError.message : "Couldn't load this plan's menu link.");
    } finally {
      setMenuLoading(false);
    }
  };
  useEffect(() => {
    void loadMenu();
  }, [agencyId]);

  const assigned: string[] = menu?.menu?.location_ids || [];
  const act = async (mode: "add" | "remove", restrict = false) => {
    if (!agencyId || !loc) return;
    setBusy(mode);
    try {
      const r = await ghl("assign_menu", agencyId, {
        location_id: loc,
        mode,
        restrict,
        known_location_ids: locations.map((l) => l.location_id),
      });
      if (r.reason === "already_everywhere") {
        setLimitOffer(true);
        toast.message("This link is already shown in every sub-account.");
        return;
      }
      if (r.reason === "missing_roster") {
        toast.error(
          "Refresh your sub-accounts first so removing one doesn't hide the link everywhere.",
        );
        return;
      }
      setLimitOffer(false);
      toast.success(
        r.changed
          ? mode === "add"
            ? "Added to sub-account"
            : "Removed from sub-account"
          : "Already set — nothing changed",
      );
      await loadMenu();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!agencyId)
    return (
      <p className="text-sm text-muted-foreground">
        Add an agency name in Settings before assigning a sub-account.
      </p>
    );
  if (loading || menuLoading) return <LoadNotice loading label="Loading sub-accounts…" />;
  if (error || menuError)
    return (
      <LoadNotice
        error={error || menuError}
        onRetry={() => {
          void reload(true);
          void loadMenu();
        }}
      />
    );
  if (!connected)
    return (
      <p className="text-sm text-muted-foreground">Connect HighLevel in Settings to use this.</p>
    );

  const name = (id: string) => locations.find((l) => l.location_id === id)?.name || id;
  return (
    <div className="space-y-6">
      <SectionCard
        title="Assign to Sub Account"
        description="Show this onboarding plan in specific sub-accounts right from SaaS Suite, instead of editing the menu link in HighLevel."
        actions={<Badge variant="neutral">Optional</Badge>}
        bodyClassName="space-y-4"
      >
          {!menu.menu_id ? (
            <p className="text-sm text-muted-foreground">
              Save this plan's menu link in the Installation Guide first.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Menu link:{" "}
                <span className="font-medium text-foreground">
                  {menu.menu?.title || menu.menu_id}
                </span>
                {menu.menu?.all_locations
                  ? " — currently shown in every sub-account"
                  : ` — in ${assigned.length} sub-account${assigned.length === 1 ? "" : "s"}`}
              </p>
              <LocationList
                locations={locations}
                value={loc || null}
                onSelect={(l) => setLoc(l.location_id)}
                onRefresh={() => void reload(true)}
                refreshing={loading}
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={!loc || !!busy} onClick={() => act("add")}>
                  {busy === "add" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  Add to Sub Account
                </Button>
                <Button variant="outline" disabled={!loc || !!busy} onClick={() => act("remove")}>
                  {busy === "remove" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Minus />
                  )}
                  Remove From Sub Account
                </Button>
                {limitOffer && (
                  <Button
                    variant="secondary"
                    disabled={!loc || !!busy}
                    onClick={() => act("add", true)}
                  >
                    Limit to this sub-account
                  </Button>
                )}
              </div>
              {assigned.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assigned.map((id) => (
                    <Badge
                      key={id}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setLoc(id)}
                    >
                      {name(id)}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
      </SectionCard>
      <SectionCard
        title="Assign from a workflow"
        description="Add or remove this onboarding plan automatically, e.g. after a purchase."
      >
          <WebhookInstructions agencyId={agencyId} />
      </SectionCard>
    </div>
  );
}
