UPDATE menu_link_rules m
SET preset_name = 'Vibe', updated_at = now()
FROM (SELECT hidden_links FROM menu_link_rules WHERE agency_id='saassuite' AND preset_name='Vibe' LIMIT 1) v
WHERE m.agency_id = 'saassuite'
  AND m.sub_account_id IS NOT NULL
  AND m.preset_name IS NULL
  AND m.hidden_links::jsonb = v.hidden_links::jsonb;