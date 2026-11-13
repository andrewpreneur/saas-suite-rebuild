import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RotateCcw, MessageSquare, Play } from "lucide-react";
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
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Walkthrough"
        subtitle="A video tour of setting up SaaSSuite and your Client Hub."
      />
      <HubLiveModal open={hubLive} onOpenChange={closeHubLive} hubUrl={hubUrl} />
      <Card className="shadow-elevated border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-xl">SaaS Suite Walkthrough</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="relative w-full rounded-lg overflow-hidden shadow-elevated bg-muted/20">
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                controls
                className="w-full h-full object-cover"
                poster="/lovable-uploads/onboardingthumbnail.png"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={togglePlay}
              >
                <source src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6aaca43e7bf7555bc30e9a17.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Clicking anywhere on the video starts it — no hunting for the tiny control. */}
              {!playing && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Play walkthrough video"
                  className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors duration-150 hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background/95 shadow-xl transition-transform duration-200 hover:scale-105">
                    <Play className="ml-0.5 h-7 w-7 text-purple-600" />
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex w-full min-w-0 flex-col items-stretch space-y-3">
            <p className="text-center text-lg font-bold text-foreground">Get Started</p>
            <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <Button 
                onClick={() => onNavigateToTool?.('client-hub')}
                className="h-auto w-full max-w-full whitespace-normal bg-purple-600 px-8 py-3 text-base font-semibold leading-relaxed text-white hover:bg-purple-700 sm:w-auto sm:text-lg"
                size="lg"
              >
                <span className="inline sm:inline">Open Client Hub Manager</span>
              </Button>
              <Button
                onClick={onOpenCoPilot}
                className="h-auto w-full max-w-full gap-2 whitespace-normal bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-base font-semibold text-white hover:from-blue-700 hover:to-purple-700 sm:w-auto"
                size="lg"
              >
                <MessageSquare className="w-4 h-4" />
                AI CoPilot Setup
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/v2-onboarding?mode=reonboard")}
                className="h-auto w-full max-w-full whitespace-normal px-6 py-3 text-base font-semibold sm:w-auto"
                size="lg"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Onboarding
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WalkthroughTool;