-- Agency-defined ticket types, keyed by owner email so one list covers every
-- tier id (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite).
-- Hidden defaults and custom labels are read through get_agency_ticket_categories.

CREATE OR REPLACE FUNCTION public.ticket_category_defaults()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'General Inquiry',
    'Technical Issue',
    'Billing Question',
    'Account Access',
    'Website Edits',
    'Feature Request',
    'Other'
  ]::text[];
$$;

REVOKE ALL ON FUNCTION public.ticket_category_defaults() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ticket_category_defaults() TO anon, authenticated, service_role;

CREATE TABLE public.agency_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_ticket_categories_label_len CHECK (char_length(label) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX agency_ticket_categories_owner_label_idx
  ON public.agency_ticket_categories (lower(owner_email), lower(label));

COMMENT ON TABLE public.agency_ticket_categories IS
  'Per-owner ticket types. One owner email covers all of that agency''s tier agency ids.';

CREATE OR REPLACE FUNCTION public.guard_agency_ticket_categories()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.owner_email := lower(btrim(coalesce(NEW.owner_email, '')));
  NEW.label := btrim(coalesce(NEW.label, ''));
  IF NEW.owner_email = '' THEN
    RAISE EXCEPTION 'owner_email is required';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_agency_ticket_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_agency_ticket_categories() TO authenticated, service_role;

CREATE TRIGGER trg_guard_agency_ticket_categories
  BEFORE INSERT OR UPDATE ON public.agency_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_agency_ticket_categories();

ALTER TABLE public.agency_ticket_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_ticket_categories TO authenticated;
GRANT ALL ON public.agency_ticket_categories TO service_role;

CREATE POLICY "Agency ticket categories are readable by the account team"
  ON public.agency_ticket_categories
  FOR SELECT
  TO authenticated
  USING (public.can_access_owner_email(owner_email) OR public.is_platform_admin());

CREATE POLICY "Agency ticket categories are insertable by the account team"
  ON public.agency_ticket_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_owner_email(owner_email) OR public.is_platform_admin());

CREATE POLICY "Agency ticket categories are updatable by the account team"
  ON public.agency_ticket_categories
  FOR UPDATE
  TO authenticated
  USING (public.can_access_owner_email(owner_email) OR public.is_platform_admin())
  WITH CHECK (public.can_access_owner_email(owner_email) OR public.is_platform_admin());

CREATE POLICY "Agency ticket categories are deletable by the account team"
  ON public.agency_ticket_categories
  FOR DELETE
  TO authenticated
  USING (public.can_access_owner_email(owner_email) OR public.is_platform_admin());

-- Resolves the owner the same way as agency chat settings: strip a trailing
-- "NO", then match agency_id / agency_id_basic / agency_id_advanced / agency_id_elite.
-- Unknown agencies receive the shared default list.
CREATE OR REPLACE FUNCTION public.get_agency_ticket_categories(p_agency_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_aid text := regexp_replace(coalesce(p_agency_id, ''), 'NO$', '', 'i');
BEGIN
  SELECT lower(u.email) INTO v_owner
  FROM public.saas_suite_users u
  WHERE v_aid <> ''
    AND v_aid IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  LIMIT 1;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'label', s.label,
        'is_default', s.is_default,
        'sort_order', s.sort_order
      )
      ORDER BY s.sort_order, lower(s.label)
    )
    FROM (
      SELECT d.label,
             COALESCE(r.sort_order, (d.ord - 1)::int) AS sort_order,
             true AS is_default
      FROM unnest(public.ticket_category_defaults()) WITH ORDINALITY AS d(label, ord)
      LEFT JOIN public.agency_ticket_categories r
        ON v_owner IS NOT NULL
       AND lower(r.owner_email) = v_owner
       AND r.is_default
       AND lower(r.label) = lower(d.label)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.agency_ticket_categories h
        WHERE v_owner IS NOT NULL
          AND lower(h.owner_email) = v_owner
          AND h.is_default
          AND h.is_hidden
          AND lower(h.label) = lower(d.label)
      )
      UNION ALL
      SELECT c.label, c.sort_order, false
      FROM public.agency_ticket_categories c
      WHERE v_owner IS NOT NULL
        AND lower(c.owner_email) = v_owner
        AND NOT c.is_default
        AND NOT c.is_hidden
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(public.ticket_category_defaults()) AS def(label)
          WHERE lower(def.label) = lower(c.label)
        )
    ) s
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_agency_ticket_categories(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agency_ticket_categories(text) TO anon, authenticated, service_role;
