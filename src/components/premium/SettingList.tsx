import { useState, type ReactNode } from "react";
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
  const opens = Boolean(children) || Boolean(onOpen);

  return (
    <div className="flex items-stretch">
      <button
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

      {children ? (
        <EditorPanel
          open={open}
          onOpenChange={setOpen}
          title={panel?.title ?? title}
          description={panel?.description}
          footer={panel?.footer}
          wide={panel?.wide}
          side={isMobile ? "bottom" : "right"}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  side?: "right" | "bottom";
}) {
  const isMobile = useIsMobile();
  const resolved = side ?? (isMobile ? "bottom" : "right");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={resolved}
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
