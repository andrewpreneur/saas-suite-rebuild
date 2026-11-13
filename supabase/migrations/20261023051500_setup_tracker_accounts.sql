-- AI Studio setup tracker.
-- Admin-only list of agency accounts that still need the GoHighLevel workflow
-- "Remove Menu Links From Purchase + Assign Menu Link" (AI Studio order ->
-- apply-menu-preset + assign-menu-link).
--
-- Additive only. This migration does not alter saas_suite_users, plans,
-- permissions, billing, or any other existing table.
--
-- saas_suite_user_id is bigint, not uuid, because public.saas_suite_users.id
-- is bigint. It is a soft link with no foreign key, filled when contact_email
-- matches a user row.

CREATE TABLE public.setup_tracker_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  agency_name text,
  contact_name text,
  contact_email text,
  source text NOT NULL DEFAULT 'other',
  ghl_agency_id text,
  ghl_location_id text,
  setup_status text NOT NULL DEFAULT 'not_started',
  status_detail text,
  last_contact_at timestamptz,
  last_contact_note text,
  evidence text,
  saas_suite_user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setup_tracker_accounts_source_chk CHECK (
    source IN ('ghl_affiliate', 'slack', 'dm', 'email', 'text', 'existing_customer', 'other')
  ),
  CONSTRAINT setup_tracker_accounts_status_chk CHECK (
    setup_status IN ('not_started', 'in_progress', 'done')
  )
);

COMMENT ON TABLE public.setup_tracker_accounts IS
  'Platform-admin tracker for AI Studio menu-link removal setup. Not customer-visible.';

COMMENT ON COLUMN public.setup_tracker_accounts.saas_suite_user_id IS
  'Soft link to public.saas_suite_users.id (bigint). No foreign key. Matched by email.';

COMMENT ON COLUMN public.setup_tracker_accounts.ghl_agency_id IS
  'GoHighLevel company id, when known.';

COMMENT ON COLUMN public.setup_tracker_accounts.ghl_location_id IS
  'GoHighLevel sub-account location id checked for the menu-link workflow.';

CREATE INDEX setup_tracker_accounts_status_idx
  ON public.setup_tracker_accounts (setup_status);

CREATE INDEX setup_tracker_accounts_source_idx
  ON public.setup_tracker_accounts (source);

CREATE INDEX setup_tracker_accounts_last_contact_idx
  ON public.setup_tracker_accounts (last_contact_at DESC NULLS LAST);

CREATE INDEX setup_tracker_accounts_email_idx
  ON public.setup_tracker_accounts (lower(contact_email));

-- Natural key for the idempotent seed. Blank and null emails share one key
-- so two unnamed contacts cannot collide, and a renamed audit row with the
-- same email is a different key (the seed deletes that leftover first).
CREATE UNIQUE INDEX setup_tracker_accounts_natural_key
  ON public.setup_tracker_accounts (
    lower(btrim(account_name)),
    lower(btrim(coalesce(contact_email, '')))
  );

CREATE OR REPLACE FUNCTION public.setup_tracker_accounts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS setup_tracker_accounts_set_updated_at ON public.setup_tracker_accounts;
CREATE TRIGGER setup_tracker_accounts_set_updated_at
  BEFORE UPDATE ON public.setup_tracker_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_tracker_accounts_set_updated_at();

REVOKE ALL ON FUNCTION public.setup_tracker_accounts_set_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.setup_tracker_accounts ENABLE ROW LEVEL SECURITY;

-- Same check the admin portal uses: public.is_platform_admin()
-- (current auth email is the platform admin). No anon or public policy.
CREATE POLICY "Platform admins read setup tracker"
  ON public.setup_tracker_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins insert setup tracker"
  ON public.setup_tracker_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins update setup tracker"
  ON public.setup_tracker_accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins delete setup tracker"
  ON public.setup_tracker_accounts
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON TABLE public.setup_tracker_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.setup_tracker_accounts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.setup_tracker_accounts TO authenticated;
GRANT ALL ON TABLE public.setup_tracker_accounts TO service_role;
