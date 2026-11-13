import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

interface UserLimitBannerProps {
  onEditClients: () => void;
}

export function UserLimitBanner({ onEditClients }: UserLimitBannerProps) {
  const { email, plan } = useUser();
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!email || !plan || plan === "ADVANCED") return;

    const checkLimit = async () => {
      const { data: userData } = await supabase
        .from("saas_suite_users")
        .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
        .ilike("email", email)
        .maybeSingle();

      if (!userData) return;

      const agencyIds = [
        userData.agency_id,
        userData.agency_id_basic,
        userData.agency_id_advanced,
        userData.agency_id_elite,
      ].filter(Boolean);

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
            setIsAtLimit(true);
            return;
          }
        }
      }
    };

    checkLimit();
  }, [email, plan]);

  if (!isAtLimit || dismissed) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex items-center justify-between gap-4 z-50 relative">
      <div className="flex items-center gap-3 flex-1">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
        <p className="text-sm text-yellow-800">
          <strong>You've reached your maximum number of onboarding users on your current plan.</strong>{" "}
          Your existing clients still have full access and you can continue using all app features — you just can't accept new clients until you upgrade or remove existing ones.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onEditClients}
          className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
        >
          Edit Clients
        </Button>
        <Button
          size="sm"
          onClick={() => window.open("https://billing.stripe.com/p/login/bIY04697i9jzghy4gg", "_blank")}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          Show Me My Options
        </Button>
        <button onClick={() => setDismissed(true)} className="text-yellow-500 hover:text-yellow-700 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
