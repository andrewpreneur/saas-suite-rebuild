-- Merge duplicate Melissa account: keep lowercase (champagne-room), delete the capital M duplicate
DELETE FROM public.saas_suite_users WHERE id = 402 AND email = 'Melissa@melissaricker.com';

-- Accept Rita's pending admin invitation for the champagne-room account
UPDATE public.account_admins
SET status = 'accepted', accepted_at = now(), updated_at = now()
WHERE lower(admin_email) = 'rita@pjsboss.com'
  AND lower(owner_email) = 'melissa@melissaricker.com';