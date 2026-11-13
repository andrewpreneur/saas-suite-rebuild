import { Button } from "@/components/ui/button";
import { Clock, Compass, LayoutGrid, RotateCcw, MessageSquare, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
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
        more={[
          {
            label: "Take the interactive tour",
            icon: <Compass />,
            onSelect: () => window.dispatchEvent(new CustomEvent("start-walkthrough", { detail: { kind: "nav" } })),
          },
          { label: "Set up with AI CoPilot", icon: <MessageSquare />, onSelect: () => onOpenCoPilot?.() },
          {
            label: "Answer the intro questions again",
            icon: <RotateCcw />,
            onSelect: () => navigate("/v2-onboarding?mode=reonboard"),
          },
        ]}
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
          <Button
            type="button"
            variant="accent"
            className="h-11 w-full sm:h-10 sm:w-auto"
            onClick={() => onNavigateToTool?.("client-hub")}
          >
            <LayoutGrid />
            Open Client Hub Manager
          </Button>
        </div>
      </section>
    </div>
  );
};

export default WalkthroughTool;