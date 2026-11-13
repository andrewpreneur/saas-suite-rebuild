import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Compass, LayoutGrid, RotateCcw, MessageSquare, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef, useState, type ReactNode } from "react";
import HubLiveModal from "@/components/onboarding/HubLiveModal";
import { PageHeader } from "@/components/platform/PageHeader";

interface WalkthroughToolProps {
  onNavigateToTool?: (tool: string) => void;
  onOpenCoPilot?: () => void;
}

const WalkthroughTool = ({ onNavigateToTool, onOpenCoPilot }: WalkthroughToolProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // New accounts land here straight from the intro questions with the
  // "your portal is live" celebration; closing it kicks off the tour.
  const [hubLive, setHubLive] = useState(() => new URLSearchParams(window.location.search).get("hubLive") === "1");
  const [hubUrl] = useState(() => new URLSearchParams(window.location.search).get("hubUrl"));
  const closeHubLive = (o: boolean) => {
    if (o) return;
    setHubLive(false);
    window.history.replaceState({}, "", window.location.pathname);
    setTimeout(() => window.dispatchEvent(new CustomEvent("start-walkthrough", { detail: { kind: "nav" } })), 400);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };


  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Walkthrough"
        subtitle="A video tour of setting up SaaSSuite and your Client Hub."
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10"
            onClick={() => window.dispatchEvent(new CustomEvent("start-walkthrough", { detail: { kind: "nav" } }))}
          >
            <Compass />
            Take the interactive tour
          </Button>
        }
      />
      <HubLiveModal open={hubLive} onOpenChange={closeHubLive} hubUrl={hubUrl} />

      <section className="px-surface overflow-hidden" aria-label="SaaS Suite walkthrough video">
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            controls={playing}
            playsInline
            className="h-full w-full object-cover"
            poster="/lovable-uploads/onboardingthumbnail.png"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={togglePlay}
          >
            <source src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6aaca43e7bf7555bc30e9a17.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Clicking anywhere on the video starts it, no hunting for the tiny control. */}
          {!playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play walkthrough video"
              className="group absolute inset-0 flex items-center justify-center bg-black/30 transition-colors duration-200 hover:bg-black/40 focus-visible:outline-none"
            >
              <span className="px-brand-fill flex size-16 items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-white/60 sm:size-20">
                <Play className="ml-1 size-7 fill-current sm:size-8" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">SaaS Suite Walkthrough</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              20 minutes · Setup, Client Hub and branding
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Get started" className="space-y-3">
        <h2 className="text-h4 text-foreground">Get Started</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <NextStep
            primary
            icon={<LayoutGrid />}
            title="Open Client Hub Manager"
            body="Choose your videos and welcome sections."
            onClick={() => onNavigateToTool?.('client-hub')}
          />
          <NextStep
            icon={<MessageSquare />}
            title="AI CoPilot Setup"
            body="Let the copilot set things up with you."
            onClick={() => onOpenCoPilot?.()}
          />
          <NextStep
            icon={<RotateCcw />}
            title="Onboarding"
            body="Run the intro questions again."
            onClick={() => navigate("/v2-onboarding?mode=reonboard")}
          />
        </div>
      </section>
    </div>
  );
};

function NextStep({
  icon,
  title,
  body,
  onClick,
  primary,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-surface-interactive group flex min-h-[72px] items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span
        className={
          primary
            ? "px-brand-fill flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5"
            : "px-icon-chip shrink-0 [&_svg]:size-5"
        }
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
        aria-hidden="true"
      />
    </button>
  );
}

export default WalkthroughTool;