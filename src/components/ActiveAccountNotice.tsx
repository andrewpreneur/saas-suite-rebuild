import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useViewerIdentity } from "@/hooks/useViewerIdentity";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

interface JoinRequest { id: string; requester_email: string }

/**
 * 1) Once per session, tells users with more than one account which account they're in (with a switch button).
 * 2) Shows agency owners pending "request to join" approvals.
 */
export const ActiveAccountNotice = () => {
  const { actualEmail, email } = useUser();
  const viewer = useViewerIdentity(null);
  const navigate = useNavigate();
  const [label, setLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!actualEmail || !email) return;
    if (sessionStorage.getItem("isImpersonating") === "true") return;
    (async () => {
      const { data: admins } = await supabase
        .from("account_admins")
        .select("owner_email")
        .ilike("admin_email", actualEmail)
        .eq("status", "accepted");
      if (!admins?.length) return;
      if (sessionStorage.getItem("ss_active_account_notice") === email.toLowerCase()) return;
      const { data: row } = await supabase
        .from("saas_suite_users")
        .select("agency_name")
        .ilike("email", email)
        .maybeSingle();
      setLabel(row?.agency_name?.trim() || "this agency");
      setOpen(true);
    })();
  }, [actualEmail, email]);

  useEffect(() => {
    if (!actualEmail) return;
    supabase
      .from("agency_join_requests" as never)
      .select("id, requester_email")
      .ilike("owner_email", actualEmail)
      .eq("status", "pending")
      .then(({ data }) => setRequests((data as JoinRequest[] | null) ?? []));
  }, [actualEmail]);

  const dismiss = () => {
    if (email) sessionStorage.setItem("ss_active_account_notice", email.toLowerCase());
    setOpen(false);
  };

  const respond = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc("respond_join_request" as never, { p_request_id: id, p_approve: approve } as never);
    if (error) return toast.error("Couldn't update the request");
    toast.success(approve ? "Added as an admin" : "Request declined");
    setRequests((r) => r.filter((x) => x.id !== id));
  };

  const isOwn = email?.toLowerCase() === actualEmail?.toLowerCase();

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">You're logged into {label}</DialogTitle>
            <DialogDescription className="text-center">
              {viewer.showsAccountAdmin
                ? `You're signed in as ${viewer.displayName} (${viewer.displayEmail}). You're an admin on this account.`
                : isOwn
                  ? "This is your own account."
                  : `You're an admin on this account (${email}).`}{" "}
              You can switch accounts any time from the top bar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button className="w-full" onClick={dismiss}>Continue</Button>
            <Button variant="outline" className="w-full" onClick={() => { dismiss(); navigate("/account-selector"); }}>
              Switch account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!open && requests.length > 0} onOpenChange={(o) => !o && setRequests([])}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Requests to join your agency</DialogTitle>
            <DialogDescription>Approving adds them as an admin on your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="truncate text-sm">{r.requester_email}</span>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" onClick={() => respond(r.id, true)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => respond(r.id, false)}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
