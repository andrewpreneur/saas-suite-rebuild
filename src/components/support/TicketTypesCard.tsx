import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/premium/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  agencyTicketCategoriesKey,
  useAgencyTicketCategories,
  useOwnerAgencyId,
} from "@/hooks/useAgencyTicketCategories";
import {
  buildTicketTypeEditorRows,
  moveTicketType,
  ticketTypeLabelError,
  TICKET_CATEGORY_MAX_LENGTH,
  type StoredTicketCategory,
  type TicketTypeEditorRow,
} from "@/lib/ticketCategories";

interface Props {
  ownerEmail: string;
}

type StoredRow = StoredTicketCategory & { id: string };

export function TicketTypesCard({ ownerEmail }: Props) {
  const owner = ownerEmail.trim().toLowerCase();
  const queryClient = useQueryClient();
  const { data: agencyId = null } = useOwnerAgencyId(owner);
  useAgencyTicketCategories(agencyId);
  const [stored, setStored] = useState<StoredRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!owner) return;
    const { data, error } = await supabase
      .from("agency_ticket_categories")
      .select("id, label, sort_order, is_hidden, is_default")
      .ilike("owner_email", owner);
    if (error) {
      setLoadFailed(true);
      setLoaded(true);
      return;
    }
    setLoadFailed(false);
    setStored((data || []) as StoredRow[]);
    setLoaded(true);
  }, [owner]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = buildTicketTypeEditorRows(stored);
  const active = rows.filter((row) => !row.is_hidden);
  const hidden = rows.filter((row) => row.is_hidden && row.is_default);

  const refresh = async () => {
    await load();
    await queryClient.invalidateQueries({ queryKey: agencyTicketCategoriesKey(agencyId) });
  };

  const write = async (row: TicketTypeEditorRow) => {
    const existing = stored.find((item) => item.label.toLowerCase() === row.label.toLowerCase());
    if (existing) {
      const { error } = await supabase
        .from("agency_ticket_categories")
        .update({
          label: row.label,
          sort_order: row.sort_order,
          is_hidden: row.is_hidden,
          is_default: row.is_default,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from("agency_ticket_categories").insert({
      owner_email: owner,
      label: row.label,
      sort_order: row.sort_order,
      is_hidden: row.is_hidden,
      is_default: row.is_default,
    });
    if (error) throw error;
  };

  const run = async (action: () => Promise<void>, success: string) => {
    if (loadFailed) {
      toast.error("Ticket types are not available yet");
      return;
    }
    setBusy(true);
    try {
      await action();
      await refresh();
      toast.success(success);
    } catch (error: unknown) {
      const details = error as { message?: string; details?: string; code?: string };
      const message = String(details.message || details.details || details.code || "");
      toast.error(
        message.toLowerCase().includes("duplicate") || message.includes("23505")
          ? "That ticket type already exists"
          : "Couldn't save ticket types",
      );
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const error = ticketTypeLabelError(
      adding,
      rows.map((row) => row.label),
    );
    if (error) {
      toast.error(error);
      return;
    }
    const label = adding.trim();
    const sort_order = active.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    void run(async () => {
      await write({ label, sort_order, is_hidden: false, is_default: false });
      setAdding("");
    }, `Added ${label}`);
  };

  const rename = (row: TicketTypeEditorRow) => {
    const error = ticketTypeLabelError(
      draft,
      rows
        .filter((item) => item.label.toLowerCase() !== row.label.toLowerCase())
        .map((item) => item.label),
    );
    if (error) {
      toast.error(error);
      return;
    }
    const label = draft.trim();
    void run(async () => {
      if (row.is_default) {
        await write({ ...row, is_hidden: true });
        await write({ label, sort_order: row.sort_order, is_hidden: false, is_default: false });
      } else {
        const existing = stored.find(
          (item) => item.label.toLowerCase() === row.label.toLowerCase(),
        );
        if (!existing) throw new Error("missing");
        const { error: updateError } = await supabase
          .from("agency_ticket_categories")
          .update({ label })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      }
      setEditing(null);
    }, `Renamed to ${label}`);
  };

  const hide = (row: TicketTypeEditorRow, is_hidden: boolean) => {
    if (is_hidden && active.length <= 1) {
      toast.error("Keep at least one ticket type");
      return;
    }
    void run(
      async () => {
        await write({ ...row, is_hidden });
      },
      is_hidden ? `Hid ${row.label}` : `Showing ${row.label}`,
    );
  };

  const remove = (row: TicketTypeEditorRow) => {
    if (active.length <= 1) {
      toast.error("Keep at least one ticket type");
      return;
    }
    const existing = stored.find((item) => item.label.toLowerCase() === row.label.toLowerCase());
    if (!existing) return;
    void run(async () => {
      const { error } = await supabase
        .from("agency_ticket_categories")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    }, `Removed ${row.label}`);
  };

  const reorder = (row: TicketTypeEditorRow, direction: -1 | 1) => {
    const next = moveTicketType(rows, row.label, direction);
    if (next === rows) return;
    void run(async () => {
      for (const item of next.filter((entry) => !entry.is_hidden)) await write(item);
    }, "Order saved");
  };

  const rowControls = (row: TicketTypeEditorRow, index: number) => (
    <div className="flex items-center gap-1">
      {editing === row.label ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            rename(row);
          }}
        >
          <Input
            aria-label={`Rename ${row.label}`}
            value={draft}
            maxLength={TICKET_CATEGORY_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            className="h-8 w-40"
            autoFocus
          />
          <Button variant="accent" type="submit" size="sm" disabled={busy}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${row.label} up`}
            disabled={busy || index === 0}
            onClick={() => reorder(row, -1)}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${row.label} down`}
            disabled={busy || index === active.length - 1}
            onClick={() => reorder(row, 1)}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Rename ${row.label}`}
            disabled={busy}
            onClick={() => {
              setEditing(row.label);
              setDraft(row.label);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {row.is_default ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Hide ${row.label}`}
              disabled={busy}
              onClick={() => hide(row, true)}
            >
              <EyeOff className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete ${row.label}`}
              disabled={busy}
              onClick={() => remove(row)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <SectionCard
      icon={<Tags />}
      title="Ticket types"
      description="The choices a client sees when a ticket is opened, including from a chat. Hide a standard type or add your own."
      bodyClassName="space-y-4"
    >
        {loadFailed && (
          <p className="text-sm text-muted-foreground">
            Ticket types could not be loaded. The standard list is still used until this is
            available.
          </p>
        )}
        {loaded && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {active.map((row, index) => (
              <li key={row.label} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{row.label}</span>
                  <Badge variant="outline">{row.is_default ? "Standard" : "Custom"}</Badge>
                </span>
                {rowControls(row, index)}
              </li>
            ))}
          </ul>
        )}
        {hidden.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Hidden</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {hidden.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 p-3 text-sm text-muted-foreground"
                >
                  <span>{row.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => hide(row, false)}
                  >
                    <Eye className="w-4 h-4" /> Show
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Input
            aria-label="New ticket type"
            placeholder="New ticket type"
            value={adding}
            maxLength={TICKET_CATEGORY_MAX_LENGTH}
            onChange={(event) => setAdding(event.target.value)}
            disabled={busy || loadFailed}
          />
          <Button type="submit" disabled={busy || loadFailed || !adding.trim()}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </form>
    </SectionCard>
  );
}
