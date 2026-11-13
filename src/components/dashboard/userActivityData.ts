import { supabase } from "@/integrations/supabase/client";
import { VIDEO_CATEGORIES } from "@/constants/videoCategories";

export interface ActivityUser {
  id: string;
  email: string | null;
  name: string | null;
  agency_id?: string;
  last_accessed: string | null;
}

export async function loadUserActivity(user: ActivityUser, agencyIds: string[], showChats: boolean, showTickets: boolean) {
  const scope = user.agency_id ? [user.agency_id] : agencyIds;
  if (!scope.length) throw new Error("Account links are unavailable. Please refresh your dashboard.");
  const identifier = (user.email || user.id).trim().toLowerCase();
  const hasProgressId = /^[0-9a-f-]{36}$/i.test(user.id);
  const progressResult = hasProgressId ? await supabase.from("user_progress")
    .select("id, name, email, phone, agency_id, created_at, last_accessed")
    .in("agency_id", scope).eq("id", user.id).maybeSingle() : { data: null, error: null };
  // Checklist-only users have email identifiers rather than UUID progress IDs.
  const progress = progressResult.data;
  if (progressResult.error) throw progressResult.error;
  const [modules, items, completedItems, tickets, threads, customVideos, overrides] = await Promise.all([
    progress ? supabase.from("module_completion").select("id, category_id, module_id, completed_at")
      .eq("user_id", progress.id).eq("completed", true).order("completed_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    supabase.from("agency_onboarding_checklist").select("id, agency_id, title, item_order")
      .in("agency_id", scope).order("item_order"),
    supabase.from("user_onboarding_checklist_completion").select("checklist_item_id, completed_at, agency_id")
      .in("agency_id", scope).eq("user_identifier", identifier),
    showTickets ? fetchAllTickets(scope, identifier) : Promise.resolve({ data: [], error: null }),
    showChats ? supabase.from("chat_threads").select("agency_id, user_identifier, last_user_message_at, last_owner_message_at, last_assistant_message_at")
      .in("agency_id", scope).eq("user_identifier", identifier) : Promise.resolve({ data: [], error: null }),
    supabase.from("custom_onboarding_videos").select("id, title").in("agency_id", scope),
    supabase.from("agency_module_name_overrides").select("category_id, module_id, display_name").in("agency_id", scope),
  ]);
  for (const result of [modules, items, completedItems, tickets, threads, customVideos, overrides]) {
    if (result.error) throw result.error;
  }
  // A readable thread is the permission gate for public human-message records.
  const chatScope = (threads.data || []).map(t => t.agency_id);
  const [ai, human] = chatScope.length ? await Promise.all([
    supabase.from("ai_chat_messages").select("id, content, role, created_at")
      .in("agency_id", chatScope).eq("user_identifier", identifier).order("created_at", { ascending: false }).limit(1),
    supabase.from("agency_owner_messages").select("id, content, sender_type, sender_name, created_at")
      .in("agency_id", chatScope).eq("user_identifier", identifier).order("created_at", { ascending: false }).limit(1),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (ai.error || human.error) throw ai.error || human.error;
  // Only request replies for tickets already returned by the assignment-aware RLS query.
  const latestReplies: { content: string; at: string; sender: string }[] = [];
  for (let offset = 0; offset < (tickets.data || []).length; offset += 20) {
    const results = await Promise.all((tickets.data || []).slice(offset, offset + 20).map(async ticket => {
      const result = await supabase.rpc("get_ticket_replies_for_staff", { p_ticket_id: ticket.id });
      if (result.error) throw result.error;
      const latest = (result.data || []).slice(-1)[0];
      return latest ? { content: latest.body, at: latest.created_at, sender: latest.sender_name || (latest.sender_role === "customer" ? "Customer" : "Support team") } : null;
    }));
    results.forEach(reply => { if (reply) latestReplies.push(reply); });
  }
  const messages = [
    ...latestReplies,
    ...(ai.data || []).map(m => ({ content: m.content, at: m.created_at, sender: m.role === "user" ? "Customer" : "AI support" })),
    ...(human.data || []).map(m => ({ content: m.content, at: m.created_at, sender: m.sender_name || (m.sender_type === "user" ? "Customer" : "Support team") })),
    ...(tickets.data || []).flatMap(t => [
      { content: t.request_text, at: t.created_at, sender: "Customer · support ticket" },
      // Skip the legacy admin_response copy when the same reply already came
      // back from the replies thread, so the message never appears twice.
      ...(t.admin_response && t.responded_at && !latestReplies.some(r => r.content.trim() === t.admin_response!.trim())
        ? [{ content: t.admin_response, at: t.responded_at, sender: "Support team · ticket response" }]
        : []),
    ]),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const videos = Array.from(new Map((modules.data || []).map(m => [`${m.category_id}:${m.module_id}`, m])).values()).map(m => ({
    ...m,
    title: overrides.data?.find(o => o.category_id === m.category_id && o.module_id === m.module_id)?.display_name
      || customVideos.data?.find(v => v.id === m.module_id)?.title
      || VIDEO_CATEGORIES.find(c => c.id === m.category_id)?.modules.find(v => v.id === m.module_id)?.name
      || (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(m.module_id) ? "Custom video" : m.module_id.replace(/[-_]+/g, " ")),
  }));
  const checklist = (items.data || []).map(item => ({ ...item, completedAt: completedItems.data?.find(c => c.checklist_item_id === item.id)?.completed_at || null }));
  const done = checklist.filter(i => i.completedAt);
  const finishedAt = checklist.length > 0 && done.length === checklist.length
    ? done.map(i => i.completedAt || "").sort().slice(-1)[0] || null : null;
  return { progress, videos, checklist, finishedAt, tickets: tickets.data || [], lastMessage: messages[0] || null };
}

async function fetchAllTickets(scope: string[], identifier: string) {
  const rows: TicketRecord[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from("support_tickets")
      .select("id, ticket_number, issue_category, request_text, status, created_at, updated_at, admin_response, responded_at")
      .in("agency_id", scope).eq("customer_email", identifier)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (result.error) return { data: rows, error: result.error };
    rows.push(...(result.data || []));
    if ((result.data || []).length < 500) return { data: rows, error: null };
  }
}

interface TicketRecord {
  id: string;
  ticket_number: number;
  issue_category: string;
  request_text: string;
  status: string;
  created_at: string;
  updated_at: string;
  admin_response: string | null;
  responded_at: string | null;
}

export type UserActivityData = Awaited<ReturnType<typeof loadUserActivity>>;