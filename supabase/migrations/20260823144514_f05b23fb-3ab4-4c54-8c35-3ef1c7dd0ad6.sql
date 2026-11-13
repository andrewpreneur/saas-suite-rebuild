UPDATE public.support_tickets
SET status = 'closed', updated_at = now()
WHERE status = 'open'
  AND responded_at IS NULL
  AND (admin_response IS NULL OR btrim(admin_response) = '')
  AND (created_at < now() - interval '14 days'
       OR agency_id IN ('a743d34996b944f4bc91beb15ab6c11b','test-rpc','test-rls'));