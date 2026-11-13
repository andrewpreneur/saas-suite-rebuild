import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Loader2, MessageSquareReply, Play } from "lucide-react";
import GhlTicketEmailGuide from "@/components/support/ghlTicketEmailSetup";

const BASE = "https://auth.saassuite.ai/functions/v1/inbound-ticket-reply";

const SAMPLE = `{
  "customer_email": "{{contact.email}}",
  "customer_name": "{{contact.name}}",
  "customer_reply": "{{message.body}}",
  "subject": "{{message.subject}}"
}`;

/** A ticket number that will not match, so the setup check never saves a reply. */
const TEST_TICKET_NUMBER = 999999999;

/** Inbound webhook: send a customer's emailed reply TO SaaSSuite and it lands in their ticket. */
export default function CustomerRepliesWebhookPanel({ compact = false }: { compact?: boolean }) {
  const { email, effectiveEmail } = useUser();
  const ownerEmail = (effectiveEmail || email || "").trim().toLowerCase();
  const [agencyId, setAgencyId] = useState("");
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!ownerEmail) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("agency_id, inbound_reply_key")
        .ilike("email", ownerEmail)
        .maybeSingle();
      if (cancelled) return;
      setAgencyId(data?.agency_id ?? "");
      setKey(data?.inbound_reply_key ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerEmail]);

  const url = agencyId && key ? `${BASE}/${agencyId}?key=${key}` : "";
  const copy = (t: string) => {
    void navigator.clipboard.writeText(t);
    toast.success("Copied");
  };

  const sendTest = async () => {
    if (!url) return;
    setTesting(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: "setup-test@example.com",
          customer_name: "Setup Test",
          customer_reply: "This is a setup test from SaaSSuite. Please ignore it.",
          subject: `Re: Update on your support ticket [#${TEST_TICKET_NUMBER}]`,
          ticket_number: TEST_TICKET_NUMBER,
          ticket_id: "00000000-0000-0000-0000-000000000000",
        }),
      });
      if (res.status === 404) {
        toast.success("URL and key accepted. Nothing was saved (no matching ticket).");
      } else if (res.ok) {
        toast.success("Test reply was accepted.");
      } else if (res.status === 401) {
        toast.error("The URL or key was rejected. Copy the URL again.");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ? String(data.error) : `Test failed (${res.status})`);
      }
    } catch {
      toast.error("Test could not reach that URL");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "rounded-lg border p-5 space-y-3"}>
      <div className="flex items-center gap-2">
        <MessageSquareReply className="w-5 h-5 text-muted-foreground" />
        <Label className="font-semibold text-base">Customer Replies Webhook (incoming)</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        When a customer replies to a ticket email, GoHighLevel POSTs that reply here and it is added
        to the ticket. The ticket email has to come from your verified GoHighLevel sending domain,
        or the reply stays in a personal inbox. Outbound subjects include{" "}
        <span className="font-medium text-foreground">[#239]</span> so the reply can be matched.
        Keep this URL private — the key is already in it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          readOnly
          value={url || "Loading…"}
          className="min-w-[16rem] flex-1 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => copy(url)}
          disabled={!url}
          aria-label="Copy webhook URL"
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void sendTest()}
          disabled={!url || testing}
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Send test
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Send test checks this URL and key against a ticket that does not exist. “Ticket not found”
        means it was accepted and nothing was saved.
      </p>
      <GhlTicketEmailGuide dense replyUrl="above" />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">
            Raw JSON body (POST, Content-Type: application/json)
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => copy(SAMPLE)}>
            <Copy className="w-3 h-3 mr-1" />
            Copy JSON
          </Button>
        </div>
        <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{SAMPLE}</pre>
      </div>
    </div>
  );
}
