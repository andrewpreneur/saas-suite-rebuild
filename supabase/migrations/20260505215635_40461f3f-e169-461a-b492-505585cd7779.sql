-- 1) Add info@wickai.app as accepted admin on williamarmswickiii@gmail.com's account
INSERT INTO public.account_admins (owner_email, admin_email, admin_name, status, accepted_at)
VALUES ('williamarmswickiii@gmail.com', 'info@wickai.app', 'William (wickai)', 'accepted', now())
ON CONFLICT DO NOTHING;

-- 2) Create BASIC account for Greg Tucker (bgtcreative@gmail.com) with agency_id 'bgtcreative'
INSERT INTO public.saas_suite_users (
  email, full_name, plan, approval, agency_id, agency_id_basic,
  original_agency_id, original_agency_id_basic,
  onboarding_completed, initial_questions_completed, source
)
VALUES (
  'bgtcreative@gmail.com', 'Greg Tucker', 'BASIC', 'YES', 'bgtcreative', 'bgtcreative',
  'bgtcreative', 'bgtcreative',
  false, false, 'Manual (Admin)'
)
ON CONFLICT DO NOTHING;