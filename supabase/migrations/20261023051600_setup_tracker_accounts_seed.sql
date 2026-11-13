-- Seed the AI Studio setup tracker from the GHL Dev account export.
-- 115 accounts. This file is the source of truth and replaces the earlier
-- audit / kit-roster seed in this same migration.
--
-- Counts in the export: done 6, in_progress 5, not_started 104.
-- status_detail, last_contact_note, and evidence are stored exactly as given.
--
-- Idempotent. The natural key is
-- (lower(btrim(account_name)), lower(btrim(coalesce(contact_email, '')))).
-- Re-running updates those rows in place. A row already seeded from the audit
-- is removed when its account name or contact email matches this file but its
-- natural key does not (renamed accounts), and the fixed ids from that audit
-- seed are removed when they are not this file's key. A row that matches
-- neither name, email, nor an old audit id is left alone.
--
-- saas_suite_user_id is matched here by contact_email against
-- public.saas_suite_users. No user id is hardcoded. Does not modify
-- saas_suite_users or any other existing table.
--
-- Run this file as one script. The incoming rows live in a temporary table
-- for the dedupe, the upsert, and the email match.

CREATE UNIQUE INDEX IF NOT EXISTS setup_tracker_accounts_natural_key
  ON public.setup_tracker_accounts (
    lower(btrim(account_name)),
    lower(btrim(coalesce(contact_email, '')))
  );

CREATE TEMP TABLE setup_tracker_seed_incoming (
  account_name text NOT NULL,
  agency_name text,
  contact_name text,
  contact_email text,
  source text NOT NULL,
  ghl_agency_id text,
  ghl_location_id text,
  setup_status text NOT NULL,
  status_detail text,
  last_contact_at timestamptz,
  last_contact_note text,
  evidence text
) ON COMMIT DROP;

INSERT INTO setup_tracker_seed_incoming (
  account_name,
  agency_name,
  contact_name,
  contact_email,
  source,
  ghl_agency_id,
  ghl_location_id,
  setup_status,
  status_detail,
  last_contact_at,
  last_contact_note,
  evidence
) VALUES
  ('Buzz Bull Marketing Systems (app: Growth Chain System)', 'Buzz Bull Marketing Systems (app: Growth Chain System)', 'Curtis Valdez', 'curtisv@buzzbullmarketing.com', 'existing_customer', 'jyuGrjbh5LBf4fiTNwds', 'rUwVGLBbWRfDAa03HfFu', 'done', 'published & tested; token/secret rotation pending | next: Rotate token/secret (workflow 6c6f3ae5 published).', '2026-10-21T07:46:00-05:00'::timestamptz, 'SMS from us "AI Studio sales system is all set up" (queued by line limits, expected ~1:05 PM)', 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-09-19, ghl_conn connected, menu events 4 (applied) last 2026-10-21 01:04Z, 3 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief) (workflow 6c6f3ae5)'),
  ('GTI Agents (app: GTI Studio)', 'GTI Agents (app: GTI Studio)', 'Sean Joseph', 'boybuystech@gmail.com', 'ghl_affiliate', 'aO9zitWjtEAtf9ygFdYO', 'o4eAm9YWElzB0M4ad4l6', 'in_progress', 'blocked: GHL agency locked for failed payment | next: Customer must fix GHL billing; draft workflow exists in "no compan" sub-account.', '2026-10-13T15:52:17-05:00'::timestamptz, 'Email from Sean: "I did the 297 plan..."', 'roster.csv(in progress) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-15, ghl_conn connected, 1 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief); menu-link-audit.md (draft in o4eAm9YWElzB0M4ad4l6) ; affiliate_signups_last30d.csv: portal signup 2026-10-13 18:24 CT, portal_status Cancelled, GHL contact mD14IuX82a2gYtGEBxl4'),
  ('HR Strategy (app: Super Intelligence Pros)', 'HR Strategy (app: Super Intelligence Pros)', 'Josh Gibbs', 'joshgibbs.biz@gmail.com', 'existing_customer', 'Uix23yuWdI4ohotZaB9w', NULL, 'done', 'done | next: None (done). SaaSSuite trial ends 2026-10-27.', '2026-10-13T20:31:35-05:00'::timestamptz, 'Last inbound email "I am all in" (later messages are ours per 10/21 sweep)', 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-14, ghl_conn connected, menu events 4 (applied) last 2026-10-21 20:15Z, 2 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief); Gmail team+hrstrategytest@ activation 10/21'),
  ('tenxup', 'tenxup', 'Craig Cameron', 'craig@botsguy.com', 'existing_customer', 'Xvb9cZ7lmYkdkSPpDDE9', NULL, 'in_progress', 'blocked: awaiting Andrew decision on existing live "Remove Menu Links Function" workflow (secret was rotated) | next: Andrew to decide: keep/replace customer''s existing live workflow.', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-04, ghl_conn connected, menu events 24 (applied,failed) last 2026-10-13 21:21Z, 9 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief)'),
  ('theBrewHQ (Brewed Harmony Digital)', 'theBrewHQ (Brewed Harmony Digital)', 'Cassandra Comeau', 'cassandra@brewedharmonydigital.com', 'existing_customer', 'Qex0uOPzttGsccWjD0Yq', NULL, 'in_progress', 'paused by Andrew: team@ lacks Add User permission | next: Paused by Andrew; needs team@ role with Add User.', '2026-10-21T20:35:49-05:00'::timestamptz, 'Slack: Adrienne status update on insurance builds (not menu-link)', 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-06-07, ghl_conn connected ; GHL Dev status Oct 21 evening (per Andrew brief)'),
  ('Tru Path Marketing (GHL: Tru Path LLC)', 'Tru Path Marketing (GHL: Tru Path LLC)', 'Amir Ness', 'amir@trupathmarketing.com', 'existing_customer', 'h61sNbRJX4vUB9O5x3KC', 'Wycuz5ZiloUHQWgJXIpd', 'done', 'published & tested; token/secret rotation pending | next: Rotate token/secret (workflow efbc55f5 published).', '2026-10-19T11:46:39-05:00'::timestamptz, 'Slack DM: Andrew says free Slack is fine (after onboarding call 10/19)', 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-04, ghl_conn connected, menu events 1 (applied) last 2026-10-21 00:03Z, 2 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief) (workflow efbc55f5)'),
  ('Werxly', 'Werxly', 'Sharlene Morani', 'getwerxly@gmail.com', 'ghl_affiliate', '0BMKKX1qKjGnv9dp24qu', NULL, 'in_progress', 'workflow draft built; last step returns 401, being fixed | next: Fix 401 on last step (PUT users), test, publish, rotate.', '2026-10-07T05:36:05-05:00'::timestamptz, 'Email from Sharlene "So now what do I do? How do I get your bonuses?" (no later customer contact found)', 'roster.csv(in progress) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-02, ghl_conn connected, menu events 4 (applied) last 2026-10-22 00:17Z, 3 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief); team+werxlytest@ activation 10/21 5:44 PM CT ; affiliate_signups_last30d.csv: portal signup 2026-09-29 22:27 CT, portal_status Signup, GHL contact SOGgJwl3TOtr77RjCt7V'),
  ('Wright Now Digital', 'Wright Now Digital', 'Gina Wright', 'hello@wrightnowdigital.com', 'ghl_affiliate', 'dQu3X5kbCxASbMwECCxl', NULL, 'done', 'done: tested, published, secret/token rotated | next: None (done). Sales page reminder sent.', '2026-10-21T11:44:00-05:00'::timestamptz, 'SMS from us: AI Studio sales system set up (she replied 8:04 AM "will get that done today")', 'roster.csv(in progress) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-20, ghl_conn connected, menu events 2 (applied) last 2026-10-21 19:47Z, 2 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief) ; affiliate_signups_last30d.csv: portal signup 2026-10-19 15:42 CT, portal_status Signup, GHL contact vN8q0rnR6W8C0dEMmCqJ'),
  ('FastTrack Digital Agency (app: Fast Track Digital Agency)', 'FastTrack Digital Agency (app: Fast Track Digital Agency)', 'Fast Track Digital', 'vanessa@hoyesglobal.com', 'slack', NULL, NULL, 'not_started', 'no setup evidence | next: team@ has agency access: connect PIT/Company ID, build test sub-account + workflow', '2026-10-20T09:09:00-05:00'::timestamptz, 'Slack: Vanessa $97 AUD setup-fee proposal', 'roster.csv(not started) ; supabase: ADVANCED, created 2026-06-02 ; roster next_step: Not started. Connect HighLevel via team@ agency access, then build AI Studio preset, secret, workflow, test.'),
  ('LeadBuddy', 'LeadBuddy', 'Syed Huq', 'team@leadbuddy.io', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: GHL agency was locked (failed payment) during 10/20 audit; then connect PIT/Company ID + build', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-06-05 ; roster next_step: Not started. Connect HighLevel via team@ agency access, then build AI Studio preset, secret, workflow, test.'),
  ('OnRecord.AI (app: On Record AI )', 'OnRecord.AI (app: On Record AI )', 'Caroline Hobbs', 'caroline@rewardrealty.org', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: team@ has agency access: connect PIT/Company ID, build test sub-account + workflow', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-04-15 ; roster next_step: Not started. Connect HighLevel via team@ agency access, then build AI Studio preset, secret, workflow, test. Note BASIC '),
  ('SavvySTUDIO', 'SavvySTUDIO', 'AJ Yates', 'hello@savvysocialselling.io', 'slack', NULL, NULL, 'not_started', 'no setup evidence | next: team@ has agency access: connect PIT/Company ID, build test sub-account + workflow', '2026-10-13T10:01:00-05:00'::timestamptz, 'Slack: Tyndall domain/EIN chase', 'roster.csv(not started) ; supabase: ADVANCED, created 2026-08-14 ; roster next_step: Not started. Connect HighLevel via team@ agency access, then build AI Studio preset, secret, workflow, test. Last app lo'),
  ('WiredMSP by CyberSells (app: WiredMSP)', 'WiredMSP by CyberSells (app: WiredMSP)', 'Alex Courson', 'alex@cyber-sells.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: team@ has agency access: connect PIT/Company ID, build test sub-account + workflow', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-06-17 ; roster next_step: Not started. Connect HighLevel via team@ agency access, then build AI Studio preset, secret, workflow, test. Last app lo'),
  ('Agency HQ', 'Agency HQ', NULL, NULL, 'other', NULL, NULL, 'not_started', 'no setup evidence | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; roster next_step: No SaaSSuite account or Stripe record found under this name. Identify the contact email, then get them a SaaSSuite accou'),
  ('BrandBlock', 'BrandBlock', NULL, NULL, 'other', NULL, NULL, 'not_started', 'no setup evidence | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; roster next_step: No SaaSSuite account or Stripe record found under this name. Identify the contact email, then get them a SaaSSuite accou'),
  ('chiguu', 'chiguu', 'Pete Stoddard', 'peter@chiguu.com', 'ghl_affiliate', 'wcha6zUN6UxaSbS2CdPg', NULL, 'done', 'done | next: None (done). Kit rows sit under goaskpete@gmail.com (no SaaSSuite login there).', '2026-10-14T11:45:41-05:00'::timestamptz, 'Email from Pete (goaskpete@) re signing up via link; call accepted for Thu 10/15', 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-21, ghl_conn connected, menu events 7 (applied,failed) last 2026-10-21 21:21Z, 2 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief); supabase ghl_connections company wcha6zUN... connected 10/21; team+chiguutest@ activation 10/21 ; affiliate_signups_last30d.csv: portal signup 2026-10-14 16:05 CT, portal_status Cancelled, GHL contact 6SQ4dgWGSI5knlgEpHUT'),
  ('Champagne Room (app: champagne-room)', 'Champagne Room (app: champagne-room)', 'Melissa Ricker', 'melissa@melissaricker.com', 'slack', NULL, NULL, 'not_started', 'no setup evidence | next: Roster says sub-account-only access; Slack 7/17 Melissa said team@ added as agency admin -> verify', '2026-10-19T16:39:00-05:00'::timestamptz, 'Slack thread (weekly report / AI Studio pricing q)', 'roster.csv(blocked-needs-invite) ; supabase: ADVANCED, created 2026-01-08 ; roster next_step: Ask Melissa for agency-level invite to team@ (sub-account only). Stripe email misspelled melssaricker.com.'),
  ('Consumer Consulting Services', 'Consumer Consulting Services', 'Marilyn Taylor', 'consumerconsulting4all@gmail.com', 'ghl_affiliate', NULL, 'QFANsvpL59xQZsxXQr9w', 'not_started', 'not started; she says she made team@ Admin 10/21 4:31 PM CT (unverified) | next: Verify team@ is Agency Admin (not just sub-account user); then start. Call her Marilyn.', '2026-10-21T17:08:06-05:00'::timestamptz, 'Email from Marilyn: "I''m a senior and not a techy person..." after saying she changed team@ role to Admin (4:31 PM)', 'roster.csv(blocked-needs-invite) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-20 ; GHL Dev status Oct 21 evening (per Andrew brief); Gmail "Re: your free bonuses" 10/21; team@ activation email "Consumer Consulting Services" 10/21 11:27 AM CT ; affiliate_signups_last30d.csv: portal signup 2026-10-19 19:17 CT, portal_status Signup, GHL contact jA7HbDEF5uZFmfFpYBLt'),
  ('Launch 360', 'Launch 360', 'Suzanne Guzman', 'suzi@launch360.co', 'slack', NULL, NULL, 'not_started', 'no team@ agency access | next: team@ only has sub-account access; needs Agency Admin', '2026-10-16T18:37:00-05:00'::timestamptz, 'Slack: support reply webhook thread', 'roster.csv(blocked-needs-invite) ; supabase: ADVANCED, created 2026-09-28 ; roster next_step: Ask Suzanne for an agency-level invite to team@ (only sub-account access today).'),
  ('Ai 2 Mainstreet LLC', 'Ai 2 Mainstreet LLC', 'Phillip Reames', 'phil@ai2mainstreet.com', 'existing_customer', 'uCQepFjoNS1HVjILm7xu', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 2 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-16, ghl_conn connected, 2 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Hudhud Marketing Agency', 'Hudhud Marketing Agency', 'shahril bin ahmad', 'shahril@auraaisystems.com', 'existing_customer', '8sLwcuDsKYc4cfLyJri5', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 1 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: BASIC, created 2026-10-20, ghl_conn connected, 1 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Better Method (Ed Gnad / Better Methods)', 'Better Method (Ed Gnad / Better Methods)', 'Ed Gnad', 'edgnad@gmail.com', 'slack', 'UJY4NKVUHjfpTeNssrHF', 'BmNZpo8NArOEGZryb4X9', 'done', 'done (reference setup) | next: Reference setup; none. Follow up after 10/19 call (branding).', '2026-10-19T16:18:02-05:00'::timestamptz, 'Slack #ed-gnad: Andrew sent AI Studio video link', 'roster.csv(in progress) ; supabase: BASIC, created 2026-10-11, ghl_conn connected, menu events 2 (applied) last 2026-10-14 05:29Z, 2 active menu rules ; menu-link-audit.md reference workflow (agency_id edgnad, loc BmNZpo8NArOEGZryb4X9)'),
  ('Biz Consults Inc', 'Biz Consults Inc', NULL, 'lvsstephens@gmail.com', 'existing_customer', 'YYEcs3IBwnOuAWqpGlrz', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: STARTER, created 2026-10-15, ghl_conn connected ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('ctrlher', 'ctrlher', 'Angela StPierre', 'angiestp10@gmail.com', 'existing_customer', 'V5HtzZQ3DrhbMx7stzbN', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 1 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: BASIC, created 2026-03-31, ghl_conn connected, 1 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Fentress Solutions', 'Fentress Solutions', 'Darius Fentress', 'darius@fentresssolutions.com', 'existing_customer', 'myHClTT5VekVsfTtjsSP', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 3 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-05-27, ghl_conn connected, 3 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Healthii', 'Healthii', 'Sara', 'info@healthiihub.com', 'existing_customer', 'UIYMGVlOgAwHcxAdyU3Z', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: STARTER, created 2026-10-11, ghl_conn connected ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('HyperDrive Digital', 'HyperDrive Digital', 'Domenique Tisher', 'domtisher@gmail.com', 'existing_customer', '2X0QjY13Eh4zc6pNxPc0', NULL, 'in_progress', 'self-serve: customer workflow firing (5 events, last 2026-10-19); not audited vs Better Method | next: Audit against Better Method checklist; needs team@ agency access', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-03, ghl_conn connected, menu events 5 (applied,failed) last 2026-10-19 19:45Z, 4 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Keystone', 'Keystone', 'Francois Bergeron', 'admin@digitalaspect.io', 'existing_customer', 'LWQoHTpjYvZD7t9LEd1u', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-16, ghl_conn connected ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('KLS', 'KLS', 'Louis', 'louis50andsuzi46@gmail.com', 'ghl_affiliate', 'ZzGOeMM5xAOQJtncub17', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 1 menu rules; no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-14, ghl_conn connected, 1 active menu rules ; affiliate_signups_last30d.csv: portal signup 2026-10-14 10:52 CT, portal_status Signup, GHL contact x0h0wneDpLgJ9ox9FFGi ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Lightwork Digital', 'Lightwork Digital', 'Paul Saunders', 'paul@lightworkdigital.com', 'existing_customer', 'Jh8wv8ixj4uppxPQqBSK', NULL, 'not_started', 'not started: asked 10/21 7 PM CT to add team@ as Agency Admin; also "Client Hub Not Found" issue | next: Paul to add team@ as Agency Admin; fix Client Hub Not Found.', '2026-10-21T19:00:37-05:00'::timestamptz, 'Email from Andrew "Re: Is this on?" asking to add team@ as Agency Admin', 'roster.csv(in progress) ; supabase: BASIC, created 2026-10-10, ghl_conn connected, 1 active menu rules ; GHL Dev status Oct 21 evening (per Andrew brief); Gmail "Re: Is this on?" 10/21'),
  ('Luxeify Marketing', 'Luxeify Marketing', 'Ethan Mompremier', 'mompremierethan@gmail.com', 'existing_customer', 'c76bqXaYhk0pl3N6LkQQ', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2026-10-20, ghl_conn connected ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('praise picker', 'praise picker', 'Ashley Harris', 'ashland@crashproofdigital.com', 'existing_customer', 'v5HjWgNTIY61ByLOuLZd', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 4 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: BASIC, created 2026-10-01, ghl_conn connected, 4 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('PWF Scaling', 'PWF Scaling', 'Gerson Tavares', 'gerson.pm.tavares@gmail.com', 'existing_customer', '4LHAVY2G3hBG3ZDCzJx7', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 1 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: BASIC, created 2026-10-14, ghl_conn connected, 1 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Vera AI Studio', 'Vera AI Studio', 'Eric Alexander', 'hunteralex2112@gmail.com', 'ghl_affiliate', 'G8UZHWnr2qgutLUwIrRE', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', '2026-10-09T16:44:13-05:00'::timestamptz, 'Email from Eric: signed up via affiliate link, how to get SaaSSuite access', 'roster.csv(in progress) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-09, ghl_conn connected ; affiliate_signups_last30d.csv: portal signup 2026-10-09 21:29 CT, portal_status Active, GHL contact Jf7SIt0ATzgBrljfhXlt ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('XXI designs', 'XXI designs', 'XXI Designs', 'andrew@xxidesigns.com', 'existing_customer', 'Bst7IXzLBofhSmbrh4aE', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); 3 menu rules; no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(in progress) ; supabase: ADVANCED, created 2025-08-29, ghl_conn connected, 3 active menu rules ; roster next_step: Customer is setting this up themselves (team@ has no access). Offer help or ask for an agency invite to team@ to finish:'),
  ('Marilyn Simmons', NULL, 'Marilyn Simmons', 'marilyn@techcnterfl.com', 'text', NULL, NULL, 'not_started', 'next: SaaSSuite account email typo (real: marilyn@techcenterfl.com); trial restart request; not onboarded', '2026-10-20T20:47:00-05:00'::timestamptz, 'SMS from Marilyn: correct email is techcenterfl.com', 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-16 ; followup_2026-10-21.md'),
  ('Glenn Sojourner', NULL, 'Glenn Sojourner', 'glenn@glennsojourner.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-17 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Robert Mick', NULL, 'Robert Mick', 'robertmick@sphering3.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-02 ; affiliate_signups_last30d.csv: portal signup 2026-10-02 15:33 CT, portal_status Signup, GHL contact OXETIFsYMs6Ds2cmJpkW ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Joao Monteiro Timoteo', NULL, 'Joao Monteiro Timoteo', 'spicyog33@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: STARTER, created 2026-10-07 ; affiliate_signups_last30d.csv: portal signup 2026-10-07 15:43 CT, portal_status Signup, GHL contact 4AIsnBs6SA64C6YEOi0C ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Andrew Thompson', NULL, 'Andrew Thompson', 'aiautomation213@gmail.com', 'existing_customer', 'DnwqTxESkjPeE5KsZ0aN', NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-10-15, ghl_conn disconnected ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Andy Steuer', NULL, 'Andy Steuer', 'andy@welevel.io', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-11-19 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Greg Tucker', NULL, 'Greg Tucker', 'bgtcreative@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-05-05 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Chris Dillon', NULL, 'Chris Dillon', 'chris@themarketingautopilots.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2025-11-30 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Daniel Harrison', NULL, 'Daniel Harrison', 'dan@quantumcollective.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2025-09-23 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('jason miller', NULL, 'jason miller', 'jason@rovaagent.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2025-11-25 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('SAKIB HOSSAIN', NULL, 'SAKIB HOSSAIN', 'metricsmania@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-09-30 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Thomas Dutcher', NULL, 'Thomas Dutcher', 'systlybiz@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-11-19 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Erick pineda', NULL, 'Erick pineda', 'edanielpm@live.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-05 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Accelero', 'Accelero', 'Tor Norgard', 'tor@accelero.dk', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-10-05 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Ad Vital + Zaya', 'Ad Vital + Zaya', 'Shitel Patel', 'shitel@advital.app', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-08-19 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('AIBLY Automation', 'AIBLY Automation', 'Daniel R Hughes', 'daniel@aiblyautomation.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-06-22 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Bleu Elegant Enterprises', 'Bleu Elegant Enterprises', 'Juliet Ucheoma', 'bleuelegantdesigns@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-09-26 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Cee Castillo', 'Cee Castillo', 'Cee Castillo', 'cee@ceesuite.io', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-19 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('clearnetmarketing', 'clearnetmarketing', 'Scott Curts', 'scottcurts@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-01-23 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('CNCSDirect', 'CNCSDirect', 'Carl Novara', 'info@cncsdirect.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-11-21 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('CustomOut Media', 'CustomOut Media', 'William Penn', 'kingpincredit@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-08-24 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Digital AdVentures', 'Digital AdVentures', 'Kevin R Keleher', '1digitaladventures@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-08-19 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('EnRoute Growth Platform NA', 'EnRoute Growth Platform NA', 'Marc', 'marc.williams@enroutegrowthplatform.net', 'ghl_affiliate', NULL, NULL, 'not_started', 'no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-13 17:44 CT, portal_status Active, GHL contact JyE91Mbyz93rrYy7OSaf ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('FEC Playbook', 'FEC Playbook', 'Keith Smith', 'keith@bookmore.app', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-09-22 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('founders', 'founders', 'CHRISTOPHER DAVIS', 'sales@foundersmarketinggroup.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-01-06 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Goose It AI', 'Goose It AI', 'James Fraley', 'james@gooseitai.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-04 ; affiliate_signups_last30d.csv: portal signup 2026-10-04 04:13 CT, portal_status Active, GHL contact sPquo1UfAqXEZs25MUSi ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Got Funnels', 'Got Funnels', 'Stacia Kennedy', 'stacia@gotfunnels.com', 'existing_customer', 'flJLXb0A51vE36hVg1MP', NULL, 'not_started', 'GHL connected in SaaSSuite (no workflow evidence); no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-10, ghl_conn connected ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Gung Ho Local', 'Gung Ho Local', 'Sean M Fitzgerald', 'seanfitz@gungholocal.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-12 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Harmony CRM', 'Harmony CRM', 'Jaudaun Eldridge', 'jaudaun@harmonyhli.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-06-04 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Hudhudly', 'Hudhudly', 'shahril bin ahmad', 'shahcorea@gmail.com', 'existing_customer', 'HzrVBmNXSkmliIsoK5Dw', NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: STARTER, created 2026-10-05, ghl_conn disconnected ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('jayna RabkeBarriano', 'jayna RabkeBarriano', 'jayna RabkeBarriano', 'jayna90@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-10-04 ; affiliate_signups_last30d.csv: portal signup 2026-10-04 16:57 CT, portal_status Signup, GHL contact pkXjD4IKlcjl71C1XMcm ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Launch Automation', 'Launch Automation', 'Corey Gray', 'team@launchautomation.ai', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-05-11 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('leadgriffin', 'leadgriffin', 'Stuart Young', 'stuart@xenongroup.org', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2025-12-14 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('LuxeScale', 'LuxeScale', 'Mark Coppens', 'mark@livingvogue.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-05-24 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Magic by ProReignMaker', 'Magic by ProReignMaker', 'Brook Chandler', 'brook@proreignmaker.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-09-22 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Media Lifeline Pro', 'Media Lifeline Pro', 'Cody Stinson', 'support@medialifeline.net', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-10 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Michael McWhorter', 'Michael McWhorter', 'Michael McWhorter', 'trafficqc@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-18 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('MorrisCRM', 'MorrisCRM', 'Patrick Simmons', 'jamiesmylnycky@designsquadmedia.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-09-18 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('mysterious', 'mysterious', 'Ben Matteucci', 'ben@mysterious.inc', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-08-29 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('nei', 'nei', 'Michael Pope Jr', 'michaelpopejr@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-12-13 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('ONeal Technology', 'ONeal Technology', 'Brady O''Neal', 'bradyotech@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-10-12 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Optimise Online', 'Optimise Online', 'Calum Maxwell', 'calum@optimiseonline.com.au', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-09-20 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Pivot', 'Pivot', 'Chris Duhaime', 'chris@thepivotplan.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2026-06-10 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Pixel & Print Media', 'Pixel & Print Media', 'Robin', 'hello@permianbasinlocal.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no team@ agency access; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: STARTER, created 2026-10-14 ; affiliate_signups_last30d.csv: portal signup 2026-10-14 00:14 CT, portal_status Signup, GHL contact S7lhnSmNwB33Tf1HPuVF ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('ResQEngage', 'ResQEngage', 'Joseph Cooper', 'agency@resqware.solutions', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-05-26 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Revora', 'Revora', 'Santiago Acevedo', 'admin@gorevora.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-03-11 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Small Step Big Step', 'Small Step Big Step', 'Small Step Big Step', 'mal.herring@smallstepbigstep.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-12-15 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('sololink', 'sololink', 'Andy Griffith', 'contact@sololink.io', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: ADVANCED, created 2025-11-23 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Strategic Digital Media', 'Strategic Digital Media', 'mtorres6739''s projects', 'torres.mathew@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: BASIC, created 2026-05-20 ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Virtual Ops Co', 'Virtual Ops Co', 'Amanda Mitchum', 'amanda@virtualopsco.com', 'existing_customer', 'MOwya4QIOWakzqUkFrCj', NULL, 'not_started', 'no team@ agency access | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'roster.csv(not started) ; supabase: STARTER, created 2026-08-04, ghl_conn disconnected ; roster next_step: Not started. Offer AI Studio setup; needs an agency invite to team@ (or self-serve).'),
  ('Clients on Automation', 'Clients on Automation', 'Luandre van Wyk', 'luandre@ladigitalconsulting.com', 'existing_customer', NULL, NULL, 'not_started', '2 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: ADVANCED, created 2026-06-25, 2 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('CrossKick', 'CrossKick', 'Rahul Paul', 'luke.robertson51@gmail.com', 'existing_customer', NULL, NULL, 'not_started', '1 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: BASIC, created 2026-04-16, 1 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('DesqLinq', 'DesqLinq', 'JOHN LADNER', 'john@goxlinq.com', 'existing_customer', NULL, NULL, 'not_started', '1 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: BASIC, created 2026-07-27, 1 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('Gable Grassroots Consulting', 'Gable Grassroots Consulting', 'Anthony Gable', 'tony@checkmyinsurancerate.com', 'existing_customer', NULL, NULL, 'not_started', '2 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: BASIC, created 2026-09-07, 2 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('Mar Revenue Systems (app.marrevenuesystems.com)', 'Mar Revenue Systems (app.marrevenuesystems.com)', 'Leonardo Retamar', 'lenretamar@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'not started: needs team@ as Agency Admin | next: Leo to add team@yoursoftwareonboarding.com as Agency Admin; help widget "Failed, unable to connect" issue.', '2026-10-21T14:25:19-05:00'::timestamptz, 'Slack DM: Andrew asked Leo to add team@ to his agency (no reply yet; Leo last wrote 10/20 5:28 PM)', 'roster.csv(blocked-needs-invite) ; supabase: ADVANCED, created 2026-10-07 ; GHL Dev status Oct 21 evening (per Andrew brief); Slack DM'),
  ('Med Spa Marketing AI', 'Med Spa Marketing AI', 'Rob Upland', 'rob@medspamarketing.ai', 'existing_customer', NULL, NULL, 'not_started', '5 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: ADVANCED, created 2026-03-30, 5 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('Real Partners Creative', 'Real Partners Creative', 'Josh Yowell', 'josh@realpartnerscreative.com', 'existing_customer', NULL, NULL, 'not_started', '1 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: ADVANCED, created 2025-08-30, 1 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('Think Local SEO', 'Think Local SEO', 'Chris Attwood-Thomas', 'info@thinklocalseo.co.uk', 'existing_customer', NULL, NULL, 'not_started', '2 menu rules; no team@ agency access | next: needs team@ agency invite', NULL, NULL, 'roster.csv(blocked-needs-invite) ; supabase: BASIC, created 2026-05-27, 2 active menu rules ; roster next_step: Has presets but no HighLevel connection and no team@ access. Ask for an agency invite to team@ if they want AI Studio se'),
  ('Abiha Akram', NULL, 'Abiha Akram', 'abihaakram78@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-20 07:17 CT, portal_status Subscribed, GHL contact ZXEW3hNO0JTeFPKcasFP ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Anil Agrawal', NULL, 'Anil Agrawal', 'anil@eduforlife.ca', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-04 15:51 CT, portal_status Subscribed, GHL contact iY3ABqhp7ahtaE8TXznG ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Anita Singh', NULL, 'Anita Singh', 'anita.singhnotary@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-15 01:58 CT, portal_status Subscribed, GHL contact BksokhEU3HnfHNVZymW6 ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Bridget Osborne', NULL, 'Bridget Osborne', 'bridget_osborne@osbornehomegroup.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-09-23 22:02 CT, portal_status Signup, GHL contact DWdc0Y7S90xDoDm5McQm ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Xpay point', NULL, 'Xpay point', 'cchidexbuilders@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-09-24 22:08 CT, portal_status Subscribed, GHL contact m5tVPFBKqETR41TWuGzB ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Yolan Williams', NULL, 'Yolan Williams', 'freesaas@ut.egp1.io', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-08 16:52 CT, portal_status Signup, GHL contact XLvZnaEnqhfScHkCWQH7 ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('jngibbs7@gmail.com', NULL, NULL, 'jngibbs7@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-16 18:41 CT, portal_status Signup, GHL contact sw9MONq7b39gMz7CBZ5U ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('kim@jaggedhalollc.con', NULL, NULL, 'kim@jaggedhalollc.con', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-10 21:36 CT, portal_status Subscribed, GHL contact n/a ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Samuel Ayobami Victor', NULL, 'Samuel Ayobami Victor', 'samuelayobami205@gmail.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access; from affiliate export | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; affiliate_signups_last30d.csv: portal signup 2026-10-10 06:58 CT, portal_status Subscribed, GHL contact 25CQEV3IQb3DmKDtbPUi ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Kate Humpherys', NULL, 'Kate Humpherys', 'kate@katehumpherys.com', 'existing_customer', NULL, NULL, 'not_started', 'no SaaSSuite account; no team@ agency access | next: needs SaaSSuite account first', NULL, NULL, 'roster.csv(blocked-needs-saassuite-account) ; roster next_step: No SaaSSuite app account. Get them signed up before any setup.'),
  ('Local Growth Guide', 'Local Growth Guide', 'Victor Emmel', 'victor@localgrowthguide.com', 'ghl_affiliate', NULL, NULL, 'not_started', '2 menu rules; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: STARTER, created 2026-10-05, 2 active menu rules ; affiliate_signups_last30d.csv: portal signup 2026-10-05 21:12 CT, portal_status Cancelled, GHL contact VL4HiNH1KVUdqv6Rnsjm'),
  ('John Smith', NULL, 'John Smith', 'panting_07tanks@icloud.com', 'ghl_affiliate', NULL, NULL, 'not_started', 'no setup evidence; from affiliate export | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'affiliate_signups_last30d.csv (Oct 21 9:44 AM portal export) ; supabase: ADVANCED, created 2026-09-25 ; affiliate_signups_last30d.csv: portal signup 2026-09-25 18:15 CT, portal_status Cancelled, GHL contact 5UuD5YEkaP0AYTgXAVMg'),
  ('Juanika Freeman', NULL, 'Juanika Freeman', 'theviewsdept@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: ADVANCED, created 2026-10-21'),
  ('Quinten Gish', NULL, 'Quinten Gish', 'quinten@quintengish.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: ADVANCED, created 2026-10-21'),
  ('Dr Lisa Gregory', 'Dr Lisa Gregory', 'Dr Lisa Gregory', 'leadflowai909@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: ADVANCED, created 2026-10-18'),
  ('Local Biz Domination', 'Local Biz Domination', 'Pat', 'pfriedl@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: ADVANCED, created 2026-10-11'),
  ('DIALOG', 'DIALOG', NULL, 'metro995@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: BASIC, created 2026-10-10'),
  ('chsamraseher@gmail.com', NULL, NULL, 'chsamraseher@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: BASIC, created 2026-09-30'),
  ('56kng26yzs@privaterelay.appleid.com', NULL, NULL, '56kng26yzs@privaterelay.appleid.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: ADVANCED, created 2026-09-30'),
  ('abdulmanumit@gmail.com', NULL, NULL, 'abdulmanumit@gmail.com', 'existing_customer', NULL, NULL, 'not_started', 'no setup evidence | next: Ask for team@ Agency Admin invite (or offer self-serve)', NULL, NULL, 'supabase: ADVANCED, created 2026-09-22'),
  ('Kundflow.ai', 'Kundflow.ai', 'Jonas Carlström', NULL, 'email', NULL, NULL, 'not_started', 'next: Waiting on our reply re SaaS plan -> SaaSSuite menu stripping; no SaaSSuite account/contact email found in DB.', '2026-10-21T01:07:00-05:00'::timestamptz, 'Email from Jonas re $20 unlimited & SaaS plan menu stripping (awaiting our reply)', 'followup_2026-10-21.md'),
  ('Ian Shapiro', NULL, 'Ian Shapiro', 'ian@bfnproductions.com', 'email', NULL, NULL, 'not_started', 'next: Comped kit rows waiting; needs SaaSSuite login with this email, then GHL agency + team@ invite', '2026-10-20T17:16:58-05:00'::timestamptz, 'Email from Andrew re new agency + prebuilt ads/One Feature Kit', 'kit-access-roster-2026-10-21.md; Gmail "Support for my GHL agency"');

-- Prefer this file over the audit seed when the name or email matches but
-- the natural key does not (for example "Buzz Bull Marketing Systems" vs
-- "Buzz Bull Marketing Systems (app: Growth Chain System)").
DELETE FROM public.setup_tracker_accounts AS tracker
WHERE (
  lower(btrim(tracker.account_name)) IN (
    SELECT lower(btrim(account_name)) FROM setup_tracker_seed_incoming
  )
  OR (
    nullif(lower(btrim(coalesce(tracker.contact_email, ''))), '') IS NOT NULL
    AND lower(btrim(tracker.contact_email)) IN (
      SELECT lower(btrim(contact_email))
      FROM setup_tracker_seed_incoming
      WHERE nullif(btrim(coalesce(contact_email, '')), '') IS NOT NULL
    )
  )
  OR tracker.id IN (
  'c4a7eb1c-d734-49b2-96d9-ddf18a0f44a4',
  '40d01935-6fe0-460c-be0d-2fef4b98323a',
  '75a664e7-8499-45ec-97c0-3513c48f8951',
  'a326e3bf-6292-432b-8393-2f028711b362',
  '18c9770b-31b9-4e35-b679-bc1e3e75e0ee',
  '8147acee-c9a6-4c83-9eea-f96cd3bc43c3',
  'f75b36a1-64f2-4f51-8007-2747dfa24cef',
  '40657898-25ec-43f7-b991-224cb08c169a',
  'ec696d9b-9b78-47e4-96aa-32e6ec23c2e0',
  '634df5b8-37ef-49e1-8d1e-77f66b6775e6',
  'a4bcc692-ba0c-4131-944a-a1f1cd3a330d',
  '04d373e4-6c1f-4042-9a6c-664a3f97743f',
  '37009eaa-674c-42b4-84c5-96a03d7c910f',
  'fd622cb8-a9d4-4e20-aed1-f6f2ce755ced',
  '84398cc6-289a-461b-b937-777d43e25e5a',
  'bbca2813-f68a-4c68-88a9-ecfd558f9510',
  'd7b4a091-8b3f-4db4-85ad-dc599d41a8f4',
  '0185eb5c-3f04-4f13-85f7-4f1f94aa0ce9',
  'e340e4dd-cc61-4349-91b9-903a18f12ffb',
  '0cdbeb9d-01a1-493e-a385-724a1ec3e77e',
  '742b9e2d-efe4-4e62-8b4b-eeb62599a828',
  'a1855eef-4075-4e0e-aedd-c0219ac1ea09',
  '1ec4489a-4b48-47dc-83cf-167da09523dc',
  'b78d8910-f3ff-469b-83d6-9b7af58364f9',
  '536c7cf2-e08b-49c0-9edd-a39f222ee49a',
  '51512e27-b517-4f58-9bc2-2c1f6fcdbebd',
  '3a8034e9-bbcc-4af0-b017-50f8994326d6',
  '0fa9e07b-f5a9-44f6-a358-c0e0c84d86c1',
  '7b527149-7b66-4918-8034-f4dc4ec09f9e',
  '7bf611dd-1037-4f48-b79b-8242eda3f610',
  'b2b50db7-0ba1-4a96-b871-9d11eb5cb10a',
  '69ae616c-f9c8-4062-acd6-a3f6569ca978',
  '3efaf059-3777-447c-a40a-ee247ded6d98',
  '2c65aa9a-160a-4c35-8dac-593a96161d2d',
  'ec782f48-19c2-4744-9e01-fdc487b88904',
  'da695f81-afca-4327-993a-ad449aac7fe9',
  '87ca1bae-31cc-46ad-9748-76e530a2a4b5',
  'de74b310-0efc-4d95-85b9-34db66d6370c',
  '73f9ec9b-5fa7-4323-bca8-3aa1ffa7307e',
  '79319dfc-b2a6-49d7-a961-4667cd794132',
  '7426f4f3-5ec9-40a1-8474-4be45ab3c201',
  'd634508d-1eca-45fb-9880-c143e5715266',
  '729c4957-3376-4917-89d6-bcf08deb73fa',
  '5d7d7fc0-2b57-4d86-90a0-b2f63140b43f',
  '959c70f0-f417-4c04-b2d6-385224eb2d96',
  '845c487e-17c3-4c90-90ac-7cafe4ad0a5e',
  '015c6c28-f64f-4194-86a6-5c3646bc057f',
  '295db581-50aa-488e-a3e8-2d3f96b10ebc',
  '28c9adbf-4490-458f-99c5-e72ff053cc33',
  '594d72a0-0ddc-43bb-b965-c6fece33a92a',
  '96d0b090-89b8-4023-8c2e-3726212a6434',
  '11fb767f-11ee-4a1b-a8a4-3959bd3aeb77',
  '761a20d9-806c-475d-9d87-f9cda72b67c3',
  'd0367fdc-6705-4ad9-a139-4405eb2d8827',
  '1659418f-1032-4bfc-8914-9a85547ba257',
  '3c5a5aa7-e71f-4bd4-a2a1-931b3889f67e',
  'b290ccaa-a2b7-4ce7-b60b-cf23f122901b',
  'd86e5627-4519-4eba-bf6b-7ee44d3899bc',
  '54ae31f1-0205-40d2-a605-8636c60db62a',
  'fb078831-a0f4-4bcb-a06d-8f59050df389',
  '4ed8cb02-348c-4287-aab9-9fc02f99900a',
  '22ca8451-ee17-4428-a9a1-b394d9c0a2f8',
  'd8a07526-d584-4d83-9843-d5da913de8f2',
  'b1e9c255-27be-4b9d-a9d4-1d5607ff9a25',
  '017ff6a7-0c0c-4e96-880a-4431caac351b',
  '65748d52-9e5e-4e5e-8183-35aec90e57bb',
  '1b627236-53dc-423b-9441-d6458670dcb3',
  '325b56bd-3ede-460a-a957-06421cd90464',
  '5d34fd5e-3b64-474f-85a4-dc28cfb2c72a',
  'b9076f72-7295-4d96-b6d2-df7f6144f882',
  '52dc601b-814e-47a7-8138-4ff223665815',
  'c4ddecba-5417-450b-bdd9-f45571a434b1',
  'b3b4bde4-8398-43f1-aa42-7a0d48212604',
  'a622950a-edb2-4f5e-a62c-f4fff4e0f153',
  '30eb8b3d-2206-4f1b-9331-6bf2a3e39b71',
  '51588238-d818-4795-ba8e-1060e6e7e792',
  'bf3473c0-6847-4de9-8425-c345cd39489f',
  '3919ade9-2233-4233-95a7-182369c7a562',
  'c142ef33-5e57-4416-9edc-cca286164915',
  '7d9dfd88-1b3a-4d3a-b21b-5e26dd71fc6e',
  'f0bd152e-5e1c-44e9-8802-08d3b0465231',
  '36087a4b-4d3b-4864-9650-eb66ccf9e4be',
  'af5f1667-f1bb-4d14-bf83-ba87249b7b35',
  '83b56216-5968-4332-b6a2-bfc19bc2134b',
  'd7f5bd66-c574-4420-86b5-6251af50d9a8',
  'bb93f68e-fac6-4255-935e-dd11acccedac',
  '0b40417f-1f49-4502-98fe-b0de967e6530',
  '834b113f-bbe9-4265-8431-7225194a0153',
  'c395efea-0355-45c6-ba84-188ae9ec6ecd',
  'ddf5772a-f718-4581-9967-ccbaeb4e1780',
  '05f47a54-2d51-455a-9025-09372b0a239d',
  'a40124b7-13e3-4c9a-a853-9e29c9b5a84b',
  'bfc7714b-7946-4050-9351-f8f634c87ffc',
  'b7288dd8-a2b7-4a5b-8035-1b397cce39a8',
  'a377fac7-8105-4072-a1d7-babeabaed97b',
  'f5aee865-7c74-4f31-a861-dbd3f00706f5',
  '0574da68-2621-49e1-ba31-ddee6b52bb5a',
  '698e4587-ac0b-4698-adda-16ffdcbee421',
  '4f7e7df3-b818-4885-bd70-77cfd3c6bf53',
  'ebd849c7-b8b5-47eb-98ad-39ddb70986bf',
  'e68efb20-be11-401d-86b3-ede49ba64b04',
  'ef2963d8-006d-49d2-83a3-130c187f4777',
  'db9aa358-cf95-45ae-8811-d5c1a4738f02',
  'f6c6993f-e638-4008-8536-35c4ee9c7ed3',
  '4cca5161-8a7b-40bb-88f2-2245a8e1a847',
  '3a03a832-6aac-4397-83fc-cec5184d4fe2',
  '987b4309-75a3-423e-885e-8c5b457211e1',
  'a98d10f8-cb4f-4b20-bbc2-7f6fd0ed8430',
  '89156c6d-a406-462e-b29c-0294b5380ba9',
  '960022db-1c92-4161-a95f-0b0a6df96450'
  )
)
AND (
  lower(btrim(tracker.account_name)),
  lower(btrim(coalesce(tracker.contact_email, '')))
) NOT IN (
  SELECT
    lower(btrim(account_name)),
    lower(btrim(coalesce(contact_email, '')))
  FROM setup_tracker_seed_incoming
);

INSERT INTO public.setup_tracker_accounts (
  account_name,
  agency_name,
  contact_name,
  contact_email,
  source,
  ghl_agency_id,
  ghl_location_id,
  setup_status,
  status_detail,
  last_contact_at,
  last_contact_note,
  evidence
)
SELECT
  account_name,
  agency_name,
  contact_name,
  contact_email,
  source,
  ghl_agency_id,
  ghl_location_id,
  setup_status,
  status_detail,
  last_contact_at,
  last_contact_note,
  evidence
FROM setup_tracker_seed_incoming
ON CONFLICT (
  (lower(btrim(account_name))),
  (lower(btrim(coalesce(contact_email, ''))))
)
DO UPDATE SET
  agency_name = EXCLUDED.agency_name,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  source = EXCLUDED.source,
  ghl_agency_id = EXCLUDED.ghl_agency_id,
  ghl_location_id = EXCLUDED.ghl_location_id,
  setup_status = EXCLUDED.setup_status,
  status_detail = EXCLUDED.status_detail,
  last_contact_at = EXCLUDED.last_contact_at,
  last_contact_note = EXCLUDED.last_contact_note,
  evidence = EXCLUDED.evidence;

UPDATE public.setup_tracker_accounts AS tracker
SET saas_suite_user_id = matched.id
FROM (
  SELECT DISTINCT ON (lower(btrim(email)))
    id,
    lower(btrim(email)) AS email
  FROM public.saas_suite_users
  WHERE email IS NOT NULL
    AND btrim(email) <> ''
  ORDER BY lower(btrim(email)), id
) AS matched
WHERE tracker.contact_email IS NOT NULL
  AND lower(btrim(tracker.contact_email)) = matched.email
  AND (
    lower(btrim(tracker.account_name)),
    lower(btrim(coalesce(tracker.contact_email, '')))
  ) IN (
    SELECT
      lower(btrim(account_name)),
      lower(btrim(coalesce(contact_email, '')))
    FROM setup_tracker_seed_incoming
  )
  AND tracker.saas_suite_user_id IS DISTINCT FROM matched.id;

UPDATE public.setup_tracker_accounts AS tracker
SET saas_suite_user_id = NULL
WHERE tracker.saas_suite_user_id IS NOT NULL
  AND (
    lower(btrim(tracker.account_name)),
    lower(btrim(coalesce(tracker.contact_email, '')))
  ) IN (
    SELECT
      lower(btrim(account_name)),
      lower(btrim(coalesce(contact_email, '')))
    FROM setup_tracker_seed_incoming
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.saas_suite_users AS users
    WHERE users.email IS NOT NULL
      AND btrim(users.email) <> ''
      AND lower(btrim(users.email)) = lower(btrim(tracker.contact_email))
  );
