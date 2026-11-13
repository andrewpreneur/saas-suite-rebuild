// App chrome kit: the slim status strip above the app and the dock for trial/offer cards.
// Both keep clear of the sidebar by reading the sidebar's own state and its --sidebar-width variables.
import * as React from "react";
import { createPortal } from "react-dom";
import { CircleAlert, Info, Sparkles, TriangleAlert, X, type LucideIcon } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/** Sidebar state, or null when rendered outside the app shell (preview pages, tests). */
export function useChromeSidebar(): { collapsed: boolean; isMobile: boolean } | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const sidebar = useSidebar();
    return { collapsed: sidebar.state === "collapsed", isMobile: sidebar.isMobile };
  } catch {
    return null;
  }
}

export type ChromeTone = "warning" | "error" | "info" | "brand";

const stripTones: Record<ChromeTone, { box: string; icon: LucideIcon; iconCls: string; role: "status" | "alert"; label: string }> = {
  warning: { box: "border-warning/30 bg-amber-50", icon: TriangleAlert, iconCls: "text-warning", role: "status", label: "Warning" },
  error: { box: "border-destructive/30 bg-red-50", icon: CircleAlert, iconCls: "text-destructive", role: "alert", label: "Problem" },
  info: { box: "border-info/30 bg-blue-50", icon: Info, iconCls: "text-info", role: "status", label: "Notice" },
  brand: { box: "border-brand/25 bg-brand-subtle", icon: Sparkles, iconCls: "text-brand", role: "status", label: "Notice" },
};

interface ChromeStripProps {
  tone?: ChromeTone;
  icon?: LucideIcon;
  /** The short bold lead. */
  title: React.ReactNode;
  /** One calm sentence after the title. */
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

/**
 * Slim status strip that sits above the app, inside the content column.
 * On desktop it is padded by the sidebar width so the fixed sidebar never covers it.
 * It stays in the page flow (not sticky) so it cannot cover the top bar either.
 */
export function ChromeStrip({ tone = "warning", icon, title, children, actions, onDismiss, dismissLabel = "Dismiss", className }: ChromeStripProps) {
  const sidebar = useChromeSidebar();
  const t = stripTones[tone];
  const Icon = icon ?? t.icon;
  return (
    <div
      className={cn(
        "w-full shrink-0 transition-[padding] duration-200 ease-linear",
        sidebar && (sidebar.collapsed ? "md:pl-[var(--sidebar-width-icon,3rem)]" : "md:pl-[var(--sidebar-width,16rem)]"),
      )}
    >
      <div role={t.role} className={cn("border-b", t.box, className)}>
        <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:gap-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="flex h-5 shrink-0 items-center">
              <Icon className={cn("size-4", t.iconCls)} aria-hidden="true" />
              <span className="sr-only">{t.label}:</span>
            </span>
            <p className="min-w-0 flex-1 text-small text-pretty text-foreground">
              <strong className="font-semibold">{title}</strong>
              {children ? <> {children}</> : null}
            </p>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                aria-label={dismissLabel}
                className="-my-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {actions || onDismiss ? (
            <div className={cn("flex shrink-0 flex-wrap items-center gap-2 pl-6 sm:pl-0", !actions && "hidden sm:flex")}>
              {actions}
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label={dismissLabel}
                  className="hidden size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const DOCK_ID = "ss-chrome-dock";
const DOCK_DESKTOP =
  "md:fixed md:inset-x-auto md:top-auto md:bottom-4 md:left-[var(--dock-left,1rem)] md:z-40 md:m-0 md:w-72 " +
  "md:flex-col-reverse md:items-start md:transition-[left] md:duration-200 md:ease-linear";
/** In the app: part of the page on phones (first thing in the content, scrolls away), floating from 768px. */
const DOCK_IN_APP = `pointer-events-none mx-3 mt-3 flex flex-col items-stretch gap-2 empty:hidden ${DOCK_DESKTOP}`;
/** Outside the app shell (preview pages): floats on every size. */
const DOCK_FLOATING = `pointer-events-none fixed inset-x-3 top-3 z-40 flex flex-col items-stretch gap-2 ${DOCK_DESKTOP}`;

/**
 * Shared home for the trial and offer cards.
 * Desktop: stacked at the bottom-left of the content area, offset by --sidebar-width
 * (or --sidebar-width-icon when the sidebar is collapsed), so it never covers the sidebar.
 * Phones: a slim strip at the top of the content, under the header.
 * Several cards stack instead of covering each other.
 */
export function ChromeDock({ children }: { children: React.ReactNode }) {
  const sidebar = useChromeSidebar();
  const inApp = sidebar !== null;
  const collapsed = sidebar?.collapsed ?? false;
  const [node, setNode] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    let el = document.getElementById(DOCK_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = DOCK_ID;
      // The app's content column: inside the sidebar wrapper, so --sidebar-width resolves.
      const main = inApp ? document.querySelector(".group\\/sidebar-wrapper main") : null;
      if (main) {
        el.className = DOCK_IN_APP;
        main.insertBefore(el, main.firstChild);
      } else {
        el.className = DOCK_FLOATING;
        document.body.appendChild(el);
      }
    }
    el.dataset.users = String(Number(el.dataset.users || "0") + 1);
    setNode(el);
    return () => {
      const left = Number(el!.dataset.users || "1") - 1;
      el!.dataset.users = String(left);
      if (left <= 0) el!.remove();
    };
  }, [inApp]);

  React.useEffect(() => {
    if (!node) return;
    node.style.setProperty(
      "--dock-left",
      !inApp ? "1rem" : collapsed ? "calc(var(--sidebar-width-icon, 3rem) + 1rem)" : "calc(var(--sidebar-width, 16rem) + 1rem)",
    );
  }, [node, inApp, collapsed]);

  return node ? createPortal(children, node) : null;
}

/** Card surface for anything in the dock. A slim row on phones, a compact card from 768px. */
export const dockCardClass =
  "pointer-events-auto w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-card-foreground shadow-popover md:p-4";
