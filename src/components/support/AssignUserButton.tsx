import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, UserPlus, UserRound, X } from "lucide-react";
import type { TeamMember } from "@/hooks/useTeamAccess";

interface Props {
  team: TeamMember[];
  assignedEmail: string | null | undefined;
  onAssign: (email: string | null) => void | Promise<void>;
  disabled?: boolean;
  /** Show "Assigned to X" text next to the icon. */
  showLabel?: boolean;
}

/** Small person icon: click to pick a team member; shows who it's assigned to. */
export default function AssignUserButton({ team, assignedEmail, onAssign, disabled, showLabel = true }: Props) {
  const [open, setOpen] = useState(false);
  const assigned = assignedEmail?.toLowerCase() || null;
  const who = assigned ? team.find((m) => m.email === assigned)?.name || assigned : null;

  const pick = async (email: string | null) => {
    setOpen(false);
    await onAssign(email);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-xs"
          disabled={disabled}
          title={who ? `Assigned to ${who}` : "Assign to a team member"}
          onClick={(e) => e.stopPropagation()}
        >
          {assigned ? <UserRound className="w-4 h-4 text-primary" /> : <UserPlus className="w-4 h-4 text-muted-foreground" />}
          {showLabel && (
            <span className={assigned ? "text-foreground" : "text-muted-foreground"}>
              {who ? `Assigned to ${who}` : "Unassigned"}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Assign to</p>
        {team.map((m) => (
          <button
            key={m.email}
            type="button"
            onClick={() => void pick(m.email)}
            className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted text-left"
          >
            <UserRound className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 min-w-0">
              <span className="block truncate">{m.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{m.email}</span>
            </span>
            {assigned === m.email && <Check className="w-4 h-4 text-primary" />}
          </button>
        ))}
        {assigned && (
          <button
            type="button"
            onClick={() => void pick(null)}
            className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted text-left text-muted-foreground"
          >
            <X className="w-4 h-4" /> Unassign
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
