import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText, withDeadline } from "@/lib/loadSettle";

export type CommunityProfile = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  tier: "free" | "paid";
  role: "member" | "team" | "admin";
  handle?: string | null;
  is_verified?: boolean | null;
  post_count: number;
  joined_at?: string | null;
  active_subaccounts?: string | null;
  highlevel_experience?: string | null;
  show_account_count?: boolean | null;
};

/**
 * Reuses the existing Supabase session — no separate community login.
 * Creates/refreshes the caller's community profile on first visit and
 * derives their tier from their SaaSSuite plan (BASIC/ADVANCED = paid).
 */
export function useCommunityProfile() {
  const { user, session } = useUser();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    const stop = armLoadDeadline(() => {
      setIsLoading(false);
      setError(LOAD_TIMEOUT_MESSAGE);
    });
    try {
      const { data, error: rpcError } = await withDeadline(
        supabase.rpc("community_ensure_profile", {
          _display_name: null,
          _avatar_url: null,
        }),
      );
      if (rpcError) {
        console.error("Error loading community profile:", rpcError);
        setError(rpcError.message || "Couldn't load the community.");
      } else if (data) {
        const row = Array.isArray(data) ? data[0] : data;
        const base = row as unknown as CommunityProfile;
        const { data: extra } = await withDeadline(
          supabase
            .from("community_profiles")
            .select(
              "joined_at, active_subaccounts, highlevel_experience, show_account_count, bio, display_name, avatar_url, handle, is_verified",
            )
            .eq("id", session.user.id)
            .maybeSingle(),
        );
        setProfile({ ...base, ...(extra as object | null) } as CommunityProfile);
        setError(null);
      } else {
        setError("Couldn't load the community.");
      }
    } catch (loadError) {
      setError(loadErrorText(loadError, "Couldn't load the community."));
    } finally {
      stop();
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    profile,
    isLoading,
    userId: user?.id ?? null,
    tier: profile?.tier ?? "free",
    isPaid: profile?.tier === "paid",
    isStaff: profile?.role === "team" || profile?.role === "admin",
    hasJoined: Boolean(profile?.joined_at),
    error,
    refetch: load,
  };
}