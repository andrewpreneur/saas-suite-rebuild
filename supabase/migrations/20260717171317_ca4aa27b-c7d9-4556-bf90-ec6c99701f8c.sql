
ALTER TABLE public.slack_link_tokens ADD COLUMN IF NOT EXISTS agency_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.slack_workspace_links ADD COLUMN IF NOT EXISTS agency_ids text[] NOT NULL DEFAULT '{}';

-- Backfill existing rows: expand to all agency ids on the owner's saas_suite_users row.
UPDATE public.slack_workspace_links l
SET agency_ids = sub.ids
FROM (
  SELECT lower(u.email) AS email,
    ARRAY(SELECT DISTINCT regexp_replace(x, 'NO$', '', 'i')
          FROM unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) x
          WHERE x IS NOT NULL AND length(x) > 0) AS ids
  FROM public.saas_suite_users u
) sub
WHERE lower(l.linked_by_email) = sub.email
  AND (l.agency_ids IS NULL OR array_length(l.agency_ids, 1) IS NULL OR array_length(l.agency_ids,1) = 0);

UPDATE public.slack_link_tokens t
SET agency_ids = sub.ids
FROM (
  SELECT lower(u.email) AS email,
    ARRAY(SELECT DISTINCT regexp_replace(x, 'NO$', '', 'i')
          FROM unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) x
          WHERE x IS NOT NULL AND length(x) > 0) AS ids
  FROM public.saas_suite_users u
) sub
WHERE lower(t.email) = sub.email
  AND (t.agency_ids IS NULL OR array_length(t.agency_ids, 1) IS NULL OR array_length(t.agency_ids,1) = 0);
