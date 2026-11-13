import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ssLogo from "@/assets/saassuitelogo-3.png";

/** The official SaaSSuite community account (announcements). */
export const SAASSUITE_BOT_ID = "00000000-0000-0000-0000-000000005a55";

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

export function initialsOf(name?: string | null) {
  return (name || "?")
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function MemberAvatar({
  name,
  avatarUrl,
  className = "h-9 w-9",
  authorId,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  authorId?: string | null;
}) {
  const src = authorId === SAASSUITE_BOT_ID ? ssLogo : avatarUrl;
  return (
    <Avatar className={`${className} flex-shrink-0`}>
      {src ? <AvatarImage src={src} alt={name || "Member"} /> : null}
      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function VerifiedBadge({ show }: { show?: boolean | null }) {
  if (!show) return null;
  return (
    <BadgeCheck
      aria-label="Verified"
      className="h-4 w-4 flex-shrink-0 fill-[hsl(210_100%_56%)] text-background"
    />
  );
}

export function AuthorLine({
  name,
  handle,
  verified,
  role,
  when,
}: {
  name?: string | null;
  handle?: string | null;
  verified?: boolean | null;
  role?: string | null;
  when?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm font-medium text-foreground">{name || "Member"}</span>
      <VerifiedBadge show={verified} />
      {handle ? <span className="text-xs text-muted-foreground">@{handle}</span> : null}
      <RoleBadge role={role} />
      {when ? <span className="text-xs text-muted-foreground">{relativeTime(when)}</span> : null}
    </div>
  );
}

export function RoleBadge({ role }: { role?: string | null }) {
  if (role !== "team" && role !== "admin") return null;
  return (
    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 leading-none uppercase tracking-wide">
      {role === "admin" ? "Admin" : "Team"}
    </Badge>
  );
}

export function UpgradePrompt({
  title = "Included with Basic & Advanced",
  description = "Upgrade your plan to unlock this content.",
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-muted/40 text-center ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button
        size="sm"
        className="mt-3 gap-2"
        onClick={() => window.open("/pricing", "_blank", "noopener,noreferrer")}
      >
        <Sparkles className="w-3.5 h-3.5" />
        View plans
      </Button>
    </div>
  );
}