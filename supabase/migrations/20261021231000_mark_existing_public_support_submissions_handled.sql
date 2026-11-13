-- Mark public support submissions that were already handled before tickets
-- existed. This does not insert support_tickets and does not send alerts.
--
-- Michael (trafficqc@gmail.com) and Dave (dmeholovitch@gmail.com) were emailed
-- by Andrew. Sara (info@healthiihub.com) is waiting on Andrew's approval.
-- andrew@dna-media.net was a QA test.
--
-- Apply on purpose, after 20261021230000_public_support_submission_tickets.sql.
-- Safe to re-run: a row is updated only while it is still status 'new' and has
-- no ticket. The insert trigger does not run for these updates.

ALTER TABLE public.public_support_submissions
  ADD COLUMN IF NOT EXISTS ticket_id uuid,
  ADD COLUMN IF NOT EXISTS note text;

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

UPDATE public.public_support_submissions
SET
  status = 'handled',
  note = 'Handled outside the ticket system. Andrew emailed this person directly, so this submission was not turned into a ticket and no new-ticket alert was sent.'
WHERE lower(email) IN ('trafficqc@gmail.com', 'dmeholovitch@gmail.com')
  AND status = 'new'
  AND ticket_id IS NULL;

UPDATE public.public_support_submissions
SET
  status = 'handled',
  note = 'Handled outside the ticket system. The reply to Sara is pending Andrew''s approval, so this submission was not turned into a ticket and no new-ticket alert was sent.'
WHERE lower(email) = 'info@healthiihub.com'
  AND status = 'new'
  AND ticket_id IS NULL;

UPDATE public.public_support_submissions
SET
  status = 'closed',
  note = 'Closed without a ticket. This submission was a QA test from andrew@dna-media.net, so no ticket was opened and no new-ticket alert was sent.'
WHERE lower(email) = 'andrew@dna-media.net'
  AND status = 'new'
  AND ticket_id IS NULL;
