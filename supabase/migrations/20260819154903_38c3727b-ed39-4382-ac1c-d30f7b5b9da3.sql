DELETE FROM public.menu_link_rules
WHERE sub_account_id IS NOT NULL
  AND lower(btrim(sub_account_id)) IN ('null','undefined','');

ALTER TABLE public.menu_link_rules
  ADD CONSTRAINT menu_link_rules_sub_account_id_not_placeholder
  CHECK (sub_account_id IS NULL OR lower(btrim(sub_account_id)) NOT IN ('null','undefined',''));