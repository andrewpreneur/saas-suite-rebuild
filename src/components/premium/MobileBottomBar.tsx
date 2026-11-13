// Adapted from 21st.dev: "Bottom Menu" by 0xUrvish (https://21st.dev). Same idea (a bar whose tray grows upward from the tapped item), our groups, icons and tokens.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, GraduationCap, LayoutGrid, LifeBuoy, MoreHorizontal, Palette, Rocket, Settings } from "lucide-react";
import { NEW_UI_SIDEBAR_SECTIONS, TOOL_LABELS } from "@/lib/sidebarNav";
import { pathForAppTool } from "@/lib/appRoutes";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Entry = { id: string; label: string; icon: typeof BarChart3; groups?: string[]; tool?: string };

const ENTRIES: Entry[] = [
  { id: "home", label: "Home", icon: BarChart3, tool: "dashboard" },
  { id: "hub", label: "Hub", icon: LayoutGrid, groups: ["hub"] },
  { id: "brand", label: "Brand", icon: Palette, groups: ["brand"] },
  { id: "support", label: "Support", icon: LifeBuoy, groups: ["support"] },
  { id: "more", label: "More", icon: MoreHorizontal, groups: ["growth", "learn"] },
];
const GROUP_ICON: Record<string, typeof BarChart3> = { growth: Rocket, learn: GraduationCap };

function pathFor(toolId: string): string {
  if (toolId === "affiliate-dashboard") return "/app/dashboard?view=affiliate";
  if (toolId === "one-feature-kit") return "/app/dashboard?view=kit";
  return pathForAppTool(toolId);
}

/**
 * Phone navigation, where the thumb is. Home goes straight to the dashboard;
 * every other item opens a tray of that group's pages above the bar. Same
 * groups and names as the desktop sidebar.
 */
export function MobileBottomBar({ tool }: { tool?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  const view = new URLSearchParams(location.search).get("view");
  const pageId =
    tool === "dashboard" && view === "affiliate"
      ? "affiliate-dashboard"
      : tool === "dashboard" && view === "kit"
        ? "one-feature-kit"
        : tool === "start-here"
          ? "learning"
          : (tool ?? "");
  const currentGroup = NEW_UI_SIDEBAR_SECTIONS.find((section) => section.toolIds.includes(pageId))?.id;
  const activeEntry =
    pageId === "dashboard"
      ? "home"
      : (ENTRIES.find((entry) => entry.groups?.includes(currentGroup ?? ""))?.id ?? (pageId === "settings" ? "more" : null));

  // Close the tray on a tap outside, on Escape, and whenever the page changes.
  useEffect(() => {
    if (!openId) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenId(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenId(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);
  useEffect(() => setOpenId(null), [location.pathname, location.search]);

  const open = ENTRIES.find((entry) => entry.id === openId) ?? null;
  const go = (toolId: string) => {
    setOpenId(null);
    navigate(pathFor(toolId));
  };

  return (
    <nav
      ref={rootRef}
      aria-label="Main"
      data-testid="mobile-bottom-bar"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mobile-bar mx-auto max-w-md overflow-hidden rounded-[22px] border border-border/70 shadow-popover">
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key={open.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="max-h-[60dvh] overflow-y-auto overscroll-contain border-b border-border/70 p-2"
              role="menu"
              aria-label={`${open.label} pages`}
            >
              {(open.groups ?? []).map((groupId) => {
                const section = NEW_UI_SIDEBAR_SECTIONS.find((item) => item.id === groupId);
                if (!section) return null;
                const GroupIcon = GROUP_ICON[groupId];
                return (
                  <div key={groupId}>
                    {(open.groups ?? []).length > 1 ? (
                      <p className="px-eyebrow flex items-center gap-1.5 px-3 pb-1 pt-2">
                        {GroupIcon ? <GroupIcon className="size-3.5" aria-hidden="true" /> : null}
                        {section.label}
                      </p>
                    ) : null}
                    {section.toolIds
                      .filter((id) => id !== "help")
                      .map((id) => (
                        <button
                          key={id}
                          type="button"
                          role="menuitem"
                          aria-current={id === pageId ? "page" : undefined}
                          onClick={() => go(id)}
                          className={cn(
                            "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] font-medium transition-colors duration-100 active:bg-foreground/5",
                            id === pageId ? "bg-[hsl(var(--brand-subtle))] text-primary" : "text-foreground",
                          )}
                        >
                          {TOOL_LABELS[id] ?? id}
                        </button>
                      ))}
                  </div>
                );
              })}
              {open.id === "more" ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go("settings")}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[15px] font-medium text-muted-foreground active:bg-foreground/5"
                >
                  <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
                  Settings
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <ul className="flex items-stretch justify-between p-1.5">
          {ENTRIES.map((entry) => {
            const Icon = entry.icon;
            const isOpen = openId === entry.id;
            const isActive = activeEntry === entry.id;
            const lit = isOpen || (isActive && !openId);
            return (
              <li key={entry.id} className="flex-1">
                <button
                  type="button"
                  aria-label={entry.label}
                  aria-expanded={entry.groups ? isOpen : undefined}
                  aria-current={isActive && !entry.groups ? "page" : undefined}
                  onClick={() => {
                    if (entry.tool) return go(entry.tool);
                    setOpenId(isOpen ? null : entry.id);
                  }}
                  className="relative flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-transform duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {lit ? (
                    <motion.span
                      layoutId="mobile-bar-pill"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      className="absolute inset-0 rounded-2xl bg-[hsl(var(--brand-subtle))] shadow-[inset_0_0_0_1px_rgba(96,67,239,0.18)]"
                    />
                  ) : null}
                  <Icon className={cn("relative size-5", lit ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                  <span className={cn("relative", lit ? "text-primary" : "text-muted-foreground")}>{entry.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
