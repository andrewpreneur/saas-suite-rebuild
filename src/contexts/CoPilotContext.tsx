import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { COPILOT_DOCK_DEFAULT, COPILOT_DOCK_STORAGE_KEY, readStoredDockWidth } from '@/lib/copilotDock';

export type CoPilotMode = 'modal' | 'dock' | 'bubble';

interface CoPilotContextValue {
  isOpen: boolean;
  mode: CoPilotMode;
  /** Docked panel is wide enough for its inline chat menu. */
  dockNavOpen: boolean;
  setDockNavOpen: (open: boolean) => void;
  /** Width the user dragged the docked panel to, in pixels. Remembered per browser. */
  dockWidth: number;
  setDockWidth: (width: number) => void;
  preloadedPrompt?: string;
  open: (opts?: { mode?: CoPilotMode; prompt?: string }) => void;
  close: () => void;
  setMode: (mode: CoPilotMode) => void;
  toggle: () => void;
  clearPreloadedPrompt: () => void;
}

const CoPilotContext = createContext<CoPilotContextValue | undefined>(undefined);

const STORAGE_KEY = 'copilot_last_mode';

export function CoPilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<CoPilotMode>('dock');
  const [dockNavOpen, setDockNavOpenState] = useState(false);
  const [preloadedPrompt, setPreloadedPrompt] = useState<string | undefined>(undefined);
  const [dockWidth, setDockWidthState] = useState<number>(() => {
    try { return readStoredDockWidth(localStorage.getItem(COPILOT_DOCK_STORAGE_KEY)); } catch { return COPILOT_DOCK_DEFAULT; }
  });
  const setDockWidth = useCallback((width: number) => {
    setDockWidthState(width);
    try { localStorage.setItem(COPILOT_DOCK_STORAGE_KEY, String(Math.round(width))); } catch {}
  }, []);

  // Restore last mode preference. Desktop only ever uses 'dock' now — we
  // keep this to remember 'bubble' vs open state across reloads if needed.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CoPilotMode | null;
      if (stored === 'dock' || stored === 'bubble') setModeState(stored);
    } catch {}
  }, []);

  const setMode = useCallback((next: CoPilotMode) => {
    setModeState(next);
    if (next !== 'bubble') {
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    }
  }, []);

  const open = useCallback((opts?: { mode?: CoPilotMode; prompt?: string }) => {
    setIsOpen(true);
    if (opts?.mode) setMode(opts.mode);
    if (opts?.prompt) setPreloadedPrompt(opts.prompt);
  }, [setMode]);

  const close = useCallback(() => {
    setIsOpen(false);
    setDockNavOpenState(false);
  }, []);
  const setDockNavOpen = useCallback((open: boolean) => setDockNavOpenState(open), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const clearPreloadedPrompt = useCallback(() => setPreloadedPrompt(undefined), []);

  const value = useMemo<CoPilotContextValue>(() => ({
    isOpen, mode, dockNavOpen, setDockNavOpen, dockWidth, setDockWidth, preloadedPrompt, open, close, setMode, toggle, clearPreloadedPrompt,
  }), [isOpen, mode, dockNavOpen, setDockNavOpen, dockWidth, setDockWidth, preloadedPrompt, open, close, setMode, toggle, clearPreloadedPrompt]);

  return <CoPilotContext.Provider value={value}>{children}</CoPilotContext.Provider>;
}

export function useCoPilot() {
  const ctx = useContext(CoPilotContext);
  if (!ctx) throw new Error('useCoPilot must be used within CoPilotProvider');
  return ctx;
}
