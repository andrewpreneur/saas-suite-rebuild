import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { useTeamAccess } from "@/hooks/useTeamAccess";

type OwnerPrefs = { notify_all_tickets: boolean; notify_all_chats: boolean; notify_assigned_tickets: boolean };

/** Owner: all tickets / all chats / assigned tickets / nothing. Admin: assigned tickets / assigned chats. */
export default function SupportNotificationsPanel() {
  const access = useTeamAccess();
  const [owner, setOwner] = useState<OwnerPrefs | null>(null);

  useEffect(() => {
    if (!access.isOwner || !access.ownerEmail) return;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("notify_all_tickets, notify_all_chats, notify_assigned_tickets")
        .ilike("email", access.ownerEmail)
        .maybeSingle();
      setOwner({
        notify_all_tickets: !!(data as any)?.notify_all_tickets,
        notify_all_chats: !!(data as any)?.notify_all_chats,
        notify_assigned_tickets: !!(data as any)?.notify_assigned_tickets,
      });
    })();
  }, [access.isOwner, access.ownerEmail]);

  const saveOwner = async (next: OwnerPrefs) => {
    const prev = owner;
    setOwner(next);
    const { error } = await supabase.from("saas_suite_users").update(next as any).ilike("email", access.ownerEmail);
    if (error) {
      setOwner(prev);
      toast.error("Could not save");
    } else toast.success("Notifications updated");
  };

  const saveAdmin = async (patch: Record<string, boolean>) => {
    if (!access.myRow) return;
    const { error } = await (supabase as any).from("account_admins").update(patch).eq("id", access.myRow.id);
    if (error) toast.error("Could not save");
    else {
      toast.success("Notifications updated");
      void access.reload();
    }
  };

  if (!access.loaded) return <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const Row = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between gap-3 p-3 cursor-pointer">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" /> Choose which support updates are sent to you.
      </p>
      {access.isOwner ? (
        owner ? (
          <div className="border rounded-lg divide-y">
            <Row label="Notify me of all tickets" checked={owner.notify_all_tickets} onChange={(v) => void saveOwner({ ...owner, notify_all_tickets: v })} />
            <Row label="Notify me of all chats" checked={owner.notify_all_chats} onChange={(v) => void saveOwner({ ...owner, notify_all_chats: v })} />
            <Row label="Notify me of tickets assigned to me" checked={owner.notify_assigned_tickets} onChange={(v) => void saveOwner({ ...owner, notify_assigned_tickets: v })} />
            <Row
              label="Notify me of nothing"
              checked={!owner.notify_all_tickets && !owner.notify_all_chats && !owner.notify_assigned_tickets}
              onChange={(v) => v && void saveOwner({ notify_all_tickets: false, notify_all_chats: false, notify_assigned_tickets: false })}
            />
          </div>
        ) : null
      ) : access.myRow ? (
        <div className="border rounded-lg divide-y">
          <Row label="Notify me of tickets assigned to me" checked={access.myRow.notify_assigned_tickets} onChange={(v) => void saveAdmin({ notify_assigned_tickets: v })} />
          <Row label="Notify me of chats assigned to me" checked={access.myRow.notify_assigned_chats} onChange={(v) => void saveAdmin({ notify_assigned_chats: v })} />
        </div>
      ) : null}
    </div>
  );
}
