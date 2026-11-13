import { PageHeader } from "@/components/platform/PageHeader";
import { useState, useEffect } from "react";
import { AlertTriangle, Pencil, Trash2, Save, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";

interface Client {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  last_accessed: string | null;
  login_count: number;
  source_agency_id?: string;
  is_old_agency?: boolean;
  old_agency_id?: string | null;
}

export function ClientsManager() {
  const { email } = useUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const fetchClients = async () => {
    if (!email) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const stop = armLoadDeadline(() => {
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });

    try {
    const { data: userData, error } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite")
      .ilike("email", email)
      .maybeSingle();

    if (error) throw error;
    if (!userData) {
      setClients([]);
      return;
    }

    const currentIds = new Set(
      [
        userData.agency_id,
        userData.agency_id_basic,
        userData.agency_id_advanced,
        userData.agency_id_elite,
      ].filter(Boolean) as string[]
    );
    const originalIds = [
      userData.original_agency_id,
      userData.original_agency_id_basic,
      userData.original_agency_id_advanced,
      userData.original_agency_id_elite,
    ].filter(Boolean) as string[];
    const oldOnlyIds = originalIds.filter((id) => !currentIds.has(id));
    const allIds = Array.from(new Set([...currentIds, ...oldOnlyIds]));

    const allClients: Client[] = [];
    for (const agencyId of allIds) {
      const { data } = await supabase.rpc("get_agency_clients", { p_agency_id: agencyId });
      if (data) {
        const isOld = !currentIds.has(agencyId);
        for (const c of data as Client[]) {
          allClients.push({
            ...c,
            source_agency_id: agencyId,
            is_old_agency: isOld,
            old_agency_id: isOld ? agencyId : null,
          });
        }
      }
    }

    // Deduplicate by user_id, preferring entries sourced from a current agency_id
    const map = new Map<string, Client>();
    for (const c of allClients) {
      const existing = map.get(c.user_id);
      if (!existing || (existing.is_old_agency && !c.is_old_agency)) {
        map.set(c.user_id, c);
      }
    }
    setClients(Array.from(map.values()));
    } catch (loadFailure) {
      setLoadError(loadErrorText(loadFailure, "Couldn't load clients."));
    } finally {
      stop();
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [email, loadAttempt]);

  const startEdit = (client: Client) => {
    setEditingId(client.user_id);
    setEditName(client.user_name || "");
    setEditEmail(client.user_email || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.rpc("update_agency_client", {
      p_user_id: editingId,
      p_name: editName || null,
      p_email: editEmail || null,
    });
    setEditingId(null);
    toast.success("Client updated");
    fetchClients();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await supabase.rpc("delete_agency_client", { p_user_id: deleteTarget.user_id });
    setDeleteTarget(null);
    toast.success("Client removed");
    fetchClients();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`Everyone who has logged into your Client Hub. You have ${clients.length} client${clients.length === 1 ? "" : "s"}.`}
      />

      {loadError ? (
        <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />
      ) : loading ? (
        <TableSkeleton rows={5} />
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No clients onboarded yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Modules Completed</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.user_id}>
                  <TableCell>
                    {editingId === client.user_id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                    ) : (
                      <div className="min-w-0">
                        <span>{client.user_name || "—"}</span>
                        {client.is_old_agency && client.old_agency_id && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>
                              Signed up under the old agency id "{client.old_agency_id}". Their progress will not load on the new URL.
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === client.user_id ? (
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8" />
                    ) : (
                      client.user_email || "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {client.user_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{client.login_count}</TableCell>
                  <TableCell>
                    {editingId === client.user_id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={saveEdit} className="h-8 w-8" aria-label="Save">
                          <Save className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="icon" aria-label="Close" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="icon" aria-label="Edit" variant="ghost" onClick={() => startEdit(client)} className="h-8 w-8">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" aria-label="Delete" variant="ghost" onClick={() => setDeleteTarget(client)} className="h-8 w-8">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteTarget?.user_name || deleteTarget?.user_email || "this client"}? They will lose their onboarding progress and checklist completions. They can still log in later if they wish, but will start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
