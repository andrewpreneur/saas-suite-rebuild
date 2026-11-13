import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Square, Loader2, Volume2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import PageSEO from "@/components/PageSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

import { isPlatformAdminEmail } from "@/lib/platformAdmins";

type Msg = { role: "user" | "assistant"; content: string };
type Status = "idle" | "recording" | "transcribing" | "thinking" | "speaking";
type VoiceOpt = { voice_id: string; name: string; labels?: Record<string, string> };
type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George
const DEFAULT_MODEL = "eleven_turbo_v2_5";
const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.4,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
  speed: 1.05,
};
const MODELS = [
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 (low latency)" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 (highest quality)" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 (fastest)" },
  { id: "eleven_turbo_v2", label: "Turbo v2" },
];
const FALLBACK_VOICES: VoiceOpt[] = [
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { voice_id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { voice_id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { voice_id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { voice_id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
  { voice_id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },
  { voice_id: "bIHbv24MWmeRgasZH58o", name: "Will" },
  { voice_id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { voice_id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { voice_id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
];

const LS_KEY = "admin-voice-updates:voice-config";

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const SUGGESTIONS = [
  "Give me a quick platform update",
  "Who needs a warmup response?",
  "New signups this week",
  "Most active users past 24 hours",
  "Adoption themes this month",
  "Recent free-leads requests",
];

export default function AdminVoiceUpdates() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [greeted, setGreeted] = useState(false);
  const [voices, setVoices] = useState<VoiceOpt[]>(FALLBACK_VOICES);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL);
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load persisted config
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.voiceId) setVoiceId(p.voiceId);
        if (p.modelId) setModelId(p.modelId);
        if (p.settings) setSettings({ ...DEFAULT_SETTINGS, ...p.settings });
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ voiceId, modelId, settings }));
  }, [voiceId, modelId, settings]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email?.toLowerCase();
      if (!isPlatformAdminEmail(email)) {
        toast.error("Admin only");
        navigate("/admin");
        return;
      }
      setAuthorized(true);
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, [navigate]);

  const authHeader = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  };

  const loadVoices = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-voice-tts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ action: "list_voices", text: "_" }),
        },
      );
      const j = await res.json();
      if (Array.isArray(j?.voices)) {
        const mapped: VoiceOpt[] = j.voices.map((v: any) => ({
          voice_id: v.voice_id,
          name: v.name,
          labels: v.labels,
        }));
        // Ensure defaults present
        const merged = [...mapped];
        for (const f of FALLBACK_VOICES) {
          if (!merged.some((m) => m.voice_id === f.voice_id)) merged.push(f);
        }
        setVoices(merged);
      }
    } catch (e) {
      console.warn("Failed to load voices", e);
    }
  }, []);

  useEffect(() => {
    if (authorized) loadVoices();
  }, [authorized, loadVoices]);

  const speak = useCallback(async (text: string) => {
    setStatus("speaking");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-voice-tts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({ text, voiceId, modelId, settings }),
        },
      );
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setStatus("idle");
      audio.onerror = () => setStatus("idle");
      await audio.play();
    } catch (e) {
      console.error(e);
      toast.error("Voice playback failed");
      setStatus("idle");
    }
  }, [voiceId, modelId, settings]);

  const previewVoice = useCallback(async () => {
    await speak("Hi Andrew — this is a quick preview of the selected voice and settings.");
  }, [speak]);

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  const ask = useCallback(
    async (userText: string) => {
      const next: Msg[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setStatus("thinking");
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-voice-chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeader()) },
            body: JSON.stringify({ messages: next }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `chat ${res.status}`);
        const reply = data.text || "I didn't catch that.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        await speak(reply);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Chat failed");
        setStatus("idle");
      }
    },
    [messages, speak],
  );

  const greet = useCallback(async () => {
    if (greeted) return;
    setGreeted(true);
    const text = "Hi Andrew — what would you like an update on?";
    setMessages([{ role: "assistant", content: text }]);
    await speak(text);
  }, [greeted, speak]);

  const startRecording = useCallback(async () => {
    if (status !== "idle") return;
    try {
      audioRef.current?.pause();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "mp4" : type.includes("webm") ? "webm" : "wav";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 2048) {
          toast.error("Recording too short — hold the button and try again");
          setStatus("idle");
          return;
        }
        setStatus("transcribing");
        try {
          const fd = new FormData();
          fd.append("file", blob, `recording.${ext}`);
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-voice-stt`,
            { method: "POST", headers: await authHeader(), body: fd },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `STT ${res.status}`);
          const text = (data.text || "").trim();
          if (!text) {
            toast.error("Didn't catch that — try again");
            setStatus("idle");
            return;
          }
          await ask(text);
        } catch (e: any) {
          console.error(e);
          toast.error(e.message || "Transcription failed");
          setStatus("idle");
        }
      };
      rec.start();
      recorderRef.current = rec;
      setStatus("recording");
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  }, [status, ask]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    setStatus("idle");
  }, []);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const statusLabel: Record<Status, string> = {
    idle: "Ready",
    recording: "Listening…",
    transcribing: "Transcribing…",
    thinking: "Thinking…",
    speaking: "Speaking…",
  };
  const statusColor: Record<Status, string> = {
    idle: "bg-muted text-muted-foreground",
    recording: "bg-red-500/10 text-red-600 border-red-500/30",
    transcribing: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    thinking: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    speaking: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  };

  return (
    <>
      <PageSEO
        title="Admin Voice Updates | SaaSSuite"
        description="Voice AI briefing on the SaaSSuite platform."
        path="/admin/updates"
        noindex
      />
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Voice Updates</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Talk to the SaaSSuite platform. Ask about signups, warmup queue, adoption, active users.
              </p>
            </div>
            <Badge variant="outline" className={statusColor[status]}>
              {statusLabel[status]}
            </Badge>
          </div>

          <Card className="p-4">
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Voice" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {voices.map((v) => (
                        <SelectItem key={v.voice_id} value={v.voice_id}>
                          {v.name}
                          {v.labels?.accent ? ` · ${v.labels.accent}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={previewVoice} disabled={status !== "idle"}>
                    <Volume2 className="h-3 w-3 mr-1" /> Preview
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="ghost">
                      {settingsOpen ? "Hide" : "Advanced"}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SliderRow
                    label="Stability"
                    hint="Lower = more expressive · Higher = more consistent"
                    value={settings.stability}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setSettings((s) => ({ ...s, stability: v }))}
                  />
                  <SliderRow
                    label="Similarity"
                    hint="How closely to match the original voice"
                    value={settings.similarity_boost}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setSettings((s) => ({ ...s, similarity_boost: v }))}
                  />
                  <SliderRow
                    label="Style"
                    hint="Style exaggeration (multilingual v2)"
                    value={settings.style}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setSettings((s) => ({ ...s, style: v }))}
                  />
                  <SliderRow
                    label="Speed"
                    hint="0.7 slower · 1.2 faster"
                    value={settings.speed}
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    onChange={(v) => setSettings((s) => ({ ...s, speed: v }))}
                  />
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="speaker-boost"
                      checked={settings.use_speaker_boost}
                      onCheckedChange={(c) =>
                        setSettings((s) => ({ ...s, use_speaker_boost: c }))
                      }
                    />
                    <Label htmlFor="speaker-boost" className="text-sm">
                      Speaker boost
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={voiceId}
                      onChange={(e) => setVoiceId(e.target.value.trim())}
                      placeholder="Custom voice ID"
                      className="w-[240px] font-mono text-xs"
                    />
                    <Button size="sm" variant="ghost" onClick={resetSettings}>
                      Reset
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card className="p-8 flex flex-col items-center gap-6">
            {!greeted ? (
              <Button size="lg" onClick={greet} className="rounded-full h-16 px-8">
                <Volume2 className="mr-2 h-5 w-5" /> Start briefing
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={() => recorderRef.current?.state === "recording" && stopRecording()}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startRecording();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    stopRecording();
                  }}
                  disabled={status !== "idle" && status !== "speaking"}
                  className={`h-32 w-32 rounded-full flex items-center justify-center transition-all shadow-lg select-none ${
                    status === "recording"
                      ? "bg-red-500 scale-110 animate-pulse"
                      : status === "idle" || status === "speaking"
                        ? "bg-primary hover:scale-105"
                        : "bg-muted opacity-60"
                  }`}
                >
                  {status === "recording" ? (
                    <MicOff className="h-12 w-12 text-white" />
                  ) : (
                    <Mic className="h-12 w-12 text-primary-foreground" />
                  )}
                </button>
                <p className="text-sm text-muted-foreground">
                  {status === "recording"
                    ? "Release to send"
                    : status === "speaking"
                      ? "Speaking — tap and hold to interrupt"
                      : "Hold the mic and speak"}
                </p>
                {status === "speaking" && (
                  <Button variant="outline" size="sm" onClick={stopSpeaking}>
                    <Square className="h-3 w-3 mr-2" /> Stop
                  </Button>
                )}
              </div>
            )}
          </Card>

          {greeted && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={status !== "idle"}
                  onClick={() => ask(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg ${
                  m.role === "user"
                    ? "bg-muted ml-8"
                    : "bg-primary/5 border border-primary/10 mr-8"
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}