import { lazy, Suspense, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Bot, MessageCircle, Sparkles, X, Minimize2, Maximize2, VolumeX, Volume2, Mic } from "lucide-react";
import { parseCopilotRoute } from "@/lib/copilotThreads";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCoPilot } from "@/contexts/CoPilotContext";
import { ChatCoPilot } from "@/components/chat-copilot/ChatCoPilot";
import { useChatContext } from "@/components/chat-copilot/ChatContext";
import { useUser } from "@/contexts/UserContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUiSounds, setCoPilotSoundsMuted } from "@/hooks/useUiSounds";
import { useState } from "react";
import { CoPilotVoiceMode } from "@/components/copilot/CoPilotVoiceMode";
import { computeCopilotOpener } from "@/lib/copilotOpener";
import { currentKitReturn } from "@/lib/kitReturn";
import {
  COPILOT_DOCK_DEFAULT,
  COPILOT_DOCK_STEP,
  clampDockWidth,
  dockPanelWidth,
} from "@/lib/copilotDock";
import {
  humanThreadIsQuiet,
  latestTeamReplyAt,
  teamReplyWithinQuietWindow,
} from "../../../supabase/functions/chat-copilot/handoverQuiet";

const CopilotWorkspace = lazy(() => import("@/pages/Copilot"));

/**
 * Persistent CoPilot shell. Mounted once, survives route changes.
 *  - Dock: right-hand panel beside the app, with the SaaSSuite sidebar still available.
 *  - Modal: expanded over the content column while someone is chatting.
 *  - Bubble: floating trigger bottom-right when the panel is closed.
 */
function CoPilotShellInner({
  inline = false,
  onMessageSent,
}: {
  inline?: boolean;
  onMessageSent?: () => void;
}) {
  const {
    isOpen,
    mode,
    dockNavOpen,
    dockWidth,
    setDockWidth,
    open,
    close,
    setMode,
    preloadedPrompt,
    clearPreloadedPrompt,
  } = useCoPilot();
  const { email, plan } = useUser();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { playOpen, playClose } = useUiSounds();
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem("copilot_sounds_muted") === "1";
    } catch {
      return false;
    }
  });
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceHasOpened, setVoiceHasOpened] = useState(false);
  const { messages, isHandedOver, aiResumedAt } = useChatContext();
  const humanQuiet = humanThreadIsQuiet({
    isHandedOver,
    hasRecentTeamReply: teamReplyWithinQuietWindow(messages),
    resumedAt: aiResumedAt,
    latestTeamReplyAt: latestTeamReplyAt(messages),
  });

  useEffect(() => {
    if (isOpen) playOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (humanQuiet) setVoiceActive(false);
  }, [humanQuiet]);

  const isOnboardingRoute =
    location.pathname.startsWith("/v2-onboarding") ||
    location.pathname.startsWith("/initial-questions");
  const onCopilotRoute = parseCopilotRoute(location.pathname).onCopilotPath;
  const wasCopilotRoute = useRef(false);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (inline) return;
    if (!onCopilotRoute && location.pathname.startsWith("/app")) {
      try { sessionStorage.setItem("ss_copilot_return", location.pathname + location.search); } catch { /* ignore */ }
    }
  }, [inline, onCopilotRoute, location.pathname, location.search]);

  // A direct /app/copilot link opens the panel expanded once. Moving to another
  // feature keeps the chat and returns it to the side so the page stays usable.
  useEffect(() => {
    if (inline) return;
    const pathChanged = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (!email) return;
    if (onCopilotRoute && !wasCopilotRoute.current) {
      open({ mode: "modal" });
      wasCopilotRoute.current = true;
      return;
    }
    if (pathChanged && !onCopilotRoute && mode === "modal") setMode("dock");
    wasCopilotRoute.current = onCopilotRoute;
  }, [inline, onCopilotRoute, email, location.pathname, mode, open, setMode]);

  // Auto-open the side panel on the onboarding wizard so users see the helper.
  useEffect(() => {
    if (isOnboardingRoute && email) {
      open({ mode: "dock" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboardingRoute, email]);

  // Docked panel sizing. The user drags the left edge; the page and its fixed
  // bars read --copilot-dock-offset so nothing sits hidden underneath the panel.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const dockBase = clampDockWidth(dockWidth, viewportWidth);
  const dockTotal = dockPanelWidth(dockWidth, viewportWidth, dockNavOpen);
  const dockVisible =
    !inline &&
    !!email &&
    (location.pathname.startsWith("/app") || isOnboardingRoute) &&
    location.pathname !== "/app/start-here/support" &&
    isOpen &&
    mode === "dock";
  useEffect(() => {
    if (inline) return;
    const root = document.documentElement;
    root.style.setProperty("--copilot-dock-offset", dockVisible ? `${dockTotal}px` : "0px");
    return () => {
      root.style.setProperty("--copilot-dock-offset", "0px");
    };
  }, [inline, dockVisible, dockTotal]);
  const resizeDock = (clientX: number) =>
    setDockWidth(
      clampDockWidth(window.innerWidth - clientX - (dockTotal - dockBase), window.innerWidth),
    );

  // Don't render for logged-out users, and only render inside the authenticated app
  // and during the onboarding flow. Never on marketing/landing pages.
  if (!email) return null;
  if (!location.pathname.startsWith("/app") && !isOnboardingRoute) return null;
  if (!inline && location.pathname === "/app/start-here/support") return null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setCoPilotSoundsMuted(next);
  };

  const handleMinimizeToBubble = () => setMode("bubble");
  const handleClose = () => {
    playClose();
    setVoiceActive(false);
    close();
    if (onCopilotRoute) {
      const kitReturn = currentKitReturn(location.search);
      let back = kitReturn || "/app/dashboard";
      if (!kitReturn) {
        try {
          back = sessionStorage.getItem("ss_copilot_return") || back;
        } catch {
          /* ignore */
        }
      }
      navigate(back);
    }
  };
  const handleEnterVoice = () => setVoiceActive(true);
  const handleExitVoice = () => setVoiceActive(false);

  // The launcher keeps the signed-in workspace inside the app shell.
  if (!inline) {
    const panelOpen = isOpen && mode !== "bubble";
    const expanded = mode === "modal";
    return createPortal(
      <>
        {!panelOpen && (
          <Button
            size="icon"
            onClick={() => {
              if (preloadedPrompt) {
                navigate("/app/copilot", { state: { copilotSource: location.pathname + location.search, copilotPrompt: preloadedPrompt } });
                clearPreloadedPrompt();
                open({ mode: "modal" });
                return;
              }
              open({ mode: "dock" });
            }}
            aria-label="Open SaaSSuite Copilot"
            title="Work with Copilot"
            className={cn(
              "fixed z-[60] rounded-full shadow-lg bg-primary text-primary-foreground",
              "flex items-center justify-center transition-transform hover:scale-105 motion-reduce:transition-none",
              "w-14 h-14",
              isMobile ? "bottom-24 right-4" : "bottom-6 right-6",
            )}
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
        )}
        {panelOpen && (
          <div
            data-copilot-panel={expanded ? "expanded" : "dock"}
            style={
              expanded ? undefined : ({ "--copilot-dock-w": `${dockTotal}px` } as React.CSSProperties)
            }
            className={cn(
              "fixed flex min-h-0 flex-col overflow-hidden bg-background",
              expanded
                ? "inset-0 z-[55] md:left-64"
                : "bottom-0 right-0 top-14 z-40 w-full border-l border-border shadow-2xl sm:w-[var(--copilot-dock-w)] md:top-0",
            )}
          >
            {!expanded && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize Copilot panel"
                aria-valuenow={dockBase}
                tabIndex={0}
                title="Drag to resize. Double-click to reset."
                data-testid="copilot-resize-handle"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setResizing(true);
                }}
                onPointerMove={(event) => {
                  if (resizing) resizeDock(event.clientX);
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setResizing(false);
                }}
                onPointerCancel={() => setResizing(false)}
                onDoubleClick={() => setDockWidth(COPILOT_DOCK_DEFAULT)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const step = event.key === "ArrowLeft" ? COPILOT_DOCK_STEP : -COPILOT_DOCK_STEP;
                  setDockWidth(clampDockWidth(dockBase + step, window.innerWidth));
                }}
                className={cn(
                  "group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize touch-none select-none sm:block",
                  "focus-visible:outline-none",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 transition-colors group-hover:bg-brand group-focus-visible:bg-brand",
                    resizing ? "bg-brand" : "bg-transparent",
                  )}
                />
                <span
                  aria-hidden="true"
                  className="absolute left-0.5 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-border group-hover:bg-brand"
                />
              </div>
            )}
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Copilot…</div>}>
              <CopilotWorkspace
                embedded
                presentation={expanded ? "expanded" : "dock"}
                onExpand={() => setMode("modal")}
                onCollapse={() => setMode("dock")}
                onClose={handleClose}
              />
            </Suspense>
          </div>
        )}
      </>,
      document.body,
    );
  }

  const effectiveMode: "modal" | "dock" = isMobile ? "modal" : "dock";

  const headerControls = (
    <div className="flex items-center gap-1">
      {!voiceActive && !humanQuiet && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleEnterVoice}
          title="Voice mode"
        >
          <Mic className="w-4 h-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={toggleMute}
        title={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => { setMode("bubble"); navigate("/app/copilot"); }}
        title="Full screen"
        aria-label="Open Copilot full screen"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
      {!inline && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleMinimizeToBubble}
          title="Minimize"
        >
          <Minimize2 className="w-4 h-4" />
        </Button>
      )}
      {!inline && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} title="Close">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  // Reuse the personalized opener that ChatContext already built (with the
  // user's first name + account snapshot). Falls back to a rule-based one.
  const proactiveOpener = (() => {
    const initial = messages.find((m) => m.id === "initial");
    if (initial?.content) return initial.content;
    try {
      const route = typeof window !== "undefined" ? window.location.pathname : "/";
      return computeCopilotOpener({ plan, route }).message;
    } catch {
      return undefined;
    }
  })();

  const shellContent = (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Custom header (replaces the inline one) */}
      <div className="flex items-center justify-between gap-2 p-3 md:p-4 border-b bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm md:text-base flex items-center gap-1.5 truncate">
              {inline ? "SaaSSuite AI Copilot" : "SaaSSuite CoPilot"}
              <Sparkles className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
            </h2>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {voiceActive
                ? "Voice mode"
                : isOnboardingRoute
                  ? "Onboarding assistant"
                  : "Configuration assistant"}
            </p>
          </div>
        </div>
        {headerControls}
      </div>

      {/* Chat body — ChatCoPilot stays mounted so voice-mode messages persist
          in the shared ChatContext. Voice UI simply overlays it. */}
      <div className="flex-1 min-h-0 relative">
        <div className={cn("absolute inset-0", voiceActive && "invisible pointer-events-none")}>
          <ChatCoPilot
            preloadedPrompt={preloadedPrompt}
            hideHeader
            onPromptConsumed={() => {
              clearPreloadedPrompt();
              onMessageSent?.();
            }}
          />
        </div>
        {voiceActive && (
          <div className="absolute inset-0">
            <CoPilotVoiceMode
              onExit={handleExitVoice}
              proactiveOpener={proactiveOpener}
              playOpener={!voiceHasOpened}
              onVoiceStarted={() => setVoiceHasOpened(true)}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (inline) return shellContent;

  if (effectiveMode === "modal") {
    return createPortal(
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-0 md:p-6 animate-fade-in">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleMinimizeToBubble}
        />
        {/* Centered card */}
        <div
          className={cn(
            "relative bg-card border border-border rounded-none md:rounded-2xl shadow-2xl",
            "w-full h-full md:w-[640px] md:h-[720px] md:max-h-[85vh] flex flex-col overflow-hidden",
          )}
        >
          {shellContent}
        </div>
      </div>,
      document.body,
    );
  }

  // DOCK mode (desktop only)
  return createPortal(
    <div className="fixed top-0 right-0 bottom-0 z-[55] w-full sm:w-[400px] max-w-[100vw] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
      {shellContent}
    </div>,
    document.body,
  );
}

/**
 * The app-level ChatProvider shares the shell and START HERE conversation.
 */
export function CoPilotShell({
  inline = false,
  onMessageSent,
}: {
  inline?: boolean;
  onMessageSent?: () => void;
}) {
  return <CoPilotShellInner inline={inline} onMessageSent={onMessageSent} />;
}
