DELETE FROM public.saas_suite_users WHERE lower(email) = 'bookmrdongo@gmail.com';

INSERT INTO public.account_admins (owner_email, admin_email, status, accepted_at)
VALUES ('io@bncinter.io', 'bookmrdongo@gmail.com', 'accepted', now())
ON CONFLICT DO NOTHING;