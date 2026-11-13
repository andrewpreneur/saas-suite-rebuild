import { BarChart3, LifeBuoy, Route, Users, Handshake } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSupportUnread } from "@/hooks/useSupportUnread";

type NavItem = {
  id: string;
  label: string;
  icon: typeof BarChart3;
  badge?: number;
};

interface MobileBottomNavProps {
  selectedTool: string;
  onSelectTool: (tool: string) => void;
}

/**
 * Primary mobile navigation. Lives in the thumb zone, 5 items max,
 * 44px+ targets, safe-area aware. The hamburger stays as a fallback
 * for everything that isn't one of these.
 */
export function MobileBottomNav({ selectedTool, onSelectTool }: MobileBottomNavProps) {
  const supportUnread = useSupportUnread();

  const items: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "support", label: "Support", icon: LifeBuoy, badge: supportUnread },
    { id: "workflows", label: "Workflows", icon: Route },
    { id: "community", label: "Community", icon: Users },
    { id: "affiliate-dashboard", label: "Affiliate", icon: Handshake },
  ];

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = selectedTool === item.id;
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelectTool(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors duration-150 active:scale-[0.97] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <span className="relative">
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  {!!item.badge && item.badge > 0 && (
                    <span
                      aria-label={`${item.badge} needing attention`}
                      className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground"
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default MobileBottomNav;