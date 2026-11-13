import { CalendarDays, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CoPilotShell } from "@/components/copilot/CoPilotShell";
import { useChatCoPilot } from "@/hooks/useChatCoPilot";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import { useUiSounds } from "@/hooks/useUiSounds";
import { hasOptedOutOfTracking } from "@/utils/trackingConsent";

export default function StartHereSupport() {
  const { sendMessage, isLoading, isHandedOver } = useChatCoPilot();
  const { trackEvent } = useSessionTracker();
  const { playSend } = useUiSounds();
  const navigate = useNavigate();
  const track = (action: string) => {
    if (!hasOptedOutOfTracking()) trackEvent(action, "support", { source: "start-here" });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          onClick={() => {
            track("start_here_support_call");
            navigate("/success");
          }}
        >
          <CalendarDays />
          Book a Support Call
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={isLoading || isHandedOver}
          onClick={() => {
            track("start_here_human_request");
            playSend();
            void sendMessage(
              "I would like to request a human support team member. Please hand over this conversation and notify the SaaSSuite team.",
            );
          }}
        >
          <UserRound />
          Request a human
        </Button>
      </div>
      <section
        aria-label="AI Copilot chat"
        className="flex h-[min(760px,calc(100dvh-280px))] min-h-[440px] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background"
      >
        <CoPilotShell inline onMessageSent={() => track("start_here_copilot_message")} />
      </section>
    </div>
  );
}
