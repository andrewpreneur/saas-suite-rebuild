import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * Unread-ish count for the Support tab: open/in-progress tickets plus AI chats
 * still waiting on a human. Realtime so the badge never goes stale.
 */
export function useSupportUnread() {
  const { email } = useUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!email) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let ids: string[] = [];

    const load = async () => {
      const [{ data: tickets }, { data: versions }] = await Promise.all([
        supabase.rpc("get_agency_tickets", { user_email: email }),
        supabase.rpc("get_user_agency_versions", { user_email: email }),
      ]);

      const openTickets = ((tickets as any[]) || []).filter((t) =>
        ["open", "in_progress"].includes(String(t.status || "").toLowerCase()),
      ).length;

      const v = Array.isArray(versions) ? (versions[0] as any) : null;
      ids = Array.from(
        new Set(
          [v?.base_id, v?.basic_id, v?.advanced_id, v?.elite_id].filter(Boolean) as string[],
        ),
      );

      let pending = 0;
      if (ids.length > 0) {
        const { data: threads } = await supabase
          .from("chat_threads")
          .select("handover_resolved_at")
          .in("agency_id", ids)
          .not("handover_requested_at", "is", null)
          .is("handover_resolved_at", null);
        pending = threads?.length || 0;
      }

      if (!cancelled) setCount(openTickets + pending);
    };

    load();

    const channel = supabase
      .channel(`support-unread-${email}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_threads" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [email]);

  return count;
}
