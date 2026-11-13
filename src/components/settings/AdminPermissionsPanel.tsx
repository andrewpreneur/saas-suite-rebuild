import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { Banner } from "@/components/ui/banner";
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
      <p className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        No admins yet. Invite one on the Team tab, then set their permissions here.
      </p>
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
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-sm text-muted-foreground">You always have full access. Pick an admin to set theirs.</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="permissions-admin">Admin</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger id="permissions-admin" className="h-11 sm:h-10 sm:w-72"><SelectValue placeholder="Choose an admin" /></SelectTrigger>
          <SelectContent>
            {access.admins.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.admin_name || a.admin_email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {draft && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="permissions-name">Name</Label>
              <Input id="permissions-name" value={draft.admin_name || ""} onChange={(e) => setDraft({ ...draft, admin_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="permissions-phone">Phone</Label>
              <Input id="permissions-phone" type="tel" value={draft.admin_phone || ""} onChange={(e) => setDraft({ ...draft, admin_phone: e.target.value })} placeholder="+1 555 123 4567" />
            </div>
          </div>

          <section className="border-t border-border/70 pt-4" aria-labelledby="permissions-areas">
            <h3 id="permissions-areas" className="text-sm font-semibold text-foreground">What they can open</h3>
            <div className="mt-1 divide-y divide-border/70">
              {PERMISSION_AREAS.map((area) => (
                <div key={area.key} className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                  <Label htmlFor={`permission-${area.key}`} className="text-sm font-normal">{area.label}</Label>
                  <Select value={(draft.permissions?.[area.key] as AccessLevel) || "edit"} onValueChange={(v) => setLevel(area.key, v as AccessLevel)}>
                    <SelectTrigger id={`permission-${area.key}`} className="h-11 w-[150px] text-sm sm:h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No access</SelectItem>
                      <SelectItem value="view">View</SelectItem>
                      <SelectItem value="edit">View and edit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-border/70 pt-4" aria-labelledby="permissions-limits">
            <h3 id="permissions-limits" className="text-sm font-semibold text-foreground">Limit to their own work</h3>
            <div className="mt-1 divide-y divide-border/70">
              <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 py-2">
                <span className="text-sm">Only see chats assigned to them</span>
                <Switch checked={draft.restrict_assigned_chats} onCheckedChange={(v) => setDraft({ ...draft, restrict_assigned_chats: v })} />
              </label>
              <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 py-2">
                <span className="text-sm">Only see tickets assigned to them</span>
                <Switch checked={draft.restrict_assigned_tickets} onCheckedChange={(v) => setDraft({ ...draft, restrict_assigned_tickets: v })} />
              </label>
            </div>
          </section>

          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button type="submit" variant="accent" disabled={saving} className="h-11 w-full sm:h-10 sm:w-auto">
              {saving ? <><Loader2 className="animate-spin" aria-hidden="true" /> Saving permissions</> : "Save permissions"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
