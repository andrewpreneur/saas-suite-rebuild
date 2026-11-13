INSERT INTO saas_suite_users (email, full_name, plan, approval, is_affiliate, initial_questions_completed, affiliate_slug)
VALUES ('andy@sololink.io', 'Andy Griffith', 'STARTER', 'YES', true, true, 'andy-griffith')
ON CONFLICT DO NOTHING;

INSERT INTO affiliates (email, full_name, network_size, status, affiliate_slug)
VALUES ('andy@sololink.io', 'Andy Griffith', 'Unknown', 'APPROVED', 'andy-griffith')
ON CONFLICT DO NOTHING;