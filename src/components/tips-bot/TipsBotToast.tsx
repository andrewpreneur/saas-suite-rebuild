import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Lightbulb, ChevronLeft, ChevronRight, Compass, MousePointerClick } from 'lucide-react';
import { popIn, SPRING_SNAPPY } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { useTipsBot, Tip } from './TipsBotContext';
import { cn } from '@/lib/utils';

interface Position {
  top: number;
  left: number;
}

/** Which side of the target the tooltip ended up on. */
type Side = 'right' | 'left' | 'below' | 'above';
type Placement = Side | 'corner';

export const TipsBotToast: React.FC = () => {
  const { isEnabled, currentTip, availableTips, dismissTip, showNextTip, showPrevTip, isLoading, isWalkthroughMode, stopWalkthrough, executeNavigation } = useTipsBot();
  // The context hands out fresh function/array identities on every render.
  // Effects read them through refs so an unrelated re-render can't cancel a
  // pending step navigation or hide the card mid-step (which froze the tour).
  const showNextTipRef = useRef(showNextTip);
  const availableTipsRef = useRef(availableTips);
  const executeNavigationRef = useRef(executeNavigation);
  showNextTipRef.current = showNextTip;
  availableTipsRef.current = availableTips;
  executeNavigationRef.current = executeNavigation;
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [placement, setPlacement] = useState<Placement>('right');
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  /** True when we're highlighting the sidebar entry the user must click. */
  const [awaitingClick, setAwaitingClick] = useState(false);
  /** Walkthrough step whose target never appeared: show the card unanchored. */
  const [unanchored, setUnanchored] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const lastExecutedTipRef = useRef<string | null>(null);


  // Track current index in walkthrough mode
  useEffect(() => {
    if (isWalkthroughMode && currentTip) {
      const idx = availableTips.findIndex(t => t.id === currentTip.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    }
  }, [currentTip, availableTips, isWalkthroughMode]);

  // The walkthrough drives the app: each step switches to the tool / preview
  // tab / panel its target lives on, so a step can never dead-end on a screen
  // the user isn't looking at. Panels sometimes need a second nudge once the
  // tool has mounted, hence the follow-up dispatch.
  useEffect(() => {
    if (!isWalkthroughMode || !currentTip?.navigation) return;
    if (currentTip.id === lastExecutedTipRef.current) return;
    lastExecutedTipRef.current = currentTip.id;
    const tip = currentTip;
    const first = setTimeout(() => executeNavigationRef.current(tip), 60);
    const second = setTimeout(() => executeNavigationRef.current(tip), 700);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
      // Let the step re-navigate if this run was cut short.
      if (lastExecutedTipRef.current === tip.id) lastExecutedTipRef.current = null;
    };
  }, [currentTip?.id, isWalkthroughMode]);

  // ── Resolve which element to highlight ────────────────────────────────
  // If the tip's own target isn't on screen, we highlight the sidebar entry
  // that opens it and wait for the user to click — no auto-redirects.
  useEffect(() => {
    setAwaitingClick(false);
    setTargetElement(null);
    setUnanchored(false);
    setPosition(null);
    setIsVisible(false);
    if (!currentTip || !isEnabled || isLoading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let scrolledTo: HTMLElement | null = null;

    const pick = (selector: string) =>
      Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tip-target="${selector}"]`),
      ).find((el) => {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8;
      }) ?? null;

    let misses = 0;
    let pointerMisses = 0;

    const resolve = () => {
      if (cancelled) return;
      const tool = currentTip.navigation?.selectTool;
      // Sidebar groups are closed unless you are in them; ask the sidebar to open the one this step points at.
      window.dispatchEvent(
        new CustomEvent("ss-sidebar-reveal", {
          detail: { targets: [currentTip.targetSelector, tool ? `sidebar-${tool}` : ""] },
        }),
      );
      const direct = pick(currentTip.targetSelector);
      const pointer = direct ? null : tool ? pick(`sidebar-${tool}`) : null;
      const el = direct ?? pointer;

      // Pointing at the sidebar entry of the tool we're already on is a dead
      // end (clicking it changes nothing). Re-drive the step's navigation.
      if (!direct && pointer && isWalkthroughMode) {
        pointerMisses += 1;
        if (pointerMisses % 4 === 0) executeNavigationRef.current(currentTip);
      } else {
        pointerMisses = 0;
      }

      setAwaitingClick(!direct && !!pointer);
      setTargetElement(el);

      if (el && scrolledTo !== el) {
        scrolledTo = el;
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {
          el.scrollIntoView();
        }
      }

      // Nothing to point at (target and its sidebar entry both absent): give the
      // screen ~2.5s to mount, then move on to the next step. On the LAST step we
      // never auto-stop — the card stays so the user can press "Finish Tour".
      if (!el) {
        misses += 1;
        if (misses > 8 && isWalkthroughMode) {
          const idx = availableTipsRef.current.findIndex((t) => t.id === currentTip.id);
          if (idx >= 0 && idx < availableTipsRef.current.length - 1) {
            showNextTipRef.current();
            return;
          }
          setUnanchored(true);
        }
      } else {
        misses = 0;
        setUnanchored(false);
      }

      // Keep watching: the moment the user clicks through, the tip follows them
      // to the real target on its own.
      timer = setTimeout(resolve, direct ? 1200 : 300);
    };


    resolve();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentTip?.id, isEnabled, isLoading, isWalkthroughMode]);

  // ── Position the card next to the highlighted element ─────────────────
  // Recomputed on scroll/resize through a single rAF so scrolling stays smooth.
  useEffect(() => {
    if (!targetElement || !currentTip) return;

    let frame: number | null = null;
    let measurePass = 0;

    const measure = () => {
      frame = null;
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      const padding = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tooltipWidth = 320;
      const tooltipHeight = Math.min(
        tooltipRef.current?.offsetHeight || 210,
        vh - padding * 2,
      );

      const space: Record<Side, number> = {
        right: vw - rect.right - padding * 2,
        left: rect.left - padding * 2,
        below: vh - rect.bottom - padding * 2,
        above: rect.top - padding * 2,
      };
      const needed: Record<Side, number> = {
        right: tooltipWidth,
        left: tooltipWidth,
        below: tooltipHeight,
        above: tooltipHeight,
      };

      const preferred: Side =
        currentTip.arrowPosition === 'left'
          ? 'right'
          : currentTip.arrowPosition === 'right'
            ? 'left'
            : currentTip.arrowPosition === 'top'
              ? 'below'
              : 'above';
      const order: Side[] = [
        preferred,
        ...(['right', 'left', 'below', 'above'] as Side[]).filter((p) => p !== preferred),
      ];
      const fitting = order.find((p) => space[p] >= needed[p]);

      const clampH = (l: number) =>
        Math.min(Math.max(l, padding), Math.max(vw - tooltipWidth - padding, padding));
      const clampV = (t: number) =>
        Math.min(Math.max(t, padding), Math.max(vh - tooltipHeight - padding, padding));

      const visibleMidY = (Math.max(rect.top, padding) + Math.min(rect.bottom, vh - padding)) / 2;
      const visibleMidX = (Math.max(rect.left, padding) + Math.min(rect.right, vw - padding)) / 2;

      let next: Position;
      if (!fitting) {
        setPlacement('corner');
        next = {
          top: clampV(vh - tooltipHeight - padding * 2),
          left: clampH(vw - tooltipWidth - padding * 2),
        };
      } else {
        setPlacement(fitting);
        switch (fitting) {
          case 'right':
            next = { top: clampV(visibleMidY - tooltipHeight / 2), left: clampH(rect.right + padding) };
            break;
          case 'left':
            next = {
              top: clampV(visibleMidY - tooltipHeight / 2),
              left: clampH(rect.left - tooltipWidth - padding),
            };
            break;
          case 'below':
            next = { top: clampV(rect.bottom + padding), left: clampH(visibleMidX - tooltipWidth / 2) };
            break;
          default:
            next = {
              top: clampV(rect.top - tooltipHeight - padding),
              left: clampH(visibleMidX - tooltipWidth / 2),
            };
            break;
        }
      }

      setPosition((prev) =>
        prev && Math.abs(prev.top - next.top) < 1 && Math.abs(prev.left - next.left) < 1 ? prev : next,
      );
      setIsVisible(true);

      // One re-measure once the card has its real height.
      if (measurePass === 0) {
        measurePass = 1;
        schedule();
      }
    };

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [targetElement, currentTip]);

  // Last-resort placement: a walkthrough step whose target never rendered still
  // shows its card (bottom-right, no highlight) instead of the tour disappearing.
  useEffect(() => {
    if (!unanchored || targetElement) return;
    const place = () => {
      const padding = 16;
      const height = tooltipRef.current?.offsetHeight || 210;
      setPlacement('corner');
      setTargetRect(null);
      setPosition({
        top: Math.max(window.innerHeight - height - padding * 2, padding),
        left: Math.max(window.innerWidth - 320 - padding * 2, padding),
      });
      setIsVisible(true);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [unanchored, targetElement]);


  const handleDismiss = async () => {
    if (!currentTip) return;
    
    setIsExiting(true);
    setTimeout(async () => {
      if (isWalkthroughMode) {
        // In walkthrough mode, dismissing stops the walkthrough
        stopWalkthrough();
      } else {
        await dismissTip(currentTip.id);
      }
      setIsExiting(false);
      setIsVisible(false);
    }, 300);
  };

  const handleNext = () => {
    setIsExiting(true);
    setTimeout(() => {
      showNextTip();
      setIsExiting(false);
      setIsVisible(false);
    }, 300);
  };

  const handlePrev = () => {
    setIsExiting(true);
    setTimeout(() => {
      showPrevTip();
      setIsExiting(false);
      setIsVisible(false);
    }, 200);
  };

  const handleEndWalkthrough = () => {
    // Persist before the exit animation. A delayed write let the next auto tour
    // start, so End Tour / Finish Tour looked like it needed a second click.
    stopWalkthrough({ permanent: true });
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      setIsVisible(false);
    }, 300);
  };

  const handleDisableTours = () => {
    stopWalkthrough({ permanent: true, disableAll: true });
    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      setIsVisible(false);
    }, 300);
  };

  // ── Keyboard: ← → move through the tour, Esc skips it ────────────────
  // Presentation only: each key calls the same handler as its button. Keys are
  // ignored while typing, and Esc is left alone when a dialog is open.
  const keyHandlersRef = useRef({ next: () => {}, prev: () => {}, skip: () => {} });
  const total = availableTips.length;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= total - 1;
  keyHandlersRef.current = {
    next: () => (isLast ? handleEndWalkthrough() : handleNext()),
    prev: () => {
      if (!isFirst) handlePrev();
    },
    skip: handleEndWalkthrough,
  };
  const keysActive = isWalkthroughMode && !!currentTip && !!position;
  useEffect(() => {
    if (!keysActive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = event.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (event.key === 'Escape') {
        if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
        keyHandlersRef.current.skip();
      } else if (event.key === 'ArrowRight') {
        if (el?.closest('[role="tablist"], [role="radiogroup"], [role="slider"], [role="menu"]')) return;
        keyHandlersRef.current.next();
      } else if (event.key === 'ArrowLeft') {
        if (el?.closest('[role="tablist"], [role="radiogroup"], [role="slider"], [role="menu"]')) return;
        keyHandlersRef.current.prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keysActive]);

  if (!isEnabled || !currentTip || isLoading || !position) {
    return null;
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'navigation':
        return 'Navigation';
      case 'customization':
        return 'Customization';
      case 'features':
        return 'Feature';
      case 'content':
        return 'Content';
      default:
        return 'Tip';
    }
  };

  const getArrowStyles = () => {
    const baseStyles = "absolute size-3 rotate-45 border-border bg-card";
    switch (placement) {
      case 'right':
        return `${baseStyles} -left-1.5 top-1/2 -translate-y-1/2 border-b border-l`;
      case 'left':
        return `${baseStyles} -right-1.5 top-1/2 -translate-y-1/2 border-r border-t`;
      case 'below':
        return `${baseStyles} left-1/2 -top-1.5 -translate-x-1/2 border-l border-t`;
      case 'above':
        return `${baseStyles} -bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r`;
      default:
        return baseStyles;
    }
  };

  const pointerLabel = awaitingClick
    ? (targetElement?.textContent || '').trim().split('\n')[0].slice(0, 24)
    : '';

  const shown = isVisible && !isExiting;
  const stepPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <>
      {/* Soft spotlight, walkthrough only: one element sits on the target and
          its spread shadow dims everything else, so the cut-out has rounded
          corners and there is nothing viewport-sized to repaint or blur.
          Ambient tips never dim the page. */}
      {isWalkthroughMode && targetRect && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: shown ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed z-40 rounded-lg shadow-[0_0_0_200vmax_hsl(var(--foreground)/0.45)] ring-2 ring-brand"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        >
          <span className="absolute -inset-1.5 rounded-xl ring-4 ring-brand/25" />
        </motion.div>
      )}

      <div
        ref={tooltipRef}
        className={cn("fixed z-50 w-80", !shown && "pointer-events-none")}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <motion.div
          key={currentTip.id}
          variants={popIn}
          initial="hidden"
          animate={shown ? 'show' : 'exit'}
          role="dialog"
          aria-modal="false"
          aria-labelledby="tips-bot-title"
          aria-describedby="tips-bot-body"
          data-testid="tour-card"
          className="relative rounded-xl border border-border bg-card shadow-dialog"
        >
          {/* Arrow (omitted when the card is parked in a corner) */}
          {placement !== 'corner' && <div className={getArrowStyles()} aria-hidden="true" />}

          <div className="relative overflow-hidden rounded-xl">
            {/* Header: where you are in the tour */}
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand" aria-hidden="true">
                  {isWalkthroughMode ? <Compass className="size-4" /> : <Lightbulb className="size-4" />}
                </span>
                <span className="px-eyebrow truncate" aria-live="polite">
                  {isWalkthroughMode
                    ? `Step ${currentIndex + 1} of ${total}`
                    : `${getCategoryLabel(currentTip.category)} tip`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isWalkthroughMode ? 'Close walkthrough' : 'Dismiss tip'}
              >
                <X className="size-4" />
              </button>
            </div>

            {isWalkthroughMode && (
              <div
                className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Walkthrough progress"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={currentIndex + 1}
              >
                <motion.div
                  className="h-full w-full origin-left rounded-full bg-brand"
                  initial={{ scaleX: Math.max(stepPercent - 100 / Math.max(total, 1), 0) / 100 }}
                  animate={{ scaleX: stepPercent / 100 }}
                  transition={SPRING_SNAPPY}
                />
              </div>
            )}

            {/* Content */}
            <div className="px-4 pb-4 pt-3">
              <h4 id="tips-bot-title" className="text-base font-semibold text-foreground">
                {currentTip.title}
              </h4>
              <p id="tips-bot-body" className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {currentTip.description}
              </p>
              {isWalkthroughMode && awaitingClick && (
                <p className="mt-3 flex items-start gap-2 rounded-md bg-brand-subtle p-2 text-xs font-medium text-brand">
                  <MousePointerClick className="mt-px size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Click the highlighted
                    {pointerLabel ? ` "${pointerLabel}" ` : ' '}
                    item to continue. The tour follows you there.
                  </span>
                </p>
              )}
            </div>

            {/* Footer */}
            {isWalkthroughMode ? (
              <div className="border-t border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={handleEndWalkthrough} className="-ml-2 h-9 px-2 text-muted-foreground">
                    Skip tour
                  </Button>
                  <div className="flex items-center gap-2">
                    {!isFirst && (
                      <Button variant="outline" size="sm" onClick={handlePrev} className="h-9 px-3">
                        <ChevronLeft />
                        Back
                      </Button>
                    )}
                    {isLast ? (
                      <Button variant="accent" size="sm" onClick={handleEndWalkthrough} className="h-9 px-3">
                        Finish tour
                      </Button>
                    ) : (
                      <Button variant="accent" size="sm" onClick={handleNext} className="h-9 px-3">
                        Next
                        <ChevronRight />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={handleDisableTours}
                    className="whitespace-nowrap rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Don't show tours again
                  </button>
                  <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap sm:flex" aria-hidden="true">
                    <kbd className="rounded-sm border border-border bg-card px-1 font-sans">←</kbd>
                    <kbd className="rounded-sm border border-border bg-card px-1 font-sans">→</kbd>
                    move
                    <kbd className="ml-1 rounded-sm border border-border bg-card px-1 font-sans">Esc</kbd>
                    skip
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {`${total} tip${total !== 1 ? 's' : ''} remaining`}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-9 px-2">
                    Dismiss tip
                  </Button>
                  {total > 1 && (
                    <Button variant="outline" size="sm" onClick={handleNext} className="h-9 px-3">
                      Next
                      <ChevronRight />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
};
