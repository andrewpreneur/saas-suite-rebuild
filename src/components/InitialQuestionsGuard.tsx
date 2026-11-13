import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCoPilot } from "@/contexts/CoPilotContext";
import { supabase } from "@/integrations/supabase/client";
import { clearSkipOnboarding, readNextPath, shouldSkipOnboarding } from "@/utils/deepLink";
import { isKitDeepLink, mustSendToOnboarding } from "@/lib/kitLoginFlow";
import { navigateWithParams } from "@/utils/preserveParams";
import {
  LEARNING_HUB_PATH,
  markOnboardingArrivalHandled,
  onboardingArrivalAction,
  onboardingArrivalHandled,
} from "@/lib/onboardingArrival";

interface InitialQuestionsGuardProps {
  children: React.ReactNode;
}

const SKIP_KEY = "onboarding_skipped_session";
export const ADMIN_TOUR_KEY = "admin_walkthrough_pending";

const InitialQuestionsGuard = ({ children }: InitialQuestionsGuardProps) => {
  const { email, actualEmail, isLoading, initialQuestionsCompleted } = useUser();
  const { open } = useCoPilot();
  const navigate = useNavigate();
  const location = useLocation();
  // null = still checking whether this person is an invited admin
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const needsCheck = !isLoading && !!email && initialQuestionsCompleted === false;

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    (async () => {
      // Check the signed-in person, not the account on screen: a team admin
      // viewing an owner's unfinished account must never be sent to setup.
      const normalized = (actualEmail || email)!.trim().toLowerCase();
      const { data } = await supabase
        .from("account_admins")
        .select("id")
        .ilike("admin_email", normalized)
        .eq("status", "accepted")
        .limit(1);
      if (cancelled) return;
      const admin = !!data && data.length > 0;
      setIsAdmin(admin);
      if (admin) {
        // Admins never do agency setup — drop them on the dashboard with the tour.
        try {
          sessionStorage.setItem(SKIP_KEY, "1");
          localStorage.setItem(ADMIN_TOUR_KEY, "1");
        } catch { /* private mode */ }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsCheck, email, actualEmail]);

  const skippedThisSession = (() => {
    try {
      return sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      return false;
    }
  })();

  const onVoluntarySetup =
    location.pathname === "/initial-questions" || location.pathname === "/v2-onboarding";
  const pendingNext = readNextPath();
  const kitLanding = isKitDeepLink(`${location.pathname}${location.search}`) || isKitDeepLink(pendingNext);
  const sendToWizard = mustSendToOnboarding({
    needsCheck,
    isAdmin: false,
    skippedThisSession,
    skipDeepLink: shouldSkipOnboarding(),
    onOnboardingPage: onVoluntarySetup,
    pathname: location.pathname,
    search: location.search,
    pendingNext,
  });
  const arrival = kitLanding
    ? "stay"
    : onboardingArrivalAction({
        needsLanding: isAdmin === false && sendToWizard,
        pathname: location.pathname,
        search: location.search,
        alreadyHandled: onboardingArrivalHandled(),
      });

  useEffect(() => {
    if (isKitDeepLink(`${location.pathname}${location.search}`)) clearSkipOnboarding();
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (arrival === "stay") return;
    markOnboardingArrivalHandled();
    open({ mode: "dock" });
    if (arrival === "learning") {
      navigate(navigateWithParams(LEARNING_HUB_PATH), { replace: true });
    }
  }, [arrival, navigate, open]);

  // Hold the app only while we check whether this person is an invited admin.
  // A kit link stays on the kit dashboard. Once we know, everyone else stays in
  // the app — the wizard is no longer a gate.
  if (!kitLanding && needsCheck && isAdmin === null && !onVoluntarySetup && !skippedThisSession && !shouldSkipOnboarding()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Setting up your experience...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default InitialQuestionsGuard;
