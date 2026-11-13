UPDATE public.user_progress SET agency_id='tony' WHERE agency_id='gable-grassroots-consulting';
UPDATE public.chat_threads SET agency_id='tony' WHERE agency_id='gable-grassroots-consulting';
INSERT INTO public.account_admins (owner_email, admin_email, admin_name, status, accepted_at)
SELECT 'tony@gablegrassroots.com','tony@checkmyinsurancerate.com','Anthony Gable','accepted',now()
WHERE NOT EXISTS (SELECT 1 FROM public.account_admins WHERE lower(owner_email)='tony@gablegrassroots.com' AND lower(admin_email)='tony@checkmyinsurancerate.com');