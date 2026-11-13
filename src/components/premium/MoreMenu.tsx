import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MoreMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Opens in a new tab instead of running onSelect. */
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
};

/**
 * The one place a screen keeps its secondary actions. If a page or card has more
 * than one button besides its primary action, the rest move in here.
 */
export function MoreMenu({
  items,
  label = "More actions",
  size = "default",
  align = "end",
}: {
  items: MoreMenuItem[];
  label?: string;
  size?: "default" | "sm";
  align?: "start" | "end";
}) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          className={size === "sm" ? "size-9" : "size-11 sm:size-10"}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-52">
        {items.map((item) => (
          <div key={item.label}>
            {item.separated ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={item.disabled}
              className={`min-h-10 gap-2.5 [&_svg]:size-4 ${item.danger ? "text-destructive focus:text-destructive" : ""}`}
              onSelect={() => {
                if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
                else item.onSelect?.();
              }}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
