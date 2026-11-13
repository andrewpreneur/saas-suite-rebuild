import { isKitEventStep, type KitEventStep } from "../../../supabase/functions/_shared/kit-events";
import { FUNNEL_ROUTES } from "./order";

/** Drop a trailing slash so /one-feature-kit/ matches the sales route. */
export function slashlessPathname(pathname: string): string {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/** Map a canonical funnel path to a FUNNEL_ROUTES key. Kept out of events.ts so the sales page can name the step without loading the Supabase client. */
export function kitStepForPath(pathname: string): KitEventStep | null {
  const path = slashlessPathname(pathname);
  for (const [step, route] of Object.entries(FUNNEL_ROUTES)) {
    if (route === path && isKitEventStep(step)) return step;
  }
  return null;
}
