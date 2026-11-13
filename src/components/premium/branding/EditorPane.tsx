import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DURATION, EASE_OUT } from "@/lib/motion";

const LAYERS =
  '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]';

/**
 * A setting's editor shown in place of the settings list, beside the live
 * preview. Unlike a side sheet it is not modal: nothing covers the preview, so
 * every change is seen as it is made. Esc or the back button returns to the list.
 */
export function EditorPane({
  title,
  description,
  onClose,
  children,
  footer,
  backLabel = "All settings",
  testId,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  backLabel?: string;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const backRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      // A popover, menu or dialog on top closes first; Esc is theirs.
      if (target?.closest(LAYERS)) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, x: reduce ? 0 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      aria-label={title}
      data-testid={testId}
      className="px-surface flex min-w-0 flex-col"
    >
      <header className="flex flex-col gap-2 border-b border-border/70 px-4 pb-4 pt-3 sm:px-6">
        <Button
          ref={backRef}
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 min-h-11 self-start text-muted-foreground sm:min-h-9"
          onClick={onClose}
          data-testid="design-editor-back"
        >
          <ArrowLeft aria-hidden />
          {backLabel}
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 sm:px-6">
          {footer}
        </div>
      ) : null}
    </motion.section>
  );
}
