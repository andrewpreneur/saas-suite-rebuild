import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy } from "lucide-react";

/** From Name on the Support Response email. Copy this into GoHighLevel; do not copy assigned_to_email. */
export const FROM_NAME_MERGE = "{{inboundWebhookRequest.assigned_to_name}}";

export function CopyToken({ value }: { value: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mx-0.5 inline-flex h-auto min-h-6 max-w-full whitespace-normal break-all px-1.5 py-0.5 text-left align-middle font-mono text-[11px] font-normal"
      aria-label={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        toast.success("Copied");
      }}
    >
      <span>{value}</span>
      <Copy className="ml-1 h-3 w-3 shrink-0" />
    </Button>
  );
}

function FieldMap({ token, hint }: { token: string; hint: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <CopyToken value={token} />
      <span>{hint}</span>
    </li>
  );
}

/**
 * Shared GoHighLevel ticket-email setup. Shown on the outbound customer-updates
 * card and the inbound replies panel so the two workflows stay in sync.
 */
export default function GhlTicketEmailGuide({
  dense = false,
  replyUrl = "above",
}: {
  dense?: boolean;
  /** Where the inbound URL is, relative to this guide. */
  replyUrl?: "above" | "support-settings";
}) {
  const text = dense ? "text-xs" : "text-sm";
  const urlStep =
    replyUrl === "above"
      ? "Paste the URL above, including ?key=."
      : "Paste this agency’s Customer Replies Webhook URL from Client Hub → Support. It includes ?key=.";

  return (
    <div className={`space-y-4 ${text} text-muted-foreground`}>
      <section className="space-y-1.5">
        <p className="font-medium text-foreground">Support Response email</p>
        <p>This is the workflow triggered by the customer updates webhook.</p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            Set <span className="font-medium text-foreground">From Email</span> to one fixed address
            on your verified GoHighLevel / LeadConnector sending domain, for example{" "}
            <span className="font-medium text-foreground">support@mail.youragency.com</span>. Verify
            that domain in GHL Email Services.
          </li>
          <li>
            A personal or Google Workspace inbox — {"{{assigned_to_email}}"} or{" "}
            <span className="font-medium text-foreground">moe@agency.com</span> — receives the
            customer’s reply in that inbox. GoHighLevel and SaaSSuite never get it.
          </li>
          <li>
            Set <span className="font-medium text-foreground">From Name</span> to the handler’s
            name: <CopyToken value={FROM_NAME_MERGE} />
          </li>
          <li>Publish the workflow.</li>
        </ol>
      </section>

      <section className="space-y-1.5">
        <p className="font-medium text-foreground">Email Reply to SaaSSuite</p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            Trigger: <span className="font-medium text-foreground">Customer Replied</span>, channel{" "}
            <span className="font-medium text-foreground">Email</span>.
          </li>
          <li>
            Turn <span className="font-medium text-foreground">Allow re-entry</span> ON, then{" "}
            <span className="font-medium text-foreground">Publish</span>. Re-entry stays on so the
            next reply is delivered too.
          </li>
          <li>
            Add a Webhook action set to <span className="font-medium text-foreground">POST</span>.{" "}
            {urlStep}
          </li>
          <li>
            In Custom Data, map these keys.{" "}
            <span className="font-medium text-foreground">customer_reply</span> is the Message Body
            text.
            <ul className="mt-1.5 space-y-1">
              <FieldMap token="customer_email" hint="contact email" />
              <FieldMap token="customer_name" hint="contact name" />
              <FieldMap token="customer_reply" hint="Message Body" />
              <FieldMap token="ticket_number" hint="the ticket number, when you have it" />
              <FieldMap token="subject" hint="email subject, so [#239] can be matched" />
            </ul>
            <p className="mt-1.5">SaaSSuite removes HTML and quoted history from Message Body.</p>
          </li>
        </ol>
      </section>

      <section className="space-y-1.5">
        <p className="font-medium text-foreground">Test</p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>Send a ticket response to your own email.</li>
          <li>Reply to that email.</li>
          <li>Confirm the reply shows on the ticket in SaaSSuite.</li>
        </ol>
      </section>
    </div>
  );
}
