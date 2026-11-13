// Shared enrichment for support notifications: account, agency, and assignee details.
// deno-lint-ignore-file no-explicit-any
export type Person = { name: string | null; email: string; phone: string | null };

const AGENCY_COLS = "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite";

export async function findOwnerByAgency(supabase: any, agencyId: string) {
  const id = String(agencyId || "").replace(/NO$/i, "");
  const { data } = await supabase
    .from("saas_suite_users")
    .select(`email, full_name, agency_name, bonuses_phone, human_chat_mode, notify_all_tickets, notify_all_chats, notify_assigned_tickets, ${AGENCY_COLS}`)
    .or(`agency_id.eq.${id},agency_id_basic.eq.${id},agency_id_advanced.eq.${id},agency_id_elite.eq.${id}`)
    .limit(1)
    .maybeSingle();
  return data as any;
}

export async function resolvePerson(supabase: any, ownerEmail: string | null, email: string | null): Promise<(Person & { admin?: any }) | null> {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (ownerEmail && e === ownerEmail.toLowerCase()) {
    const { data } = await supabase.from("saas_suite_users").select("full_name, bonuses_phone").ilike("email", e).maybeSingle();
    return { name: data?.full_name ?? null, email: e, phone: data?.bonuses_phone ?? null };
  }
  let q = supabase.from("account_admins").select("*").ilike("admin_email", e).eq("status", "accepted");
  if (ownerEmail) q = q.ilike("owner_email", ownerEmail);
  const { data: admin } = await q.limit(1).maybeSingle();
  if (admin) return { name: admin.admin_name || null, email: e, phone: admin.admin_phone || null, admin };
  const { data } = await supabase.from("saas_suite_users").select("full_name, bonuses_phone").ilike("email", e).maybeSingle();
  return { name: data?.full_name ?? null, email: e, phone: data?.bonuses_phone ?? null };
}

/** Extra fields appended to existing webhook payloads (never replaces existing keys). */
export async function supportExtraFields(
  supabase: any,
  agencyId: string,
  opts: { ticketAssignedTo?: string | null; userIdentifier?: string | null; responderEmail?: string | null },
) {
  const owner = await findOwnerByAgency(supabase, agencyId);
  let assignedEmail = opts.ticketAssignedTo ?? null;
  if (!assignedEmail && opts.userIdentifier) {
    const { data } = await supabase
      .from("support_chat_assignments")
      .select("assigned_to_email")
      .eq("agency_id", agencyId)
      .ilike("user_identifier", opts.userIdentifier)
      .maybeSingle();
    assignedEmail = data?.assigned_to_email ?? null;
  }
  // "We Handle & Respond": SaaSSuite is always the assigned party.
  const assignee = owner?.human_chat_mode === "managed"
    ? { name: "SaaSSuite", email: "team@yoursoftwareonboarding.com", phone: null }
    : await resolvePerson(supabase, owner?.email ?? null, assignedEmail || owner?.email || null);
  const responder = await resolvePerson(supabase, owner?.email ?? null, opts.responderEmail ?? null);
  return {
    account_name: owner?.agency_name ?? null,
    account_owner_name: owner?.full_name ?? null,
    account_owner_email: owner?.email ?? null,
    account_owner_phone: owner?.bonuses_phone ?? null,
    account_agency_id: agencyId,
    assigned_to_name: assignee?.name ?? null,
    assigned_to_email: assignee?.email ?? null,
    assigned_to_phone: assignee?.phone ?? null,
    responder_name: responder?.name ?? null,
    responder_email: responder?.email ?? null,
    responder_phone: responder?.phone ?? null,
  };
}
