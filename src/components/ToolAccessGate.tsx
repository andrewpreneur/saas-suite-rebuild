import type { ReactNode } from "react";
import { Eye, Lock } from "lucide-react";
import { EmptyState } from "@/components/premium/21st/empty-state";
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
      <EmptyState
        className="py-16"
        icon={
          <span className="px-icon-chip">
            <Lock className="size-5" aria-hidden="true" />
          </span>
        }
        title="You don't have access to this area"
        description="Ask the account owner to give you access in Settings → Admins → Permissions."
      />
    );
  }
  if (level === "view") {
    return (
      <div className="space-y-3">
        <div role="status" className="flex items-start gap-2 rounded-lg border border-info/30 bg-blue-50 px-3 py-2 text-small text-foreground">
          <Eye className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p>
            <strong className="font-semibold">View only.</strong> The account owner hasn't given you edit access here.
          </p>
        </div>
        <fieldset disabled className="contents [&_button]:pointer-events-none [&_button]:opacity-70">
          {children}
        </fieldset>
      </div>
    );
  }
  return <>{children}</>;
}
