import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoPilotShell } from "@/components/copilot/CoPilotShell";
import { useChatCoPilot } from "@/hooks/useChatCoPilot";

/**
 * The one owner-help experience: the AI copilot, with a direct request-human
 * action that does not depend on the model deciding to escalate.
 */
export function OwnerHelp({ onBook }: { onBook?: () => void }) {
  const { requestHuman, isLoading, isHandedOver } = useChatCoPilot();
  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {onBook ? (
          <Button type="button" variant="outline" onClick={onBook}>
            Book a call
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => void requestHuman()}
          disabled={isLoading || isHandedOver}
        >
          <UserRound className="h-4 w-4" />
          {isHandedOver ? "AI paused for human support" : "Request a human"}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
        <CoPilotShell inline />
      </div>
    </div>
  );
}
