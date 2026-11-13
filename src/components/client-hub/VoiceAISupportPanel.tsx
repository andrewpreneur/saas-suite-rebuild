import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mic, Copy, Plus, Trash2, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

interface ApiKeyRow {
  id: string;
  agency_id: string;
  label: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface Props {
  agencyId: string | null;
}

const FUNCTION_BASE = `https://auth.saassuite.ai/functions/v1/agency-voice-api`;

// SHA-256 hex (must match the edge function)
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateApiKey() {
  // 32 bytes -> base64url, prefixed for easy identification
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `vai_${b64}`;
}

const VoiceAISupportPanel = ({ agencyId }: Props) => {
  const { email } = useUser();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newLabel, setNewLabel] = useState("Voice AI Support");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const endpointUrl = agencyId ? `${FUNCTION_BASE}` : `${FUNCTION_BASE}`;

  const endpoints: { label: string; method: string; url: string; note?: string }[] = [
    { label: "List Users", method: "GET", url: `${FUNCTION_BASE}/users` },
    { label: "Search Users", method: "GET", url: `${FUNCTION_BASE}/users/search?query={{contact.email}}`, note: "Pass name, email, or phone as query" },
    { label: "User Detail (Email)", method: "GET", url: `${FUNCTION_BASE}/users/by-email/{{contact.email}}` },
    { label: "User Detail (Name)", method: "GET", url: `${FUNCTION_BASE}/users/by-name/{{contact.name}}` },
    { label: "Training Doc", method: "GET", url: `${FUNCTION_BASE}/training-doc?tier=basic` },
    { label: "Agency Info", method: "GET", url: `${FUNCTION_BASE}/agency-info` },
  ];

  const fetchKeys = async () => {
    if (!agencyId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("agency_api_keys")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Failed to load API keys");
      return;
    }
    setKeys((data || []) as ApiKeyRow[]);
  };

  useEffect(() => {
    fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const handleGenerate = async () => {
    if (!agencyId) {
      toast.error("No agency ID configured for this plan");
      return;
    }
    if (!email) {
      toast.error("You must be signed in");
      return;
    }
    setGenerating(true);
    const key = generateApiKey();
    const hash = await sha256Hex(key);
    const prefix = key.slice(0, 12);
    const { error } = await (supabase as any).from("agency_api_keys").insert({
      agency_id: agencyId,
      owner_email: email.toLowerCase(),
      label: newLabel || "Voice AI Support",
      key_hash: hash,
      key_prefix: prefix,
    });
    setGenerating(false);
    if (error) {
      toast.error(error.message || "Failed to generate key");
      return;
    }
    setFreshKey(key);
    setNewLabel("Voice AI Support");
    fetchKeys();
    toast.success("API key generated. Copy it now — it won't be shown again.");
  };

  const handleRevoke = async (id: string) => {
    const { error } = await (supabase as any)
      .from("agency_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to revoke key");
      return;
    }
    toast.success("Key revoked");
    fetchKeys();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("agency_api_keys").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete key");
      return;
    }
    toast.success("Key deleted");
    fetchKeys();
  };

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-base">Voice AI Support</h3>
        <Badge variant="secondary" className="text-[10px]">API</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect an external Voice AI agent (e.g. GoHighLevel) to look up your users by name,
        email, or phone and pull their onboarding progress, watched videos, and support
        tickets — scoped to <span className="font-mono">{agencyId || "your agency"}</span> only.
      </p>

      {/* Endpoints list — full URLs */}
      <div className="space-y-2">
        <Label className="text-xs">Endpoints</Label>
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <div key={ep.label} className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">{ep.method}</Badge>
                <span className="text-xs font-medium">{ep.label}</span>
              </div>
              <div className="flex gap-2">
                <Input value={ep.url} readOnly className="font-mono text-[11px]" />
                <Button variant="outline" size="icon" aria-label="Copy" onClick={() => copy(ep.url, `${ep.label} URL copied`)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              {ep.note && (
                <p className="text-[10px] text-muted-foreground">{ep.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Newly generated key (one-time display) */}
      {freshKey && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Copy this key now — it won't be shown again.
          </div>
          <div className="flex gap-2">
            <Input value={freshKey} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" aria-label="Copy" onClick={() => copy(freshKey, "API key copied")}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setFreshKey(null)}>
            I've saved it
          </Button>
        </div>
      )}

      {/* Generate */}
      <div className="space-y-1.5">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Select <span className="font-mono font-semibold">"Bearer Token"</span> as your Authentication Method when configuring these endpoints in your Voice AI agent.
        </div>
        <Label className="text-xs">Generate a new API key</Label>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. GHL Voice Agent)"
            className="flex-1"
          />
          <Button onClick={handleGenerate} disabled={generating || !agencyId}>
            <Plus className="w-4 h-4 mr-1" />
            {generating ? "Generating..." : "Generate Key"}
          </Button>
        </div>
      </div>

      {/* Existing keys */}
      <div className="space-y-2">
        <Label className="text-xs">Your API keys</Label>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-3 rounded-md border p-2.5 text-sm"
              >
                <KeyRound className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{k.label}</span>
                    {k.revoked_at ? (
                      <Badge variant="destructive" className="text-[10px]">Revoked</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500" /> Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {k.key_prefix}…{" "}
                    <span className="font-sans">
                      · created {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at
                        ? ` · last used ${new Date(k.last_used_at).toLocaleString()}`
                        : " · never used"}
                    </span>
                  </div>
                </div>
                {!k.revoked_at && (
                  <Button size="sm" variant="outline" onClick={() => handleRevoke(k.id)}>
                    Revoke
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(k.id)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAISupportPanel;