import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmoothInput, SmoothTextarea } from "@/components/ui/smooth-input";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MemberAvatar } from "./shared";
import { Building2, Check, Clock, Loader2, Sparkles, Upload, Users, X } from "lucide-react";
import type { CommunityProfile } from "@/hooks/useCommunityProfile";

type Prefill = {
  display_name: string | null;
  active_subaccounts: string | null;
  highlevel_experience: string | null;
  most_used_feature: string | null;
};

export default function CommunityJoin({
  profile,
  onJoined,
}: {
  profile: CommunityProfile | null;
  onJoined: () => void;
}) {
  const { toast } = useToast();
  const [loadingPrefill, setLoadingPrefill] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [showCount, setShowCount] = useState(profile?.show_account_count ?? true);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [handle, setHandle] = useState(profile?.handle || "");
  const [handleState, setHandleState] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const slugify = (raw: string) =>
    raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]+/g, "")
      .slice(0, 24);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("community_onboarding_prefill");
      if (!active) return;
      const row = (Array.isArray(data) ? data[0] : data) as Prefill | null;
      setPrefill(row ?? null);
      if (row?.display_name && !profile?.display_name) setName(row.display_name);
      const seedName = profile?.display_name || row?.display_name || "";
      if (!profile?.handle && seedName) {
        setHandle(slugify(seedName.split(" ")[0] || seedName));
      }
      setLoadingPrefill(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accounts = prefill?.active_subaccounts || profile?.active_subaccounts || null;
  const experience = prefill?.highlevel_experience || profile?.highlevel_experience || null;
  const needsName = !name.trim();

  // Debounced uniqueness check for the @handle.
  useEffect(() => {
    const clean = slugify(handle);
    if (clean.length < 3) {
      setHandleState("idle");
      return;
    }
    setHandleState("checking");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("community_handle_available", { _handle: clean });
      if (error) {
        setHandleState("idle");
        return;
      }
      setHandleState(data ? "ok" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [handle]);

  const uploadAvatar = async (file: File) => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please pick an image under 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("community-avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: signed } = await supabase.storage
      .from("community-avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setUploading(false);
    if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
  };

  const join = async () => {
    if (needsName) {
      toast({ title: "Add your name", description: "We need a display name for the community." });
      return;
    }
    if (!avatarUrl) {
      toast({
        title: "Add a profile picture",
        description: "A photo is required to join the community.",
        variant: "destructive",
      });
      return;
    }
    const cleanHandle = slugify(handle);
    if (cleanHandle.length < 3 || handleState === "taken") {
      toast({
        title: "Pick a valid @handle",
        description: "At least 3 letters/numbers and not already taken.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("community_join", {
      _display_name: name.trim(),
      _active_subaccounts: accounts,
      _highlevel_experience: experience,
      _show_account_count: showCount,
      _bio: bio.trim() || null,
      _handle: cleanHandle,
      _avatar_url: avatarUrl,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't join", description: error.message, variant: "destructive" });
      return;
    }
    window.dispatchEvent(new Event("community-avatar-changed"));
    onJoined();
  };

  return (
    <div className="flex justify-center py-2">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-xl"
      >
        <Card className="relative overflow-hidden">
          <BorderBeam duration={8} size={120} />
          <BorderBeam duration={8} size={120} delay={4} reverse />
          <CardHeader className="px-4 pt-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <CardTitle className="text-base">Join the SaaSSuite Community</CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={
                    "h-1 flex-1 rounded-full transition-colors " +
                    (i <= step ? "bg-brand" : "bg-muted")
                  }
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Step {step + 1} of 3</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {step === 0 && (
            <div className="flex items-center gap-4">
              <MemberAvatar name={name} avatarUrl={avatarUrl} className="h-16 w-16" />
              <div className="space-y-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
                <p className="text-xs text-muted-foreground">Required — JPG or PNG, up to 5MB.</p>
              </div>
            </div>
            )}

            {step === 1 && (
            <>
            <div className="space-y-2">
              <Label htmlFor="community-name">Display name</Label>
              <SmoothInput
                id="community-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should the community know you?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="community-handle">Your @handle</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <SmoothInput
                    id="community-handle"
                    value={handle}
                    onChange={(e) => setHandle(slugify(e.target.value))}
                    placeholder="yourname"
                    className="pl-7"
                  />
                </div>
                {handleState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {handleState === "ok" && <Check className="h-4 w-4 text-brand" />}
                {handleState === "taken" && <X className="h-4 w-4 text-destructive" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {handleState === "taken"
                  ? "That handle is already taken."
                  : "Your unique identifier in the community — letters, numbers and underscores."}
              </p>
            </div>
            </>
            )}

            {step === 2 && (
            <>
            <div className="space-y-2">
              <Label htmlFor="community-bio">Short bio (optional)</Label>
              <SmoothTextarea
                id="community-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="What kind of agency do you run?"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pulled from your onboarding
              </p>
              {loadingPrefill ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your details…
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {accounts ? `${accounts} sub-accounts` : "Sub-accounts not set"}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {experience ? `HighLevel: ${experience}` : "HighLevel experience not set"}
                  </Badge>
                  {prefill?.most_used_feature ? (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      {prefill.most_used_feature}
                    </Badge>
                  ) : null}
                </div>
              )}

              <div className="flex items-start justify-between gap-4 pt-1">
                <div className="space-y-0.5">
                  <Label htmlFor="show-count" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Show my account count
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Displays a badge next to your name so others can see your scale.
                  </p>
                </div>
                <Switch id="show-count" checked={showCount} onCheckedChange={setShowCount} />
              </div>
            </div>
            </>
            )}

            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (step === 0 && !avatarUrl) {
                      toast({
                        title: "Add a profile picture",
                        description: "A photo is required to join the community.",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (step === 1) {
                      if (needsName) {
                        toast({ title: "Add your name", description: "We need a display name for the community." });
                        return;
                      }
                      if (slugify(handle).length < 3 || handleState === "taken") {
                        toast({
                          title: "Pick a valid @handle",
                          description: "At least 3 letters/numbers and not already taken.",
                          variant: "destructive",
                        });
                        return;
                      }
                    }
                    setStep((s) => s + 1);
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button onClick={join} disabled={saving} className="flex-1">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining…
                    </>
                  ) : (
                    "Join the community"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}