import { Choices, MultiPick, VideosPicker, ConnectApps, GhlConnectForm, MenuLinkStep, SlackCard, HubLinkCard, UpgradeButtons } from "./Widgets";
import { MenuRemovalSetupCard, GuideScreenshot } from "./MenuRemovalSetupCard";
import { MenuRemovalVideo } from "./MenuRemovalVideo";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Widget, GHL_INSTRUCTIONS } from "@/lib/copilotWorkspace";

interface WidgetRendererProps {
  widget: Widget;
  live: boolean;
  agencyId: string | null;
  email: string | null;
  ghlConnected: boolean;
  slackConnected: boolean;
  menuLinkInstalled: boolean;
  hubUrl: string | null;
  onSend: (text: string) => void;
  onSay: (text: string) => void;
  onHelp: () => void;
  onRefreshGhl: () => Promise<void>;
  onRefreshSlack: () => Promise<void>;
  onSetMenuLinkInstalled: (val: boolean) => void;
  onStartUpgrade: (plan: "basic" | "advanced" | "enhanced") => void;
  onSkip: () => void;
}

export function WidgetRenderer({ 
  widget, live, agencyId, email, ghlConnected, slackConnected, menuLinkInstalled, hubUrl, 
  onSend, onSay, onHelp, onRefreshGhl, onRefreshSlack, onSetMenuLinkInstalled, onStartUpgrade, onSkip 
}: WidgetRendererProps) {
  if (widget.kind === "choices") {
    return <Choices options={widget.options} disabled={!live} onPick={onSend} />;
  }
  if (widget.kind === "multi") {
    return <MultiPick options={widget.options} disabled={!live} onSubmit={(p) => onSend(p.length ? `Yes: ${p.join(", ")}` : "None of these for now")} />;
  }
  if (widget.kind === "screenshot") return <GuideScreenshot k={widget.key} />;

  switch (widget.name) {
    case "menu_removal_video":
      return <MenuRemovalVideo />;
    case "menu_removal_setup":
      return <MenuRemovalSetupCard agencyId={agencyId} onHelp={onHelp} onConnect={() => onSay(GHL_INSTRUCTIONS)} onUpgrade={() => onSay("Choose a plan to review.\n[[widget:upgrade]]")} />;
    case "connect_apps":
      return (
        <div className="space-y-2">
          <ConnectApps agencyId={agencyId} email={email} slackConnected={slackConnected} ghlConnected={ghlConnected}
            onSlackDone={async () => { await onRefreshSlack(); }}
            onGhlAuthorize={() => (ghlConnected ? onSay("HighLevel is already connected.") : onSay(GHL_INSTRUCTIONS))} />
          {ghlConnected && <Button variant="outline" size="sm" className="rounded-full" onClick={() => onSend("Continue setup")}>Continue setup</Button>}
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip for now</Button>
        </div>
      );
    case "slack_connect":
      return <SlackCard agencyId={agencyId} email={email} connected={slackConnected} onDone={onRefreshSlack} />;
    case "ghl_connect":
      return <GhlConnectForm agencyId={agencyId} connected={ghlConnected} disabled={!live}
        onConnected={async () => { await onRefreshGhl(); toast.success("HighLevel connected"); }}
        onSkip={onSkip} />;
    case "hub_link":
      return hubUrl ? <HubLinkCard url={hubUrl} onConnect={() => onSay(GHL_INSTRUCTIONS)} /> : null;
    case "upgrade":
      return <UpgradeButtons disabled={!live} onUpgrade={onStartUpgrade} />;
    case "human_help":
      return <Button variant="outline" size="sm" className="rounded-full" onClick={onHelp}><MessageCircle className="h-4 w-4" />Text us for human help</Button>;
    case "menu_link":
      return (
        <div className="space-y-2">
          <MenuLinkStep agencyId={agencyId} connected={ghlConnected} installed={menuLinkInstalled}
            onConnect={() => onSay(GHL_INSTRUCTIONS)}
            onCreated={async () => {
              onSetMenuLinkInstalled(true);
              onSay("Your menu link is installed. Paste your account’s CSS and JavaScript in HighLevel to finish.");
            }} />
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip installation for now</Button>
        </div>
      );
    case "videos":
      return <VideosPicker disabled={!live} onSubmit={(p) => onSend(p.length ? `Teach them these videos: ${p.join(", ")}` : "No extra videos for now")} />;
    default:
      return null;
  }
}
