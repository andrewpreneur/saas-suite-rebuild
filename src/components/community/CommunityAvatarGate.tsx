import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MemberAvatar } from "./shared";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import type { CommunityProfile } from "@/hooks/useCommunityProfile";

/** Existing members who joined before photos were required must add one before continuing. */
export default function CommunityAvatarGate({
  profile,
  onDone,
}: {
  profile: CommunityProfile | null;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const upload = async (file: File) => {
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

  const save = async () => {
    if (!avatarUrl) return;
    setSaving(true);
    const { error } = await supabase
      .from("community_profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile?.id ?? "");
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    window.dispatchEvent(new Event("community-avatar-changed"));
    await onDone();
  };

  return (
    <div className="flex justify-center py-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="relative overflow-hidden">
          <BorderBeam duration={8} size={120} />
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-brand" />
              <CardTitle>Add your profile picture</CardTitle>
            </div>
            <CardDescription>
              A photo is required in the community — it only takes a second.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <MemberAvatar name={profile?.display_name} avatarUrl={avatarUrl} className="h-16 w-16" />
              <div className="space-y-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
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
                <p className="text-xs text-muted-foreground">JPG or PNG, up to 5MB.</p>
              </div>
            </div>
            <Button variant="accent" className="w-full" disabled={!avatarUrl || saving} onClick={save}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save and continue
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
