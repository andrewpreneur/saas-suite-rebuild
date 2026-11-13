-- Remove luxescale standalone profile so login routes to livingvogue
DELETE FROM public.saas_suite_users WHERE id = 671 AND email = 'mark@theluxescale.com';

-- Link luxescale email as admin on livingvogue account
INSERT INTO public.account_admins (owner_email, admin_email, admin_name, status, accepted_at)
VALUES ('mark@livingvogue.com', 'mark@theluxescale.com', 'Mark Coppens', 'accepted', now())
ON CONFLICT DO NOTHING;