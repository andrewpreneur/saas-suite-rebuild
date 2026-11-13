import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAIL } from "@/lib/platformAdmins";

export { PLATFORM_ADMIN_EMAIL };

export type AccessLevel = "none" | "view" | "edit";

/** Areas an owner can grant per admin. Tool ids map onto these. */
export const PERMISSION_AREAS: { key: string; label: string }[] = [
  { key: "client_hub", label: "Client Hub" },
  { key: "support_chats", label: "Support Chats" },
  { key: "support_tickets", label: "Support Tickets" },
  { key: "branding", label: "Branding" },
  { key: "onboarding", label: "Onboarding & Walkthrough" },
  { key: "marketing", label: "Marketing, Email Warmup & Leads" },
  { key: "workflows", label: "Workflows" },
  { key: "analytics", label: "Analytics & SaaS Health" },
  { key: "clients", label: "Clients" },
  { key: "knowledge_base", label: "Knowledge Base" },
  { key: "onboarding_calls", label: "Onboarding Calls" },
  { key: "agency_support", label: "Agency Support" },
  { key: "settings", label: "Settings" },
];

export const TOOL_AREA: Record<string, string> = {
  "client-hub": "client_hub",
  branding: "branding",
  streamline: "onboarding",
  onboarding: "onboarding",
  "simple-onboarding": "onboarding",
  walkthrough: "onboarding",
  marketing: "marketing",
  "email-warmup": "marketing",
  "free-leads": "marketing",
  workflows: "workflows",
  "activity-dashboard": "analytics",
  "saas-health": "analytics",
  clients: "clients",
  "knowledge-base": "knowledge_base",
  "onboarding-calls": "onboarding_calls",
  "agency-support": "agency_support",
  settings: "settings",
};

export interface TeamMember {
  email: string;
  name: string;
  phone?: string | null;
  isOwner?: boolean;
}

export interface AdminRow {
  id: string;
  admin_email: string;
  admin_name: string | null;
  admin_phone: string | null;
  status: string;
  permissions: Record<string, AccessLevel>;
  restrict_assigned_chats: boolean;
  restrict_assigned_tickets: boolean;
  notify_assigned_tickets: boolean;
  notify_assigned_chats: boolean;
}

export function useTeamAccess() {
  const { email, actualEmail } = useUser();
  const ownerEmail = (email || "").trim().toLowerCase();
  const me = (actualEmail || email || "").trim().toLowerCase();
  const isOwner = !me || me === ownerEmail || isPlatformAdminEmail(me);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!ownerEmail) return;
    const [{ data }, { data: owner }] = await Promise.all([
      (supabase as any).from("account_admins").select("*").ilike("owner_email", ownerEmail),
      supabase.from("saas_suite_users").select("full_name").ilike("email", ownerEmail).maybeSingle(),
    ]);
    setAdmins(((data || []) as AdminRow[]).filter((a) => a.status === "accepted" || a.status === "pending"));
    setOwnerName((owner as any)?.full_name ?? null);
    setLoaded(true);
  }, [ownerEmail]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const myRow = isOwner ? null : admins.find((a) => a.admin_email.toLowerCase() === me) ?? null;

  const level = (area: string): AccessLevel => {
    if (isOwner || !myRow) return "edit";
    return (myRow.permissions?.[area] as AccessLevel) || "edit";
  };

  const team: TeamMember[] = Array.from(
    new Map(
      [
        { email: ownerEmail, name: ownerName ? `${ownerName} (owner)` : "Owner", isOwner: true },
        ...admins
          .filter((a) => a.status === "accepted")
          .map((a) => ({ email: a.admin_email.toLowerCase(), name: a.admin_name || a.admin_email, phone: a.admin_phone })),
      ]
        .filter((m) => m.email)
        .map((m) => [m.email, m]),
    ).values(),
  );

  return {
    loaded,
    isOwner,
    me,
    ownerEmail,
    admins,
    team,
    myRow,
    level,
    restrictTickets: !!myRow?.restrict_assigned_tickets,
    restrictChats: !!myRow?.restrict_assigned_chats,
    reload,
  };
}
