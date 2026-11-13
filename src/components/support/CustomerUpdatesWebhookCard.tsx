import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, Loader2, Play } from "lucide-react";
import {
  ticketReplyHint,
  ticketUpdateSubject,
} from "../../../supabase/functions/_shared/ticket-reply-match";
import GhlTicketEmailGuide from "@/components/support/ghlTicketEmailSetup";

const SNAPSHOT_URL =
  "https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=hHF8Q5UrsCdQ4KpF2O2D";

/** Same shape the live ticket-response webhook sends, with sample values. */
type Assignee = { name: string | null; email: string | null; phone: string | null };
const testPayload = (ownerEmail: string, assignee: Assignee) => ({
  test: true,
  source: "ticket_response",
  is_ticket: true,
  subject: ticketUpdateSubject(1001),
  customer_email: "test-customer@example.com",
  customer_name: "Test Customer",
  agency_owner_email: "test-customer@example.com",
  agency_id: "TEST_AGENCY",
  ticket_number: 1001,
  reply_hint: ticketReplyHint(1001),
  issue_category: "Technical Issue",
  their_last_message: "Hi there — I'm having trouble with the login page, it keeps redirecting me.",
  our_message:
    "Thanks for reaching out! I've reset your session — please try logging in again and let me know if it works.",
  attachment_url: null,
  instructions:
    "This is a SUPPORT TICKET RESPONSE (not a live chat reply). Email the customer their ticket update and tell them to log in to SaaSSuite, open Support, and scroll down to Tickets to view the full response. If attachment_url is set, embed or link that image in the outgoing email.",
  login_url: "https://saassuite.ai/app/support",
  conversation_summary_week:
    "In the past week the customer reported a login redirect loop. Team member reset the session and asked them to retry.",
  conversation_summary_all_time:
    "Customer has contacted support a few times, most recently about a login redirect loop.",
  responder_name: "Test Team Member",
  account_owner_email: ownerEmail,
  assigned_to_name: assignee.name,
  assigned_to_email: assignee.email,
  assigned_to_phone: assignee.phone,
  timestamp: new Date().toISOString(),
});

export default function CustomerUpdatesWebhookCard() {
  const { email, effectiveEmail } = useUser();
  const ownerEmail = (effectiveEmail || email || "").trim().toLowerCase();
  const [agency, setAgency] = useState("Your Agency");
  const [saved, setSaved] = useState("");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [assignee, setAssignee] = useState<Assignee>({ name: null, email: null, phone: null });

  useEffect(() => {
    if (!ownerEmail) return;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select(
          "agency_name, customer_updates_webhook_url, full_name, bonuses_phone, human_chat_mode",
        )
        .ilike("email", ownerEmail)
        .maybeSingle();
      if (data?.agency_name) setAgency(data.agency_name);
      setAssignee(
        data?.human_chat_mode === "managed"
          ? { name: "SaaSSuite", email: "team@yoursoftwareonboarding.com", phone: null }
          : {
              name: data?.full_name ?? null,
              email: ownerEmail,
              phone: data?.bonuses_phone ?? null,
            },
      );
      const url = data?.customer_updates_webhook_url ?? "";
      setSaved(url);
      setValue(url);
      if (url) setOpen(true);
    })();
  }, [ownerEmail]);

  const valid = (u: string) => !u || /^https:\/\/\S+$/i.test(u);

  const save = async () => {
    const v = value.trim();
    if (!valid(v)) return toast.error("Paste a full https:// webhook URL");
    setSaving(true);
    const { data, error } = await supabase
      .from("saas_suite_users")
      .update({ customer_updates_webhook_url: v || null })
      .ilike("email", ownerEmail)
      .select("email");
    setSaving(false);
    if (error || !data?.length) return toast.error("Couldn't save that webhook");
    setSaved(v);
    toast.success(
      v ? "Support updates now send from your CRM" : "Back to SaaSSuite's default sender",
    );
  };

  const test = async () => {
    const v = value.trim();
    if (!v || !valid(v)) return toast.error("Paste a full https:// webhook URL first");
    setTesting(true);
    try {
      const res = await fetch(v, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          testPayload(
            ownerEmail,
            assignee.email ? assignee : { name: null, email: ownerEmail, phone: null },
          ),
        ),
      });
      toast[res.ok ? "success" : "error"](
        res.ok ? "Test request sent" : `Test failed (${res.status})`,
      );
    } catch {
      toast.error("Test could not reach that URL");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
            <div>
              <p className="text-sm font-semibold">Send Support Updates From {agency}'s CRM</p>
              <p className="text-xs text-muted-foreground">
                {saved
                  ? "Customers get reply updates from your own CRM. From Email is one fixed address on your verified sending domain."
                  : "Customers get reply updates from SaaSSuite. Swap in your own webhook to send them from you."}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <ol className="text-sm space-y-2 list-decimal pl-5">
              <li>
                <a
                  href={SNAPSHOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  Install Snapshot <ExternalLink className="w-3 h-3" />
                </a>{" "}
                in your HighLevel account.
              </li>
              <li>Copy the Webhook Trigger URL from the snapshot's workflow.</li>
              <li>Paste it in SaaSSuite below.</li>
              <li>Test Request here, then save in both platforms.</li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="url"
                placeholder="https://services.leadconnectorhq.com/hooks/..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => void test()}
                disabled={testing || !value.trim()}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Test Request
                  </>
                )}
              </Button>
              <Button onClick={() => void save()} disabled={saving || value.trim() === saved}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank and save to go back to SaaSSuite sending updates.
            </p>
            <GhlTicketEmailGuide replyUrl="support-settings" />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
