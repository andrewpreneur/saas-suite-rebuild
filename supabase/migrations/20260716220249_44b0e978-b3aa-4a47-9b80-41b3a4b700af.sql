-- Fix agency_id type on new tables to match the rest of the app (text slugs, not uuids)
ALTER TABLE public.agency_category_settings ALTER COLUMN agency_id TYPE text USING agency_id::text;
ALTER TABLE public.agency_module_name_overrides ALTER COLUMN agency_id TYPE text USING agency_id::text;

-- Retroactive backfill: for every agency + tier that has custom onboarding videos,
-- seed agency_category_settings so custom modules appear at their historical position
-- (interleaved with built-ins by module_order, ties broken by earliest lesson created_at),
-- with built-ins filling in the remaining slots in their declared order.
DO $$
DECLARE
  r_agency text;
  r_tier text;
  r_key text;
  r_module_order int;
  r_created timestamptz;
  next_sort int;
  builtin_ids text[] := ARRAY[
    'foundational-setup',
    'marketing-lead-generation',
    'sales-conversation',
    'website-content',
    'commerce',
    'ai-tools'
  ];
  builtin_id text;
  tier_val text;
BEGIN
  FOR r_agency, r_tier IN
    SELECT DISTINCT v.agency_id, t.tier
    FROM public.custom_onboarding_videos v
    CROSS JOIN LATERAL unnest(COALESCE(v.tiers, ARRAY['basic','advanced','elite']::text[])) AS t(tier)
    WHERE v.module_type = 'custom'
      AND v.custom_module_title IS NOT NULL
      AND v.custom_module_title <> ''
  LOOP
    next_sort := 0;
    -- Customs first, ordered by their old module_order then earliest created_at
    FOR r_key, r_module_order, r_created IN
      SELECT 'custom::' || v.custom_module_title AS key,
             MIN(COALESCE(v.module_order, 1)) AS mo,
             MIN(v.created_at) AS ca
      FROM public.custom_onboarding_videos v
      WHERE v.agency_id = r_agency
        AND v.module_type = 'custom'
        AND v.custom_module_title IS NOT NULL
        AND v.custom_module_title <> ''
        AND r_tier = ANY(COALESCE(v.tiers, ARRAY['basic','advanced','elite']::text[]))
      GROUP BY v.custom_module_title
      ORDER BY mo ASC, ca ASC
    LOOP
      INSERT INTO public.agency_category_settings (agency_id, tier, category_key, sort_order)
      VALUES (r_agency, r_tier, r_key, next_sort)
      ON CONFLICT (agency_id, tier, category_key) DO NOTHING;
      next_sort := next_sort + 1;
    END LOOP;
    -- Then built-ins in their declared order
    FOREACH builtin_id IN ARRAY builtin_ids LOOP
      INSERT INTO public.agency_category_settings (agency_id, tier, category_key, sort_order)
      VALUES (r_agency, r_tier, builtin_id, next_sort)
      ON CONFLICT (agency_id, tier, category_key) DO NOTHING;
      next_sort := next_sort + 1;
    END LOOP;
  END LOOP;
END $$;