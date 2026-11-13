import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCog } from "lucide-react";

type Mode = "owner" | "person" | "round_robin" | "category";
const CATEGORIES = ["Technical Issue", "Billing", "Feature Request", "Website Edits", "Account Access", "Other"];
const OWNER = "__owner";
const boxClass =
  "h-5 w-5 rounded-[4px] border-2 border-[hsl(var(--brand-purple))] data-[state=checked]:bg-[hsl(var(--brand-purple))] data-[state=checked]:text-primary-foreground";

/** "Assign chats & tickets by default": owner, one person, round robin, or by ticket type. */
export default function DefaultAssignmentCard() {
  const { email: rawEmail } = useUser();
  const owner = (rawEmail || "").trim().toLowerCase();
  const [loaded, setLoaded] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [managed, setManaged] = useState(false);
  const [team, setTeam] = useState<{ email: string; name: string }[]>([]);
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("owner");
  const [person, setPerson] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [fallback, setFallback] = useState(OWNER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!owner) return;
    (async () => {
      const [{ data: u }, { data: admins }, { data: st }, { data: auth }] = await Promise.all([
        supabase.from("saas_suite_users").select("full_name, human_chat_mode, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite" as any).ilike("email", owner).maybeSingle(),
        supabase.from("account_admins").select("admin_email, admin_name, status").ilike("owner_email", owner),
        (supabase as any).from("support_assignment_settings").select("*").eq("owner_email", owner).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      const uu: any = u || {};
      setManaged(uu.human_chat_mode === "managed");
      const ids = Array.from(new Set([uu.agency_id, uu.agency_id_basic, uu.agency_id_advanced, uu.agency_id_elite].filter(Boolean).map((s: string) => s.replace(/NO$/i, "")))) as string[];
      setAgencyIds(ids);
      setTeam([
        { email: owner, name: `${uu.full_name || "Account owner"} (owner)` },
        ...((admins || []) as any[]).filter((a) => a.status === "accepted")
          .map((a) => ({ email: String(a.admin_email).toLowerCase(), name: a.admin_name || a.admin_email })),
      ]);
      const me = (auth?.user?.email || "").toLowerCase();
      const { data: pa } = await (supabase as any).rpc("is_platform_admin");
      setCanEdit(me === owner || pa === true);
      if (st) {
        setMode(st.mode); setPerson(st.person_email || ""); setMembers(st.rr_members || []);
        setFallback(st.fallback_email || OWNER);
      }
      if (ids.length) {
        const { data: rules } = await (supabase as any).from("support_ticket_assign_rules").select("issue_category, assign_to_email").in("agency_id", ids);
        const m: Record<string, string> = {};
        (rules || []).forEach((r: any) => { if (CATEGORIES.includes(r.issue_category)) m[r.issue_category] = String(r.assign_to_email).toLowerCase(); });
        setCatMap(m);
      }
      setLoaded(true);
    })();
  }, [owner]);

  if (!loaded) return null;

  const save = async () => {
    if (mode === "person" && !person) return toast.error("Pick a person.");
    if (mode === "round_robin" && members.length < 1) return toast.error("Pick at least one person for round robin.");
    setSaving(true);
    const { error } = await (supabase as any).from("support_assignment_settings").upsert({
      owner_email: owner, mode,
      person_email: mode === "person" ? person : null,
      rr_members: mode === "round_robin" ? members : [],
      fallback_email: mode === "category" && fallback !== OWNER ? fallback : null,
    }, { onConflict: "owner_email" });
    let ruleErr: any = null;
    if (!error && mode === "category" && agencyIds.length) {
      const set = CATEGORIES.filter((c) => catMap[c] && catMap[c] !== OWNER);
      const unset = CATEGORIES.filter((c) => !set.includes(c));
      if (set.length) {
        ({ error: ruleErr } = await (supabase as any).from("support_ticket_assign_rules").upsert(
          agencyIds.flatMap((agency_id) => set.map((c) => ({ agency_id, issue_category: c, assign_to_email: catMap[c] }))),
          { onConflict: "agency_id,issue_category" }));
      }
      if (!ruleErr && unset.length) {
        ({ error: ruleErr } = await (supabase as any).from("support_ticket_assign_rules").delete().in("agency_id", agencyIds).in("issue_category", unset));
      }
    }
    setSaving(false);
    if (error || ruleErr) return toast.error("Couldn't save default assignment.");
    toast.success("Default assignment saved");
  };

  const personSelect = (value: string, onChange: (v: string) => void, withOwnerDefault = false) => (
    <Select value={value} onValueChange={onChange} disabled={!canEdit}>
      <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Pick a person" /></SelectTrigger>
      <SelectContent>
        {withOwnerDefault && <SelectItem value={OWNER}>Unassigned (owner gets alerts)</SelectItem>}
        {team.map((m) => <SelectItem key={m.email} value={m.email}>{m.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <UserCog className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Assign chats & tickets by default</p>
            <p className="text-xs text-muted-foreground">New chats and tickets are assigned right away. Once a customer has someone, they keep that person until it's changed by hand.</p>
          </div>
        </div>

        {managed ? (
          <p className="text-sm text-muted-foreground">Our team handles your chats and tickets (We Handle & Respond), so default assignment doesn't apply.</p>
        ) : (
          <>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)} disabled={!canEdit}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Account owner (default)</SelectItem>
                <SelectItem value="person">One person</SelectItem>
                <SelectItem value="round_robin">Round robin</SelectItem>
                <SelectItem value="category">By ticket type</SelectItem>
              </SelectContent>
            </Select>

            {mode === "owner" && <p className="text-xs text-muted-foreground">New chats and tickets stay unassigned and alerts go to the account owner.</p>}
            {mode === "person" && personSelect(person, setPerson)}
            {mode === "round_robin" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">New chats and tickets take turns between these people.</p>
                {team.map((m) => (
                  <label key={m.email} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox className={boxClass} disabled={!canEdit} checked={members.includes(m.email)}
                      onCheckedChange={(v) => setMembers((p) => v === true ? [...p, m.email] : p.filter((x) => x !== m.email))} />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
            {mode === "category" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tickets go to the person picked for their type. Chats have no type, so they go to the fallback person.</p>
                {CATEGORIES.map((c) => (
                  <div key={c} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="text-sm sm:w-40">{c}</span>
                    {personSelect(catMap[c] || OWNER, (v) => setCatMap((p) => ({ ...p, [c]: v })), true)}
                  </div>
                ))}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 pt-2 border-t">
                  <span className="text-sm sm:w-40 font-medium">Chats & anything else</span>
                  {personSelect(fallback, setFallback, true)}
                </div>
              </div>
            )}
            {team.length === 1 && mode !== "owner" && (
              <p className="text-xs text-muted-foreground">Invite admins in Settings → Admins to assign to other people.</p>
            )}
            {canEdit
              ? <Button variant="accent" onClick={save} disabled={saving}>Save</Button>
              : <p className="text-xs text-muted-foreground">Only the account owner can change this.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
