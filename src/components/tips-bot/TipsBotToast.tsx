import React, { useState, useEffect, useRef } from 'react';
import { X, Lightbulb, ChevronRight, MousePointerClick } from 'lucide-react';
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
  const { isEnabled, currentTip, availableTips, dismissTip, showNextTip, isLoading, isWalkthroughMode, stopWalkthrough, executeNavigation } = useTipsBot();
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
      const direct = pick(currentTip.targetSelector);
      const tool = currentTip.navigation?.selectTool;
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

  if (!isEnabled || !currentTip || isLoading || !position) {
    return null;
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'navigation':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'customization':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'features':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'content':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

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
    const baseStyles = "absolute w-3 h-3 bg-card border rotate-45";
    switch (placement) {
      case 'right':
        return `${baseStyles} -left-1.5 top-1/2 -translate-y-1/2 border-l border-b border-r-0 border-t-0`;
      case 'left':
        return `${baseStyles} -right-1.5 top-1/2 -translate-y-1/2 border-r border-t border-l-0 border-b-0`;
      case 'below':
        return `${baseStyles} left-1/2 -translate-x-1/2 -top-1.5 border-t border-l border-b-0 border-r-0`;
      case 'above':
        return `${baseStyles} left-1/2 -translate-x-1/2 -bottom-1.5 border-b border-r border-t-0 border-l-0`;
      default:
        return baseStyles;
    }
  };

  const pointerLabel = awaitingClick
    ? (targetElement?.textContent || '').trim().split('\n')[0].slice(0, 24)
    : '';

  return (
    <>
      {/* Only an explicit walkthrough may dim the page. Ambient tips should
          never paint viewport-sized overlay slabs around a large target.
          No backdrop-blur here — blurring four viewport-sized slabs on every
          scroll frame is what made the walkthrough feel laggy. */}
      {isWalkthroughMode && targetRect && (
        <>
          <div className="fixed left-0 right-0 top-0 z-30 bg-background/75 pointer-events-none" style={{ height: Math.max(targetRect.top - 8, 0) }} />
          <div className="fixed left-0 z-30 bg-background/75 pointer-events-none" style={{ top: Math.max(targetRect.top - 8, 0), width: Math.max(targetRect.left - 8, 0), height: targetRect.height + 16 }} />
          <div className="fixed right-0 z-30 bg-background/75 pointer-events-none" style={{ top: Math.max(targetRect.top - 8, 0), left: targetRect.right + 8, height: targetRect.height + 16 }} />
          <div className="fixed left-0 right-0 bottom-0 z-30 bg-background/75 pointer-events-none" style={{ top: targetRect.bottom + 8 }} />
        </>
      )}


      {/* Keep the target ring scoped to walkthrough mode for the same reason. */}
      {isWalkthroughMode && targetRect && (
        <div
          className="fixed pointer-events-none z-40 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
      
      <div
        ref={tooltipRef}
        className={cn(
          "fixed z-50 w-80 transition-all duration-300 ease-in-out",
          isVisible && !isExiting
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="relative bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Arrow (omitted when the card is parked in a corner) */}
          {placement !== 'corner' && <div className={getArrowStyles()} />}
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Lightbulb className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Product Tip</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full border",
                getCategoryColor(currentTip.category)
              )}>
                {getCategoryLabel(currentTip.category)}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              aria-label="Dismiss tip"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            <h4 className="text-sm font-semibold text-foreground mb-1">
              {currentTip.title}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentTip.description}
            </p>
            {isWalkthroughMode && awaitingClick && (
              <p className="mt-3 flex items-start gap-2 text-xs font-medium text-primary">
                <MousePointerClick className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
                <span>
                  Click the highlighted
                  {pointerLabel ? ` "${pointerLabel}" ` : ' '}
                  item to continue — the tour follows you there.
                </span>
              </p>
            )}
          </div>


          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {isWalkthroughMode 
                ? `Step ${currentIndex + 1} of ${availableTips.length}`
                : `${availableTips.length} tip${availableTips.length !== 1 ? 's' : ''} remaining`
              }
            </span>
            <div className="flex items-center gap-2">
              {isWalkthroughMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisableTours}
                    className="text-xs h-7 px-2"
                  >
                    Don't show tours
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEndWalkthrough}
                    className="text-xs h-7 px-2"
                  >
                    End Tour
                  </Button>
                  {currentIndex < availableTips.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      className="text-xs h-7 px-2"
                    >
                      Next
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                  {currentIndex === availableTips.length - 1 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleEndWalkthrough}
                      className="text-xs h-7 px-2"
                    >
                      Finish Tour
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="text-xs h-7 px-2"
                  >
                    Dismiss Tip
                  </Button>
                  {availableTips.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNext}
                      className="text-xs h-7 px-2"
                    >
                      Next
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
