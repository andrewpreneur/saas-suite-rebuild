import { supabase } from "@/integrations/supabase/client";

/** Step ids the kit tracker can mark done. Kept in step with the progress-table check. */
export const KIT_ONBOARDING_STEP_IDS = [
  "replay",
  "install-saas",
  "install-snapshot",
  "customize-video",
  "saas-training",
  "menu-training",
  "sales-page",
  "launch-ads",
  "launch-video",
] as const;

const ALLOWED = new Set<string>(KIT_ONBOARDING_STEP_IDS);

export function kitProgressStepIds(completed: readonly string[]): string[] {
  const ids: string[] = [];
  for (const raw of completed) {
    const id = raw.trim();
    if (!ALLOWED.has(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

/** Save marks on the account. A missing table must not block the tracker. */
export async function syncKitOnboardingProgress(
  userId: string | null,
  completed: readonly string[],
): Promise<void> {
  if (!userId) return;
  try {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.trim().toLowerCase() || null;
    await supabase.from("kit_onboarding_progress").upsert(
      {
        user_id: userId,
        email,
        completed: kitProgressStepIds(completed),
      },
      { onConflict: "user_id" },
    );
  } catch {
    // The table ships in a migration. The browser copy still holds this visit.
  }
}
