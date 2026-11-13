import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

interface UserLimitPopupProps {
  onEditClients: () => void;
}

export function UserLimitPopup({ onEditClients }: UserLimitPopupProps) {
  const { email, plan } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!email || !plan || plan === "ADVANCED") return;

    const sessionKey = `user_limit_popup_shown_${email}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const checkLimit = async () => {
      const { data: userData } = await supabase
        .from("saas_suite_users")
        .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite")
        .ilike("email", email)
        .maybeSingle();

      if (!userData) return;

      const agencyIds = Array.from(new Set([
        userData.agency_id,
        userData.agency_id_basic,
        userData.agency_id_advanced,
        userData.agency_id_elite,
        userData.original_agency_id,
        userData.original_agency_id_basic,
        userData.original_agency_id_advanced,
        userData.original_agency_id_elite,
      ].filter(Boolean) as string[]));

      for (const agencyId of agencyIds) {
        const { data } = await supabase.rpc("get_agency_user_limit", {
          p_agency_id: agencyId!,
        });
        if (data && data[0]) {
          const { current_users, max_users } = data[0];
          const shouldShowLimitWarning =
            max_users !== null &&
            (plan === "STARTER" ? current_users > max_users : current_users >= max_users);

          if (shouldShowLimitWarning) {
            setOpen(true);
            sessionStorage.setItem(sessionKey, "true");
            return;
          }
        }
      }
    };

    checkLimit();
  }, [email, plan]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-yellow-600" />
            </div>
            <DialogTitle>User Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3">
            <p>
              You've reached the maximum number of onboarding users on your <strong>{plan === "STARTER" ? "Starter" : "Basic"}</strong> plan.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
              <strong>Don't worry!</strong> You can still:
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Make edits to your onboarding setup</li>
                <li>Use all app features as usual</li>
                <li>Your current clients still have full access</li>
              </ul>
            </div>
            <p className="text-sm">
              To onboard new customers, you'll need to upgrade your plan or remove existing clients.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              onEditClients();
            }}
          >
            Edit Clients
          </Button>
          <Button
            onClick={() => window.open("https://billing.stripe.com/p/login/bIY04697i9jzghy4gg", "_blank")}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Show Me My Options
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
