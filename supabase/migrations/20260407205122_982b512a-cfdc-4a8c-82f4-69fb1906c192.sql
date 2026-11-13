DELETE FROM affiliates WHERE lower(email) = 'andy@sololink.io';
DELETE FROM saas_suite_users WHERE lower(email) = 'andy@sololink.io';
UPDATE saas_suite_users SET is_affiliate = true, affiliate_slug = 'andy-griffith' WHERE lower(email) = 'contact@sololink.io';
INSERT INTO affiliates (email, full_name, network_size, status, affiliate_slug)
VALUES ('contact@sololink.io', 'Andy Griffith', 'Unknown', 'APPROVED', 'andy-griffith');