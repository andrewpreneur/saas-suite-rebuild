
DELETE FROM public.saas_suite_users
WHERE lower(email) IN (
  'estsetsetsetswe@gmail.com',
  'testesetsetsetwtg@gmail.com',
  'asdfasdfasdf@asdf.com',
  'asdf@gmail.com',
  'hfds@jhgf.com',
  'rwararwarawr@gmail.com',
  'testtest@gmail.com'
);

DELETE FROM public.saas_suite_users
WHERE email IS NULL;
