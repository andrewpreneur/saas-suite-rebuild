import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { MultiAttachmentDropzone, type DropFile } from "@/components/support/MultiAttachmentDropzone";
import { uploadChatAttachment } from "@/lib/chatAttachment";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAgencyTicketCategories } from "@/hooks/useAgencyTicketCategories";
import { DEFAULT_TICKET_CATEGORIES } from "@/lib/ticketCategories";
import { ticketAgencyChoices, type TicketAgencyChoice } from "@/lib/ticketAgencyChoices";
import { initialTicketDescription, summarizeChat } from "@/lib/chatTicketDraft";
import { Check, ChevronsUpDown } from "lucide-react";

export { initialTicketDescription, summarizeChat };

interface Msg { content: string; role: string; created_at: string; sender_type?: string }

type TicketContact = { id: string; name: string | null; email: string; agencyId: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agencyId: string;
  userIdentifier?: string;
  messages?: Msg[];
  /** Tickets screen. Chat callers omit this so the conversation stays required. */
  source?: "agency_manual";
  agencyChoices?: TicketAgencyChoice[];
  onCreated?: () => void;
}

export default function OpenTicketFromChatDialog({
  open,
  onOpenChange,
  agencyId,
  userIdentifier = "",
  messages = [],
  source,
  agencyChoices,
  onCreated,
}: Props) {
  const manual = source === "agency_manual";
  const isEmail = userIdentifier.includes("@");
  const choices = agencyChoices?.length ? agencyChoices : ticketAgencyChoices({ base_id: agencyId });
  const choicesKey = choices.map((choice) => choice.id).join("\n");
  const [selectedAgencyId, setSelectedAgencyId] = useState(agencyId);
  const categoryAgencyId = manual ? selectedAgencyId : agencyId;
  const { categories } = useAgencyTicketCategories(categoryAgencyId);
  const labels = categories.map((item) => item.label);
  const labelsKey = labels.join("\n");
  const [name, setName] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_TICKET_CATEGORIES[0]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<DropFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [createdNumber, setCreatedNumber] = useState<number | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<string[] | null>(null);
  const [contacts, setContacts] = useState<TicketContact[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const firstAgency = choices[0]?.id || agencyId;
    setSelectedAgencyId(firstAgency);
    if (manual) {
      setName("");
      setEmailVal("");
      setText("");
    } else {
      setName(isEmail ? userIdentifier.split("@")[0] : userIdentifier);
      setEmailVal(isEmail ? userIdentifier : "");
      setText(initialTicketDescription(false, messages, userIdentifier));
    }
    setCategory(labels[0] || DEFAULT_TICKET_CATEGORIES[0]);
    setFiles([]);
    setRequestId(crypto.randomUUID());
    setCreatedNumber(null);
    setUploadedUrls(null);
    setPickerOpen(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setCategory((current) => (labels.includes(current) ? current : labels[0] || DEFAULT_TICKET_CATEGORIES[0]));
  }, [open, labelsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !manual) return;
    let cancelled = false;
    (async () => {
      const loaded: TicketContact[] = [];
      const seen = new Set<string>();
      for (const choice of choices) {
        const { data } = await supabase.rpc("get_agency_clients", { p_agency_id: choice.id });
        for (const row of (data as { user_id?: string; user_name?: string | null; user_email?: string | null }[]) || []) {
          const email = String(row.user_email || "").trim().toLowerCase();
          if (!email || seen.has(email)) continue;
          seen.add(email);
          loaded.push({
            id: String(row.user_id || email),
            name: row.user_name ? String(row.user_name) : null,
            email,
            agencyId: choice.id,
          });
        }
      }
      if (!cancelled) setContacts(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, manual, choicesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickContact = (contact: TicketContact) => {
    setName(contact.name || contact.email.split("@")[0]);
    setEmailVal(contact.email);
    if (choices.some((choice) => choice.id === contact.agencyId)) setSelectedAgencyId(contact.agencyId);
    setPickerOpen(false);
  };

  const submit = async () => {
    const em = emailVal.trim().toLowerCase();
    if (!name.trim() || !em || !text.trim() || !labels.includes(category)) {
      toast.error("Name, email, type and description are required");
      return;
    }
    if (!manual && !userIdentifier.trim()) {
      toast.error("Name, email, type and description are required");
      return;
    }
    setSaving(true);
    try {
      const urls = uploadedUrls || [];
      if (!uploadedUrls) {
        for (const f of files) urls.push(await uploadChatAttachment(`ticket-${categoryAgencyId}`, f.file));
        setUploadedUrls(urls);
      }
      const { data, error } = await supabase.functions.invoke("create-ticket-from-chat", { body: {
        request_id: requestId,
        agency_id: categoryAgencyId,
        user_identifier: manual ? em : userIdentifier,
        customer_name: name.trim(),
        customer_email: em,
        issue_category: category,
        request_text: text.trim(),
        attachment_urls: urls,
        ...(manual ? { source: "agency_manual" as const } : {}),
      } });
      if (error) {
        const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
        throw new Error(details?.error || error.message);
      }
      if (!data?.success) throw new Error(data?.error || "Failed to create ticket");
      setCreatedNumber(data.ticket_number);
      onCreated?.();
      if (!data.email_sent) {
        toast.warning(`Ticket #${data.ticket_number} created, but email was not sent. Use Retry Email.`);
        return;
      }
      toast.success(manual
        ? `Ticket #${data.ticket_number} created — confirmation emailed`
        : `Ticket #${data.ticket_number} created — confirmation and chat history emailed`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to open ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Ticket</DialogTitle>
          <DialogDescription>
            {manual
              ? "Pick a client or enter their name and email. They receive a confirmation, and the ticket shows up in this queue."
              : "The customer receives a ticket confirmation with the full chat history."}
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={saving || createdNumber !== null} className="space-y-3">
          {manual && (
            <div className="space-y-1">
              <Label>Client</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
                    <span className="truncate">{emailVal ? `${name || emailVal}` : "Pick from your existing users"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or email…" />
                    <CommandList>
                      <CommandEmpty>No users found. Enter their name and email below.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((contact) => {
                          const selected = emailVal.toLowerCase() === contact.email;
                          return (
                            <CommandItem
                              key={contact.id}
                              value={`${contact.name || ""} ${contact.email}`}
                              onSelect={() => pickContact(contact)}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                              <div className="flex flex-col">
                                <span className="text-sm">{contact.name || contact.email}</span>
                                {contact.name && <span className="text-xs text-muted-foreground">{contact.email}</span>}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
          {manual && choices.length > 1 && (
            <div className="space-y-1">
              <Label>Account</Label>
              <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {choices.map((choice) => <SelectItem key={choice.id} value={choice.id}>{choice.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Customer name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Customer email</Label><Input type="email" value={emailVal} onChange={(e) => setEmailVal(e.target.value)} placeholder="name@company.com" /></div>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            {labels.length === 0 ? (
              <p className="text-sm text-muted-foreground">This agency has no ticket types yet. Add one in Support settings.</p>
            ) : (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{labels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              rows={manual ? 6 : 9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={manual ? "What should the team follow up on?" : undefined}
            />
          </div>
          <MultiAttachmentDropzone value={files} onChange={setFiles} disabled={saving} />
        </fieldset>
        {createdNumber !== null && <p role="status" className="text-sm text-muted-foreground">Ticket #{createdNumber} is saved. Retry Email will not create another ticket.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Sending…" : createdNumber !== null ? "Retry Email" : "Create Ticket & Email"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
