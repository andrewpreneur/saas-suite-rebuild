import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useChatContext } from '@/components/chat-copilot/ChatContext';

type Msg = { role: 'user' | 'assistant'; content: string };
type Status = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

interface Props {
  onExit: () => void;
  proactiveOpener?: string;
  playOpener?: boolean;
  onVoiceStarted?: () => void;
}

const SUPABASE_URL = 'https://backend-disconnected.invalid';

// Tiny silent WAV — used to "unlock" a persistent <audio> element on the
// initial user gesture so subsequent programmatic .play() calls work on iOS
// even after async fetch/STT delays break the gesture chain.
const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

const VOICE_PRESETS = [
  'How many users do I have?',
  'What should I set up next?',
  'List my workflows',
  'Give me an account health check',
];

export function CoPilotVoiceMode({ onExit, proactiveOpener, playOpener = true, onVoiceStarted }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const spokeRef = useRef(false);
  const greetedRef = useRef(false);
  const activeRef = useRef(true);
  const ignoreRecordingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Voice mode uses the same shared chat context as text mode. The edge
  // function persists both user + assistant turns server-side using auth.
  const { messages: sharedMessages, addMessage } = useChatContext();
  const sharedMessagesRef = useRef(sharedMessages);

  useEffect(() => {
    sharedMessagesRef.current = sharedMessages;
  }, [sharedMessages]);

  const authHeader = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  };

  const getClientContext = () => {
    if (typeof window === 'undefined') return { isMobile: false };
    return {
      isMobile: window.innerWidth < 768 || !!window.matchMedia?.('(pointer: coarse)')?.matches,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  };

  const stopVadLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    silenceStartRef.current = null;
    spokeRef.current = false;
    setLevel(0);
  };

  const stopCurrentActivity = useCallback((discardRecording = true) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    try { audioRef.current?.pause(); } catch {}
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      try { audioRef.current.src = ''; } catch {}
    }
    if (discardRecording) ignoreRecordingRef.current = true;
    if (recorderRef.current) {
      try {
        recorderRef.current.ondataavailable = null as any;
        recorderRef.current.onstop = null as any;
        if (recorderRef.current.state === 'recording') recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopVadLoop();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    setStatus('speaking');
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/copilot-voice-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      abortControllerRef.current = null;
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      if (!activeRef.current) return;
      const url = URL.createObjectURL(blob);
      // Reuse a single <audio> element that was unlocked by the user gesture
      // that opened voice mode. Creating a fresh Audio() after async work
      // breaks the gesture chain on iOS Safari, causing "voice playback
      // failed" from the second message onward.
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.onended = () => { if (!activeRef.current) return; setStatus('idle'); startListening(); };
      audio.onerror = () => { if (!activeRef.current) return; setStatus('idle'); startListening(); };
      audio.src = url;
      try {
        await audio.play();
      } catch (err) {
        console.error('audio.play failed', err);
        throw err;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      if (activeRef.current) toast.error('Voice playback failed');
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = useCallback(async (userText: string) => {
    const next: Msg[] = [
      ...sharedMessagesRef.current
        .filter((m) => m.id !== 'initial')
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userText },
    ];
    addMessage({ role: 'user', content: userText });
    setStatus('thinking');
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/copilot-voice-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ messages: next, client: getClientContext() }),
        signal: controller.signal,
      });
      abortControllerRef.current = null;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `chat ${res.status}`);
      if (!activeRef.current) return;
      const reply = data.text || "I didn't catch that.";
      addMessage({ role: 'assistant', content: reply });
      await speak(reply);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      if (activeRef.current) toast.error(e.message || 'Chat failed');
      setStatus('idle');
    }
  }, [addMessage, speak]);

  const finishRecording = useCallback((discard = false) => {
    if (discard) ignoreRecordingRef.current = true;
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!activeRef.current) return;
    if (muted) return;
    if (status !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      ignoreRecordingRef.current = false;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stopVadLoop();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (!activeRef.current || ignoreRecordingRef.current) {
          ignoreRecordingRef.current = false;
          return;
        }
        const type = rec.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'mp4' : type.includes('webm') ? 'webm' : 'wav';
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 2048) { setStatus('idle'); if (activeRef.current && !muted) startListening(); return; }
        setStatus('transcribing');
        try {
          const controller = new AbortController();
          abortControllerRef.current = controller;
          const fd = new FormData();
          fd.append('file', blob, `recording.${ext}`);
          const res = await fetch(`${SUPABASE_URL}/functions/v1/copilot-voice-stt`, {
            method: 'POST', headers: await authHeader(), body: fd,
            signal: controller.signal,
          });
          abortControllerRef.current = null;
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `STT ${res.status}`);
          const text = (data.text || '').trim();
          if (!activeRef.current) return;
          if (!text) { setStatus('idle'); startListening(); return; }
          await ask(text);
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          console.error(e);
          if (activeRef.current) toast.error(e.message || 'Transcription failed');
          setStatus('idle');
        }
      };
      rec.start();
      recorderRef.current = rec;
      setStatus('listening');

      // VAD loop: 2.5s of silence after speech => stop
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.fftSize);
      const SPEECH_THRESHOLD = 12;   // RMS 0-255
      const SILENCE_MS = 2500;
      const MAX_MS = 15000;
      const startedAt = performance.now();

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i] - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(rms);
        const now = performance.now();
        if (rms > SPEECH_THRESHOLD) {
          spokeRef.current = true;
          silenceStartRef.current = null;
        } else if (spokeRef.current) {
          if (silenceStartRef.current == null) silenceStartRef.current = now;
          if (now - silenceStartRef.current > SILENCE_MS) {
            finishRecording();
            return;
          }
        }
        if (now - startedAt > MAX_MS) { finishRecording(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      toast.error('Microphone access denied');
    }
  }, [ask, finishRecording, muted, status]);

  // Kick off voice. If this is an existing conversation, do not replay the
  // opener; just resume listening in the same thread.
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    activeRef.current = true;
    // Pre-create + unlock a persistent <audio> element while we're still
    // close to the click that mounted this component. Calling .play() with
    // an inline silent data URI marks the element as user-activated on iOS,
    // so later programmatic playback (after fetch/STT) is allowed.
    try {
      const a = new Audio();
      a.src = SILENCE_WAV;
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === 'function') p.catch(() => {});
      a.muted = false;
      audioRef.current = a;
    } catch (err) {
      console.warn('audio unlock skipped', err);
    }
    onVoiceStarted?.();
    const hasConversation = sharedMessagesRef.current.some((m) => m.id !== 'initial');
    if (hasConversation || !playOpener) {
      void startListening();
    } else {
      const opener = proactiveOpener || "Hey — I'm listening. What can I help you with?";
      void speak(opener);
    }
    return () => {
      activeRef.current = false;
      stopCurrentActivity(true);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (next) { finishRecording(true); }
      return next;
    });
  };

  const handleStopSpeaking = () => {
    audioRef.current?.pause();
    setStatus('idle');
    startListening();
  };

  const handlePreset = (text: string) => {
    if (status === 'thinking' || status === 'transcribing') return;
    // Stop any current playback / listening cleanly, then send.
    stopCurrentActivity(true);
    setStatus('idle');
    void ask(text);
  };

  const handleExit = () => {
    activeRef.current = false;
    stopCurrentActivity(true);
    onExit();
  };

  const statusLabel: Record<Status, string> = {
    idle: 'Ready',
    listening: 'Listening…',
    transcribing: 'Transcribing…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
  };

  // Orb size pulse from mic level
  // Only breathe with the mic while actively listening — during TTS/thinking
  // keep the orb still to avoid a flashing/jitter effect.
  const scale = status === 'listening' ? 1 + Math.min(0.4, level / 100) : 1;
  const latestMessage = sharedMessages[sharedMessages.length - 1];
  const displayedText = latestMessage?.content || proactiveOpener || '';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b bg-card/60">
        <div>
          <h3 className="font-semibold text-sm">Voice mode</h3>
          <p className="text-xs text-muted-foreground">{statusLabel[status]}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExit} title="Exit voice mode">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
        <div
          className={cn(
            'w-40 h-40 md:w-52 md:h-52 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-400',
            'shadow-2xl transition-transform duration-150 ease-out flex items-center justify-center',
            status === 'listening' && 'ring-4 ring-blue-400/40',
            status === 'speaking' && 'ring-4 ring-emerald-400/50',
            status === 'thinking' && 'ring-4 ring-amber-400/40',
          )}
          style={{ transform: `scale(${scale})` }}
        >
          {status === 'thinking' || status === 'transcribing' ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <Mic className="w-14 h-14 text-white" />
          )}
        </div>

        <div className="max-w-md text-center min-h-[60px]">
          <p className="text-sm text-muted-foreground">
            {displayedText}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleMute}>
            {muted ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
            {muted ? 'Unmute' : 'Mute'}
          </Button>
          {status === 'speaking' && (
            <Button variant="outline" size="sm" onClick={handleStopSpeaking}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleExit}>Back to chat</Button>
        </div>

        {/* Preset prompts — tap to ask without speaking. Useful on mobile
            when mic permission or noise is a problem. */}
        <div className="w-full max-w-md">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 text-center">
            Try asking
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {VOICE_PRESETS.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-3 whitespace-normal"
                onClick={() => handlePreset(p)}
                disabled={status === 'thinking' || status === 'transcribing'}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
