import { LockKeyhole, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MultiPlanConnectionNotice() {
  return <div className="flex flex-wrap items-center gap-3 border-y border-border py-3 text-sm text-muted-foreground">
    <LockKeyhole className="h-4 w-4 shrink-0" />
    <span className="min-w-0 flex-1">Connect HighLevel in Settings before setting up Plans 2 and 3.</span>
    <Button asChild variant="outline" size="sm"><a href="/app/settings"><Settings className="h-4 w-4" />Open Settings</a></Button>
  </div>;
}