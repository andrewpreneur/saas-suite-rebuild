-- Open a support ticket for each new public support form submission.
-- Existing rows are left alone: this is an insert trigger, not a backfill.
-- The ticket insert fires the existing new-ticket alert triggers
-- (trg_support_ticket_assignee_notify and trg_slack_ticket_created).

ALTER TABLE public.public_support_submissions
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS source text;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'public_support_submissions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.public_support_submissions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.public_support_submissions
  ADD CONSTRAINT public_support_submissions_status_check
  CHECK (status IN ('new', 'in_progress', 'resolved', 'spam', 'ticketed', 'handled', 'closed'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_support_submissions_ticket_id_fkey'
  ) THEN
    ALTER TABLE public.public_support_submissions
      ADD CONSTRAINT public_support_submissions_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS public_support_submissions_ticket_id_idx
  ON public.public_support_submissions (ticket_id);

-- customer_name and customer_email store the guest. Tickets are not tied to an
-- account, and the existing reply email is addressed to customer_email.
CREATE OR REPLACE FUNCTION public.trg_public_support_submission_to_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_request text;
  v_source text;
BEGIN
  IF NEW.ticket_id IS NOT NULL OR NEW.status IS DISTINCT FROM 'new' THEN
    RETURN NEW;
  END IF;

  v_source := COALESCE(NULLIF(btrim(NEW.source), ''), 'public_support_page');
  v_request := btrim(NEW.question);
  IF NEW.agency_name IS NOT NULL AND btrim(NEW.agency_name) <> '' THEN
    v_request := v_request || E'\n\nAgency: ' || btrim(NEW.agency_name);
  END IF;

  INSERT INTO public.support_tickets (
    agency_id,
    customer_name,
    customer_email,
    issue_category,
    request_text,
    status,
    source
  ) VALUES (
    'public-support',
    btrim(NEW.name),
    lower(btrim(NEW.email)),
    btrim(NEW.topic),
    v_request,
    'open',
    v_source
  )
  RETURNING id INTO v_ticket_id;

  UPDATE public.public_support_submissions
  SET ticket_id = v_ticket_id,
      status = 'ticketed'
  WHERE id = NEW.id
    AND ticket_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_support_submission_to_ticket ON public.public_support_submissions;
CREATE TRIGGER trg_public_support_submission_to_ticket
AFTER INSERT ON public.public_support_submissions
FOR EACH ROW
WHEN (NEW.ticket_id IS NULL AND NEW.status = 'new')
EXECUTE FUNCTION public.trg_public_support_submission_to_ticket();

REVOKE ALL ON FUNCTION public.trg_public_support_submission_to_ticket() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.trg_public_support_submission_to_ticket() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.trg_public_support_submission_to_ticket() FROM authenticated;
  END IF;
END $$;

COMMENT ON COLUMN public.public_support_submissions.ticket_id IS
  'Support ticket opened from this submission. Set by the insert trigger; null when the submission was handled without a ticket.';
COMMENT ON COLUMN public.public_support_submissions.note IS
  'Optional staff note, including why a pre-trigger submission was closed without a ticket.';
COMMENT ON COLUMN public.support_tickets.source IS
  'Where the ticket came from. Public form tickets use public_support_page.';
