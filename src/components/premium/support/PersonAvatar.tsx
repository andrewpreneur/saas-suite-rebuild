import { cn } from "@/lib/utils";

function initials(name: string) {
  const base = name.includes("@") ? name.split("@")[0] : name;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

/** Round initials avatar for a client or teammate. Decorative: the name is always shown beside it. */
export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground",
        size === "sm" ? "size-8 text-[11px]" : "size-10 text-xs",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
