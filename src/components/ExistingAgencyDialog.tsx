import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

interface Match { owner_email: string; agency_name: string; domain: string }

/** Shown before onboarding when a teammate's agency already exists on the same email domain. */
export const ExistingAgencyDialog = () => {
  const { actualEmail } = useUser();
  const [match, setMatch] = useState<Match | null>(null);
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!actualEmail) return;
    const key = `ss_domain_prompt_done:${actualEmail.toLowerCase()}`;
    if (localStorage.getItem(key)) return;
    (async () => {
      const { data } = await supabase.rpc("find_agency_by_domain" as never);
      const row = (data as Match[] | null)?.[0];
      if (!row) return;
      const { data: existing } = await supabase
        .from("agency_join_requests" as never)
        .select("status")
        .ilike("requester_email", actualEmail)
        .ilike("owner_email", row.owner_email)
        .maybeSingle();
      if ((existing as { status?: string } | null)?.status === "pending") setRequested(true);
      setMatch(row);
      setOpen(true);
    })();
  }, [actualEmail]);

  const finish = () => {
    if (actualEmail) localStorage.setItem(`ss_domain_prompt_done:${actualEmail.toLowerCase()}`, "1");
    setOpen(false);
  };

  const requestJoin = async () => {
    if (!match) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_join_agency" as never, { p_owner_email: match.owner_email } as never);
    setBusy(false);
    if (error) return toast.error("Couldn't send the request. Please try again.");
    setRequested(true);
    toast.success("Request sent to the agency owner");
  };

  const checkApproved = async () => {
    if (!match || !actualEmail) return;
    const { data } = await supabase
      .from("account_admins")
      .select("owner_email")
      .ilike("admin_email", actualEmail)
      .ilike("owner_email", match.owner_email)
      .maybeSingle();
    if (data) {
      finish();
      sessionStorage.setItem("selectedAccountEmail", match.owner_email);
      window.location.href = "/app";
    } else {
      toast("Still waiting for the owner to approve.");
    }
  };

  if (!match) return null;
  const name = match.agency_name || match.domain;

  return (
    <Dialog open={open} onOpenChange={() => { /* require a choice */ }}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle">
            <Building2 className="h-6 w-6 text-brand" />
          </div>
          <DialogTitle className="text-center">Existing agency detected</DialogTitle>
          <DialogDescription className="text-center">
            We detected an existing agency on this domain of <strong>{match.domain}</strong>
            {match.agency_name ? <> — <strong>{name}</strong></> : null}.
          </DialogDescription>
        </DialogHeader>
        {requested ? (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Your request has been sent. Once the owner approves it, you'll get access to {name}.
            </p>
            <Button className="w-full" onClick={checkApproved}>I've been approved — take me in</Button>
            <Button variant="outline" className="w-full" onClick={finish}>Start your own account instead</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button className="w-full" disabled={busy} onClick={requestJoin}>Request to join that agency</Button>
            <Button variant="outline" className="w-full" onClick={finish}>Start your own account</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
