-- One subscription_canceled claim per Stripe subscription, cancel instant, and kind.
-- provider_message_id is "<subscription id>:<period end or cancel_at ISO>:<kind>".
-- Not applied from the agent. Do not run this against production from CI.
--
-- Read-only duplicate check. Run this by hand before applying the delete.
-- It does not change rows:
-- duplicate-check:
-- SELECT provider_message_id,
--        count(*) AS copies,
--        min(created_at) AS earliest,
--        max(created_at) AS latest
-- FROM public.customer_message_events
-- WHERE template_key = 'subscription_canceled'
--   AND provider_message_id IS NOT NULL
-- GROUP BY provider_message_id
-- HAVING count(*) > 1
-- ORDER BY copies DESC, provider_message_id;

-- Keep the earliest row for each key. Same predicate as the unique index:
-- template subscription_canceled and a non-null provider_message_id.
-- Other templates that reuse a provider_message_id are left in place.
DELETE FROM public.customer_message_events AS extra
USING (
  SELECT ranked.id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY provider_message_id
        ORDER BY created_at ASC, id ASC
      ) AS n
    FROM public.customer_message_events
    WHERE template_key = 'subscription_canceled'
      AND provider_message_id IS NOT NULL
  ) AS ranked
  WHERE ranked.n > 1
) AS doomed
WHERE extra.id = doomed.id;

-- Atomic claim. Correct with or without the optional unique index.
-- The advisory lock serializes deliveries of one trimmed key, the same value
-- stored on the row. A null or empty id raises so it cannot take a no-op lock.
-- INSERT ... WHERE NOT EXISTS then writes the row. An empty result means
-- another delivery already owns the key, and the caller must not post
-- GoHighLevel. unique_violation is the race when the optional index exists
-- and two sessions both passed the existence check. That also returns no row.
CREATE OR REPLACE FUNCTION public.claim_subscription_canceled_message(
  p_user_email text,
  p_provider_message_id text,
  p_status text,
  p_source text,
  p_detail text,
  p_metadata jsonb
)
RETURNS SETOF public.customer_message_events
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  claim_key text := NULLIF(btrim(COALESCE(p_provider_message_id, '')), '');
BEGIN
  IF claim_key IS NULL THEN
    RAISE EXCEPTION 'subscription_canceled claim requires a provider message id';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('subscription_canceled:' || claim_key)::bigint);
  RETURN QUERY
  INSERT INTO public.customer_message_events (
    user_email,
    channel,
    template_key,
    provider,
    provider_message_id,
    status,
    source,
    detail,
    metadata
  )
  SELECT
    NULLIF(btrim(COALESCE(p_user_email, '')), ''),
    'webhook',
    'subscription_canceled',
    'ghl',
    claim_key,
    p_status,
    COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), 'stripe-subscription-webhook'),
    p_detail,
    COALESCE(p_metadata, '{}'::jsonb)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.customer_message_events AS existing
    WHERE existing.template_key = 'subscription_canceled'
      AND existing.provider_message_id = claim_key
  )
  RETURNING *;
EXCEPTION
  WHEN unique_violation THEN
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_subscription_canceled_message(text, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_subscription_canceled_message(text, text, text, text, text, jsonb)
  TO service_role;
