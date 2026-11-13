import { supabase } from "@/integrations/supabase/client";
import { appendTrackingParams } from "@/utils/preserveParams";

/**
 * Single source of truth for where a buyer lands after a successful Stripe
 * checkout.
 *
 * - Already signed in as the buyer  -> /app?confirmed=true (straight into the product)
 * - Not signed in (or different account) -> /signup?email=... so they can claim the account
 *
 * Never send buyers to a dead-end page: the moment money changes hands they
 * must either be inside the app or one step away from it.
 */
export const buildPostPurchasePath = (
  _sessionEmail: string | null,
  purchasedEmail: string | null,
  stripeSessionId?: string | null,
) => {
  // Every purchase (signed in or new buyer) lands on the same confirmation
  // URL. /app?confirmed=true shows Payment Successful, then continues into the
  // app or to /signup?paid=true to create a password.
  const params = new URLSearchParams({ confirmed: "true" });
  if (purchasedEmail) params.set("email", purchasedEmail);
  // Carry the Stripe session id so the confirmation-page Purchase uses the
  // same event_id (order_<session id>) as the server copy and Meta dedupes.
  if (stripeSessionId) params.set("session_id", stripeSessionId);
  return `/app?${params.toString()}`;
};

export const redirectAfterPurchase = async (
  purchasedEmail?: string | null,
  stripeSessionId?: string | null,
) => {
  const normalizedPurchasedEmail = purchasedEmail?.trim().toLowerCase() || null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;

  window.location.replace(
    appendTrackingParams(
      buildPostPurchasePath(sessionEmail, normalizedPurchasedEmail, stripeSessionId ?? null),
    ),
  );
};
