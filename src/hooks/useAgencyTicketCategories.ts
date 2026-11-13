import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultAgencyTicketCategories,
  normalizeAgencyTicketCategories,
  type AgencyTicketCategory,
} from "@/lib/ticketCategories";

export function agencyTicketCategoriesKey(agencyId: string | null | undefined) {
  return ["agency-ticket-categories", agencyId ?? null] as const;
}

export function ownerAgencyIdKey(ownerEmail: string | null | undefined) {
  return ["owner-agency-id", (ownerEmail || "").trim().toLowerCase()] as const;
}

/** First tier id for this account, with a trailing "NO" removed, matching get_agency_chat_config. */
export function useOwnerAgencyId(ownerEmail: string | null | undefined) {
  const email = (ownerEmail || "").trim();
  return useQuery({
    queryKey: ownerAgencyIdKey(email),
    enabled: Boolean(email),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_suite_users")
        .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw error;
      const ids = [
        data?.agency_id,
        data?.agency_id_basic,
        data?.agency_id_advanced,
        data?.agency_id_elite,
      ];
      const found = ids.find((id) => typeof id === "string" && id.trim());
      return found ? found.replace(/NO$/i, "") : null;
    },
  });
}

export function useAgencyTicketCategories(agencyId: string | null | undefined): {
  categories: AgencyTicketCategory[];
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: agencyTicketCategoriesKey(agencyId),
    enabled: Boolean(agencyId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agency_ticket_categories", {
        p_agency_id: agencyId!,
      });
      if (error) throw error;
      return normalizeAgencyTicketCategories(data);
    },
  });

  return {
    categories: query.data ?? defaultAgencyTicketCategories(),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
