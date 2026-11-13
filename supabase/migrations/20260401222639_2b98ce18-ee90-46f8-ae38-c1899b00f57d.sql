-- Fix existing affiliates: sync is_affiliate and affiliate_slug to saas_suite_users
UPDATE saas_suite_users SET is_affiliate = true, affiliate_slug = 'andrew' WHERE lower(email) = 'andrew@dna-media.net';
UPDATE saas_suite_users SET is_affiliate = true, affiliate_slug = 'angela' WHERE lower(email) = 'angiestp10@gmail.com';

-- Also update the affiliates table to mark them as APPROVED
UPDATE affiliates SET status = 'APPROVED' WHERE lower(email) IN ('andrew@dna-media.net', 'angiestp10@gmail.com');