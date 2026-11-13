import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PERMISSION_AREAS, useTeamAccess, type AccessLevel, type AdminRow } from "@/hooks/useTeamAccess";

/** Owner-only editor for each added admin's access. The owner always has full access. */
export default function AdminPermissionsPanel() {
  const access = useTeamAccess();
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<AdminRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedId && access.admins[0]) setSelectedId(access.admins[0].id);
  }, [access.admins, selectedId]);

  useEffect(() => {
    const row = access.admins.find((a) => a.id === selectedId) || null;
    setDraft(row ? { ...row, permissions: { ...(row.permissions || {}) } } : null);
  }, [selectedId, access.admins]);

  if (!access.loaded) {
    return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!access.isOwner) {
    return (
      <div className="p-4 border rounded-lg text-sm text-muted-foreground flex items-start gap-2">
        <Lock className="w-4 h-4 mt-0.5" />
        Only the account owner can change admin permissions.
      </div>
    );
  }

  if (access.admins.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground bg-muted rounded-lg">Add an admin first, then set their permissions here.</div>;
  }

  const setLevel = (area: string, level: AccessLevel) =>
    setDraft((d) => (d ? { ...d, permissions: { ...d.permissions, [area]: level } } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("account_admins")
      .update({
        admin_name: draft.admin_name,
        admin_phone: draft.admin_phone?.trim() || null,
        permissions: draft.permissions,
        restrict_assigned_chats: draft.restrict_assigned_chats,
        restrict_assigned_tickets: draft.restrict_assigned_tickets,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) return toast.error(error.message || "Could not save permissions");
    toast.success("Permissions saved");
    void access.reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-primary" />
        You (the owner) always have full access. Admins can't change their own permissions.
      </div>

      <div>
        <Label>Admin</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger><SelectValue placeholder="Choose an admin" /></SelectTrigger>
          <SelectContent>
            {access.admins.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.admin_name || a.admin_email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={draft.admin_name || ""} onChange={(e) => setDraft({ ...draft, admin_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={draft.admin_phone || ""} onChange={(e) => setDraft({ ...draft, admin_phone: e.target.value })} placeholder="+1…" />
            </div>
          </div>

          <div className="border rounded-lg divide-y">
            {PERMISSION_AREAS.map((area) => (
              <div key={area.key} className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm">{area.label}</span>
                <Select value={(draft.permissions?.[area.key] as AccessLevel) || "edit"} onValueChange={(v) => setLevel(area.key, v as AccessLevel)}>
                  <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="edit">View & Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="border rounded-lg divide-y">
            <label className="flex items-center justify-between gap-3 p-3 cursor-pointer">
              <span className="text-sm">Only see chats assigned to them</span>
              <Switch checked={draft.restrict_assigned_chats} onCheckedChange={(v) => setDraft({ ...draft, restrict_assigned_chats: v })} />
            </label>
            <label className="flex items-center justify-between gap-3 p-3 cursor-pointer">
              <span className="text-sm">Only see tickets assigned to them</span>
              <Switch checked={draft.restrict_assigned_tickets} onCheckedChange={(v) => setDraft({ ...draft, restrict_assigned_tickets: v })} />
            </label>
          </div>

          <Button onClick={() => void save()} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save permissions"}
          </Button>
        </>
      )}
    </div>
  );
}
