import { logCustomerMessage } from "./journey-log.ts";
import { kitPurchasedSendLog, type KitPurchasedLogSource } from "./kit-lynkific.ts";

/** One customer_message_events row for a kit_purchased GoHighLevel attempt. Never throws. */
export async function logKitPurchasedSend(input: {
  email: string;
  checkoutSessionId: string;
  source: KitPurchasedLogSource;
  outcome: "sent" | "failed" | "duplicate" | "overlap" | "skipped" | "missing_url";
  reason?: string | null;
  httpStatus?: number | null;
  responseId?: string | null;
}): Promise<void> {
  await logCustomerMessage(kitPurchasedSendLog(input));
}
