import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChromeStrip } from "@/components/premium/entry/chrome";
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
    <ChromeStrip
      tone="warning"
      title="You've reached the onboarding user limit on your plan."
      onDismiss={() => setDismissed(true)}
      dismissLabel="Dismiss user limit notice"
      actions={
        <>
          <Button size="sm" variant="outline" onClick={onEditClients}>
            Edit clients
          </Button>
          <Button
            size="sm"
            onClick={() => window.open("https://billing.stripe.com/p/login/bIY04697i9jzghy4gg", "_blank")}
          >
            See my options
          </Button>
        </>
      }
    >
      Your current clients keep full access and every feature still works. To accept new clients, upgrade or
      remove a few existing ones.
    </ChromeStrip>
  );
}
