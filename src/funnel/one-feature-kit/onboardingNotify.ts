import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

/** The password redirect does not wait longer than this. */
export const KIT_ONBOARDING_NOTIFY_WAIT_MS = 1500;

/**
 * Wait for the notify call, but never longer than waitMs, and never surface a failure.
 * The thank-you page still opens the password screen.
 */
export async function settleKitOnboardingNotify(
  work: Promise<unknown>,
  waitMs = KIT_ONBOARDING_NOTIFY_WAIT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work.then(() => undefined, () => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, waitMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Tell the team about a saved onboarding row. Uses the publishable key, not the
 * signed-in SaaSSuite session, so a different login on this browser cannot block
 * the buyer or impersonate them. The row id is unguessable. Failures are swallowed.
 */
export function requestKitOnboardingNotify(
  rowId: string,
  email: string,
  waitMs = KIT_ONBOARDING_NOTIFY_WAIT_MS,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), waitMs);
  return fetch(`${SUPABASE_URL}/functions/v1/kit-onboarding-notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ id: rowId, email }),
    signal: controller.signal,
  }).then(() => undefined, () => undefined).finally(() => clearTimeout(timer));
}
