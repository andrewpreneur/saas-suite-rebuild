import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
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
      <Banner tone="info" title="Owner only.">
        Only the account owner can change admin permissions.
      </Banner>
    );
  }

  if (access.admins.length === 0) {
    return (
      <EmptyState
        className="rounded-lg border border-dashed border-border py-8"
        icon={<EmptyStateIllustration className="size-12 rounded-lg border-border bg-muted text-muted-foreground"><ShieldCheck className="size-5" aria-hidden="true" /></EmptyStateIllustration>}
        title="No admins to set up yet"
        description="Add an admin on the Team tab first, then set their permissions here."
      />
    );
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
        <ShieldCheck className="size-4 shrink-0 text-brand" aria-hidden="true" />
        You (the owner) always have full access. Admins can't change their own permissions.
      </div>

      <div className="flex flex-col gap-1.5">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={draft.admin_name || ""} onChange={(e) => setDraft({ ...draft, admin_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phone</Label>
              <Input value={draft.admin_phone || ""} onChange={(e) => setDraft({ ...draft, admin_phone: e.target.value })} placeholder="+1…" />
            </div>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {PERMISSION_AREAS.map((area) => (
              <div key={area.key} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
                <span className="text-sm">{area.label}</span>
                <Select value={(draft.permissions?.[area.key] as AccessLevel) || "edit"} onValueChange={(v) => setLevel(area.key, v as AccessLevel)}>
                  <SelectTrigger className="h-10 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="edit">View & Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="text-sm">Only see chats assigned to them</span>
              <Switch checked={draft.restrict_assigned_chats} onCheckedChange={(v) => setDraft({ ...draft, restrict_assigned_chats: v })} />
            </label>
            <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 py-2">
              <span className="text-sm">Only see tickets assigned to them</span>
              <Switch checked={draft.restrict_assigned_tickets} onCheckedChange={(v) => setDraft({ ...draft, restrict_assigned_tickets: v })} />
            </label>
          </div>

          <Button variant="accent" onClick={() => void save()} disabled={saving} className="h-11 w-full sm:ml-auto sm:flex sm:h-10 sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save permissions"}
          </Button>
        </>
      )}
    </div>
  );
}
