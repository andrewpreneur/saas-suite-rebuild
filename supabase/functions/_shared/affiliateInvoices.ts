import {
  collectedInvoice,
  failedInvoice,
  mapPool,
  pickSubscription,
  type CollectedPayment,
  type FailedPayment,
  type SubscriptionSnapshot,
  unixToIso,
  displayPlan,
  subscriptionConvertPrice,
} from "./affiliateReferrals.ts";

type InvoiceList = { data: Array<Record<string, unknown>> };
type CustomerList = { data: Array<{ id: string }> };
type SubscriptionList = { data: Array<Record<string, unknown>> };
type InvoiceStatus = "paid" | "open" | "uncollectible";

export type AffiliateStripe = {
  customers: {
    list: (params: { email: string; limit: number }) => Promise<CustomerList>;
    retrieve: (id: string) => Promise<{ id?: string; deleted?: boolean }>;
  };
  invoices: {
    list: (params: { customer: string; status: InvoiceStatus; limit: number; expand?: string[] }) => Promise<InvoiceList>;
  };
  subscriptions: {
    list: (params: { customer: string; status: "all"; limit: number; expand?: string[] }) => Promise<SubscriptionList>;
  };
};

export type EmailBilling = {
  payments: CollectedPayment[];
  failedPayments: FailedPayment[];
  subscription: SubscriptionSnapshot | null;
};

function subscriptionFromStripe(sub: Record<string, unknown>): SubscriptionSnapshot {
  const items = sub.items as { data?: Array<Record<string, unknown>> } | undefined;
  const item = items?.data?.[0];
  const price = item?.price as { nickname?: string; lookup_key?: string; product?: { name?: string } | string } | undefined;
  const product = price?.product && typeof price.product === "object" ? price.product.name : "";
  const raw = price?.nickname || price?.lookup_key || product || "";
  return {
    status: typeof sub.status === "string" ? sub.status : null,
    plan: displayPlan(raw) || raw || null,
    trialEnd: unixToIso(sub.trial_end),
    periodEnd: unixToIso(sub.current_period_end) || unixToIso(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    canceledAt: unixToIso(sub.canceled_at),
    cancelAt: unixToIso(sub.cancel_at),
    created: typeof sub.created === "number" ? sub.created : null,
    convertPrice: subscriptionConvertPrice(sub),
  };
}

const SUBSCRIPTION_EXPAND = [
  "data.discounts",
  "data.discounts.coupon",
  "data.items.data.discounts",
  "data.items.data.discounts.coupon",
];

async function listSubscriptions(stripe: AffiliateStripe, customerId: string): Promise<Array<Record<string, unknown>>> {
  try {
    const expanded = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
      expand: SUBSCRIPTION_EXPAND,
    });
    return expanded.data || [];
  } catch {
    try {
      const plain = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
      return plain.data || [];
    } catch {
      return [];
    }
  }
}

async function listInvoices(
  stripe: AffiliateStripe,
  customerId: string,
  status: InvoiceStatus,
  expandCharge: boolean,
): Promise<Array<Record<string, unknown>>> {
  try {
    const expanded = await stripe.invoices.list({
      customer: customerId,
      status,
      limit: 100,
      ...(expandCharge ? { expand: ["data.charge"] } : {}),
    });
    return expanded.data || [];
  } catch {
    if (!expandCharge) return [];
    const plain = await stripe.invoices.list({ customer: customerId, status, limit: 100 });
    return plain.data || [];
  }
}

const EMPTY_BILLING: EmailBilling = { payments: [], failedPayments: [], subscription: null };

/**
 * Paid invoices, failed collection attempts, and the live subscription.
 * Customers are matched by every supplied email and by Stripe customer id.
 */
export async function billingForAccount(
  stripe: AffiliateStripe,
  input: {
    emails: string[];
    customerIds?: string[];
    ratePercent: number;
    subscriptions?: boolean;
    keepFullyRefunded?: boolean;
    includeFailed?: boolean;
  },
): Promise<EmailBilling> {
  const emails = [...new Set(input.emails.map((email) => email.trim().toLowerCase()).filter((email) => email.includes("@")))];
  const pinned = [...new Set((input.customerIds || []).map((id) => id.trim()).filter((id) => id.startsWith("cus_")))];
  if (!emails.length && !pinned.length) return EMPTY_BILLING;
  const withSubscriptions = input.subscriptions !== false;
  const customerIds = new Set<string>(pinned);
  for (const email of emails) {
    const listed = await stripe.customers.list({ email, limit: 10 });
    for (const customer of listed.data || []) {
      if (customer?.id) customerIds.add(customer.id);
    }
  }
  const payments: CollectedPayment[] = [];
  const failedPayments: FailedPayment[] = [];
  const subscriptions: SubscriptionSnapshot[] = [];
  const seenPaid = new Set<string>();
  const seenFailed = new Set<string>();
  for (const customerId of customerIds) {
    const [paid, failed, subs] = await Promise.all([
      listInvoices(stripe, customerId, "paid", true),
      input.includeFailed
        ? Promise.all([
          listInvoices(stripe, customerId, "open", false),
          listInvoices(stripe, customerId, "uncollectible", false),
        ]).then((groups) => groups.flat())
        : Promise.resolve([]),
      withSubscriptions
        ? listSubscriptions(stripe, customerId)
        : Promise.resolve([]),
    ]);
    for (const invoice of paid) {
      const payment = collectedInvoice(invoice, input.ratePercent, { keepFullyRefunded: input.keepFullyRefunded === true });
      if (!payment || seenPaid.has(payment.id)) continue;
      seenPaid.add(payment.id);
      payments.push(payment);
    }
    for (const invoice of failed) {
      const missed = failedInvoice(invoice);
      if (!missed || seenFailed.has(missed.id)) continue;
      seenFailed.add(missed.id);
      failedPayments.push(missed);
    }
    for (const sub of subs) subscriptions.push(subscriptionFromStripe(sub));
  }
  payments.sort((a, b) => a.paidAt < b.paidAt ? 1 : -1);
  failedPayments.sort((a, b) => a.failedAt < b.failedAt ? 1 : -1);
  return { payments, failedPayments, subscription: pickSubscription(subscriptions) };
}

export async function billingForEmail(
  stripe: AffiliateStripe,
  email: string,
  ratePercent: number,
  options: { subscriptions?: boolean; keepFullyRefunded?: boolean; includeFailed?: boolean } = {},
): Promise<EmailBilling> {
  return billingForAccount(stripe, { emails: [email], ratePercent, ...options });
}

export async function billingForAccounts(
  stripe: AffiliateStripe,
  accounts: Array<{ key: string; emails: string[]; customerIds: string[] }>,
  rateFor: (key: string) => number,
  options: { subscriptions?: boolean; includeFailed?: boolean } = {},
): Promise<{ billing: Map<string, EmailBilling>; failed: number }> {
  let failed = 0;
  const pairs = await mapPool(accounts, 4, async (account) => {
    try {
      return [account.key, await billingForAccount(stripe, {
        emails: account.emails,
        customerIds: account.customerIds,
        ratePercent: rateFor(account.key),
        subscriptions: options.subscriptions,
        includeFailed: options.includeFailed,
      })] as const;
    } catch (error) {
      failed += 1;
      console.error("affiliate invoice lookup failed", error instanceof Error ? error.message : "unknown");
      return [account.key, { payments: [], failedPayments: [], subscription: null }] as const;
    }
  });
  return { billing: new Map(pairs), failed };
}
