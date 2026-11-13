import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useViewerIdentity } from "@/hooks/useViewerIdentity";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, UserPlus } from "lucide-react";
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
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader className="items-center text-center sm:text-center">
            <span className="px-icon-chip mb-2">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle className="text-center text-h4 text-balance">You're logged into {label}</DialogTitle>
            <DialogDescription className="text-center text-pretty">
              {viewer.showsAccountAdmin
                ? `You're signed in as ${viewer.displayName} (${viewer.displayEmail}). You're an admin on this account.`
                : isOwn
                  ? "This is your own account."
                  : `You're an admin on this account (${email}).`}{" "}
              You can switch accounts any time from the top bar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="accent" className="h-11 w-full" onClick={dismiss}>Continue</Button>
            <Button variant="outline" className="h-11 w-full" onClick={() => { dismiss(); navigate("/account-selector"); }}>
              Switch account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!open && requests.length > 0} onOpenChange={(o) => !o && setRequests([])}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-h4">Requests to join your agency</DialogTitle>
            <DialogDescription>Approving adds them as an admin on your account.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 items-center gap-2 text-small font-medium">
                  <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{r.requester_email}</span>
                </span>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="accent" onClick={() => respond(r.id, true)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => respond(r.id, false)}>Decline</Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
};
