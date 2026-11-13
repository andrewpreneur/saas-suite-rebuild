import { useCallback, useRef } from 'react';

// Lightweight synthesized UI sounds via Web Audio API.
// No assets, no network. Respects localStorage mute toggle.
const MUTE_KEY = 'copilot_sounds_muted';

function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setCoPilotSoundsMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

export function useUiSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      try {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (Ctx) ctxRef.current = new Ctx();
      } catch {}
    }
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const beep = useCallback((freq: number, duration = 0.08, type: OscillatorType = 'sine', gain = 0.05) => {
    if (isMuted()) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }, [ensureCtx]);

  const playSend = useCallback(() => beep(720, 0.06, 'sine', 0.04), [beep]);
  const playReceive = useCallback(() => {
    beep(520, 0.07, 'sine', 0.05);
    setTimeout(() => beep(780, 0.09, 'sine', 0.04), 55);
  }, [beep]);
  const playOpen = useCallback(() => beep(880, 0.09, 'triangle', 0.035), [beep]);
  const playClose = useCallback(() => beep(340, 0.09, 'triangle', 0.03), [beep]);

  return { playSend, playReceive, playOpen, playClose };
}
