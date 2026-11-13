import type { ReactNode } from "react";
import { Eye, Lock } from "lucide-react";
import { TOOL_AREA, useTeamAccess } from "@/hooks/useTeamAccess";

/** Hides a tool for admins with no access, and makes it read-only for view-only admins. */
export default function ToolAccessGate({ tool, children }: { tool: string; children: ReactNode }) {
  const access = useTeamAccess();
  if (access.isOwner) return <>{children}</>;

  let level = TOOL_AREA[tool] ? access.level(TOOL_AREA[tool]) : "edit";
  // Support handles its own chat/ticket permissions inside the page.
  if (tool === "support" || tool === "support-features") {
    const c = access.level("support_chats");
    const t = access.level("support_tickets");
    level = c === "none" && t === "none" ? "none" : "edit";
  }

  if (level === "none") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground gap-3">
        <Lock className="w-10 h-10 opacity-50" />
        <p className="font-medium text-foreground">You don't have access to this area</p>
        <p className="text-sm">Ask the account owner to give you access in Settings → Admins → Permissions.</p>
      </div>
    );
  }
  if (level === "view") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Eye className="w-4 h-4" /> View only — the account owner hasn't given you edit access here.
        </div>
        <fieldset disabled className="contents [&_button]:pointer-events-none [&_button]:opacity-70">
          {children}
        </fieldset>
      </div>
    );
  }
  return <>{children}</>;
}
