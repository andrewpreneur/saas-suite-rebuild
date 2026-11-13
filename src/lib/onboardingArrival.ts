/** Where new and unfinished accounts land instead of the setup wizard. */
export const LEARNING_HUB_PATH = "/app/learning";

const ARRIVAL_KEY = "ss_learning_hub_arrival";

export function onboardingArrivalHandled(): boolean {
  try {
    return sessionStorage.getItem(ARRIVAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingArrivalHandled(): void {
  try {
    sessionStorage.setItem(ARRIVAL_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * People who have not finished setup used to be forced into the wizard.
 * Send them to the Learning Hub once per visit, and open Copilot beside it.
 * A page they opened on purpose (the wizard URL, a kit step, a tab hand-off)
 * is left alone. Later clicks in the same visit are left alone too.
 */
export function onboardingArrivalAction(input: {
  needsLanding: boolean;
  pathname: string;
  search?: string;
  alreadyHandled?: boolean;
}): "stay" | "open" | "learning" {
  if (!input.needsLanding || input.alreadyHandled) return "stay";
  if (input.pathname === "/initial-questions" || input.pathname === "/v2-onboarding") return "stay";
  if (input.pathname !== "/app" && !input.pathname.startsWith("/app/")) return "stay";

  const params = new URLSearchParams(input.search || "");
  const view = params.get("view");
  if (params.get("tab") || view === "kit" || view === "affiliate") return "stay";

  if (input.pathname === LEARNING_HUB_PATH) return "open";
  return "learning";
}
