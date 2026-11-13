import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, UserCog } from "lucide-react";

interface Props {
  email: string;
  team: { email: string; name: string }[];
  categories: string[];
}

interface Rule { issue_category: string; assign_to_email: string }

const ANY = "*";

export function TicketAutoAssignRules({ email, team, categories }: Props) {
  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [category, setCategory] = useState(ANY);
  const [custom, setCustom] = useState("");
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await (supabase as any)
      .from("support_ticket_assign_rules")
      .select("issue_category, assign_to_email")
      .in("agency_id", ids);
    const map = new Map<string, Rule>();
    (data || []).forEach((r: Rule) => map.set(r.issue_category.toLowerCase(), r));
    setRules(Array.from(map.values()));
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
        .ilike("email", email)
        .maybeSingle();
      const ids = Array.from(new Set(
        [data?.agency_id, data?.agency_id_basic, data?.agency_id_advanced, (data as any)?.agency_id_elite]
          .filter(Boolean)
          .map((s: string) => s.replace(/NO$/i, "")),
      ));
      setAgencyIds(ids);
      load(ids);
    })();
  }, [email]);

  const nameFor = (e: string) => team.find((m) => m.email === e.toLowerCase())?.name || e;

  const save = async () => {
    const cat = category === "__custom" ? custom.trim() : category;
    if (!cat || !assignee || !agencyIds.length) return;
    setSaving(true);
    const rows = agencyIds.map((agency_id) => ({ agency_id, issue_category: cat, assign_to_email: assignee }));
    const { error } = await (supabase as any)
      .from("support_ticket_assign_rules")
      .upsert(rows, { onConflict: "agency_id,issue_category" });
    setSaving(false);
    if (error) { toast.error("Couldn't save rule"); return; }
    toast.success("Auto-assign rule saved");
    setCustom("");
    load(agencyIds);
  };

  const remove = async (cat: string) => {
    const { error } = await (supabase as any)
      .from("support_ticket_assign_rules")
      .delete()
      .in("agency_id", agencyIds)
      .eq("issue_category", cat);
    if (error) { toast.error("Couldn't remove rule"); return; }
    setRules((r) => r.filter((x) => x.issue_category !== cat));
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog className="w-5 h-5" />Auto-assign rules</CardTitle>
        <CardDescription>New tickets of a type are assigned to the person you choose automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="Ticket type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any type (default)</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="__custom">Other type…</SelectItem>
            </SelectContent>
          </Select>
          {category === "__custom" && (
            <Input className="md:w-48" placeholder="Ticket type" value={custom} onChange={(e) => setCustom(e.target.value)} />
          )}
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="Assign to" /></SelectTrigger>
            <SelectContent>
              {team.map((m) => <SelectItem key={m.email} value={m.email}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={save} disabled={saving || !assignee}>Save rule</Button>
        </div>
        {rules.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rules.map((r) => (
              <li key={r.issue_category} className="flex items-center justify-between p-3 text-sm">
                <span>
                  <span className="font-medium">{r.issue_category === ANY ? "Any type" : r.issue_category}</span>
                  {" → "}{nameFor(r.assign_to_email)}
                </span>
                <Button variant="ghost" size="icon" onClick={() => remove(r.issue_category)} aria-label="Remove rule">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
