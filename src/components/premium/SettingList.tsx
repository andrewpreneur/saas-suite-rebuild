import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * The calm way to show a page full of settings: ONE card of rows. Each row says
 * what the setting is and what it is set to right now; the editor opens in a
 * side panel only when the row is clicked. A page that used to be six stacked
 * forms becomes six lines.
 *
 *   <SettingList>
 *     <SettingItem icon={<Hand />} title="Welcome message" value="Welcome to your custom software solution"
 *       toggle={<Switch ... />} panel={{ description: "The headline clients read first." }}>
 *       ...the existing editor fields and Save button...
 *     </SettingItem>
 *   </SettingList>
 */
/**
 * "Pages" mode. Wrap a screen in <SettingPages> and its SettingItem rows stop
 * opening a side panel: clicking a row replaces the whole list with that
 * setting's own page (a back link, the title, the form). Use it where the
 * settings ARE the screen (Settings); keep panels where a row edits something
 * beside content you still need to see.
 */
type PagesContext = { openId: string | null; setOpenId: (id: string | null) => void; backLabel: string };
const SettingPagesContext = createContext<PagesContext | null>(null);

export function SettingPages({
  children,
  backLabel = "All settings",
  onOpenChange,
}: {
  children: ReactNode;
  backLabel?: string;
  /** Called with true when a setting page opens and false when the list returns. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [openId, setOpenIdState] = useState<string | null>(null);
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    onOpenChange?.(id !== null);
  };
  return (
    <SettingPagesContext.Provider value={{ openId, setOpenId, backLabel }}>{children}</SettingPagesContext.Provider>
  );
}

/** True while one setting's page is showing. Hide page chrome (header, danger zone) with it. */
export function useSettingPageOpen(): boolean {
  return useContext(SettingPagesContext)?.openId != null;
}

/** Wrap anything that should disappear while a setting page is open. */
export function HideWhileSettingOpen({ children }: { children: ReactNode }) {
  return useSettingPageOpen() ? null : <>{children}</>;
}

export function SettingList({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  /** Optional small heading above the card, for pages with two or three groups. */
  label?: string;
}) {
  const pageOpen = useSettingPageOpen();
  // While one setting's page is open the card and its label step aside; only the open item draws.
  if (pageOpen) return <>{children}</>;
  return (
    <section className={className}>
      {label ? <h2 className="px-eyebrow mb-2 px-1 !text-[11px] !leading-4">{label}</h2> : null}
      <div className="px-surface divide-y divide-border/70 overflow-hidden">{children}</div>
    </section>
  );
}

export function SettingItem({
  icon,
  title,
  value,
  status,
  toggle,
  children,
  panel,
  onOpen,
  open: openProp,
  onOpenChange,
  disabled,
  testId,
}: {
  icon?: ReactNode;
  title: string;
  /** What it is set to now, in a few words. Truncates on one line. */
  value?: ReactNode;
  /** A small badge on the right (On, Off, 3 videos, Needs setup). */
  status?: ReactNode;
  /** A switch that works without opening the panel. */
  toggle?: ReactNode;
  /** The editor. Rendered inside the side panel, only while it is open. */
  children?: ReactNode;
  panel?: { title?: string; description?: ReactNode; footer?: ReactNode; wide?: boolean };
  /** Use instead of `children` when the row should navigate or run something. */
  onOpen?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (next: boolean) => {
    setInner(next);
    onOpenChange?.(next);
  };
  const isMobile = useIsMobile();
  const rowRef = useRef<HTMLButtonElement>(null);
  const opens = Boolean(children) || Boolean(onOpen);
  const pages = useContext(SettingPagesContext);
  const pageId = useId();
  const asPage = Boolean(pages && children);

  // In pages mode the shared context holds which item is open, so a controlled `open` prop is mirrored into it.
  useEffect(() => {
    if (!pages || !asPage) return;
    if (open && pages.openId !== pageId) pages.setOpenId(pageId);
    if (!open && pages.openId === pageId) pages.setOpenId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asPage]);

  if (pages && pages.openId !== null) {
    if (pages.openId !== pageId || !asPage) return null;
    return (
      <motion.section
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT }}
        aria-label={panel?.title ?? title}
        data-testid={testId ? `${testId}-page` : undefined}
      >
        <button
          type="button"
          autoFocus
          onClick={() => {
            setOpen(false);
            pages.setOpenId(null);
          }}
          className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {pages.backLabel}
        </button>
        <header className="mb-5 flex items-start gap-3">
          {icon ? (
            <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-h4 tracking-tight text-foreground">{panel?.title ?? title}</h2>
            {panel?.description ? <p className="mt-0.5 text-sm text-muted-foreground">{panel.description}</p> : null}
          </div>
        </header>
        <div className="px-surface p-4 sm:p-6">{children}</div>
        {panel?.footer ? <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{panel.footer}</div> : null}
      </motion.section>
    );
  }

  return (
    <div className="flex items-stretch">
      <button
        ref={rowRef}
        type="button"
        disabled={disabled || !opens}
        data-testid={testId}
        onClick={() => (children ? setOpen(true) : onOpen?.())}
        className={cn(
          "group flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors duration-150 sm:px-5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          opens && !disabled ? "hover:bg-[hsl(var(--brand-subtle))]/60" : "cursor-default",
          disabled && "opacity-60",
        )}
      >
        {icon ? (
          <span className="px-icon-chip size-9 shrink-0 [&_svg]:size-[18px]" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
          {value ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{value}</span> : null}
        </span>
        {status ? <span className="shrink-0 text-xs font-medium text-muted-foreground">{status}</span> : null}
        {opens && !toggle ? (
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        ) : null}
      </button>
      {toggle ? (
        <div className="flex shrink-0 items-center gap-2 pr-4 sm:pr-5">
          {toggle}
          {opens ? <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" /> : null}
        </div>
      ) : null}

      {children && !asPage ? (
        <EditorPanel
          open={open}
          onOpenChange={setOpen}
          title={panel?.title ?? title}
          description={panel?.description}
          footer={panel?.footer}
          wide={panel?.wide}
          side={isMobile ? "bottom" : "right"}
          returnFocusTo={rowRef}
        >
          {children}
        </EditorPanel>
      ) : null}
    </div>
  );
}

/**
 * A side panel (bottom sheet on phones) for editing one thing. Use it directly
 * when the thing that opens it is not a SettingItem row.
 */
export function EditorPanel({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  wide,
  side,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  side?: "right" | "bottom";
  /** Where keyboard focus goes when the panel closes (the row or button that opened it). */
  returnFocusTo?: RefObject<HTMLElement>;
}) {
  const isMobile = useIsMobile();
  const resolved = side ?? (isMobile ? "bottom" : "right");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={resolved}
        onCloseAutoFocus={(event) => {
          if (returnFocusTo?.current) {
            event.preventDefault();
            returnFocusTo.current.focus();
          }
        }}
        className={cn(
          "flex flex-col gap-0 p-0",
          resolved === "right"
            ? cn("w-full sm:max-w-none", wide ? "sm:w-[720px]" : "sm:w-[520px]")
            : "max-h-[92dvh] rounded-t-2xl",
        )}
      >
        <SheetHeader className="space-y-1 border-b border-border/70 px-5 py-4 pr-12 text-left sm:px-6">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
