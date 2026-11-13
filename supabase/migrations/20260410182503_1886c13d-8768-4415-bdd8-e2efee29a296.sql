
-- 1. Delete the duplicate stancexsystems row (id 307, no agency data)
DELETE FROM saas_suite_users WHERE id = 307;

-- 2. Fix BASIC users: set plan=BASIC, max_onboarding_users=5
UPDATE saas_suite_users SET plan = 'BASIC', max_onboarding_users = 5
WHERE lower(email) IN (
  'hello@introvertapproved.com',
  'angiestp10@gmail.com',
  'rob@medspamarketing.ai',
  'alfredomarquez@easyedgedigital.com',
  'jorge@marketinginnovationsgroup.com',
  'admin@gorevora.com',
  'lamonica@useaigent.io',
  'connectproio@gmail.com',
  'info@frontrowmedia.com.au',
  'scottcurts@gmail.com',
  'propelprofitsmarketing@gmail.com',
  'sales@foundersmarketinggroup.com',
  'web@cfocus.ca',
  'info@wickai.app',
  'stuart@xenongroup.org',
  'michaelpopejr@gmail.com',
  'chris@themarketingautopilots.com',
  'dan@quantumcollective.com',
  'ap@social-local.com',
  'kevin@myuig.com',
  'jason@rovaagent.com',
  'bgtcreative@gmail.com',
  'kate@katehumpherys.com',
  'support@sustainablecollaboration.co'
);

-- 3. Fix ADVANCED users: set plan=ADVANCED, max_onboarding_users=100
UPDATE saas_suite_users SET plan = 'ADVANCED', max_onboarding_users = 100
WHERE lower(email) IN (
  'mal.herring@smallstepbigstep.com',
  'josh@realpartnerscreative.com',
  'jamiesmylnycky@designsquadmedia.com',
  'digivoxllc@gmail.com',
  'contact@sololink.io',
  'info@cncsdirect.com',
  'andy@welevel.io',
  'andrew@xxidesigns.com',
  'robert@hopla.tools',
  'dsfds@ghl.com',
  'empireasainc@gmail.com',
  'maklodhi008@gmail.com',
  'bookmrdongo@gmail.com',
  'jasluvbrar@spademarketing.ca',
  'tony@xealai.com',
  'mullersinvestments@gmail.com',
  'affiliatemarketingwithtorrance@gmail.com',
  'biko@adverium.agency',
  'stancexsystems@gmail.com',
  'sazonmarva@gmail.com',
  'jjethronulla@gmail.com',
  'hbnycfitness@gmail.com',
  'nutek.info1@gmail.com',
  'rita@pjsboss.com',
  'buttercup@yogarocks.me',
  'marketplacefc@gmail.com',
  'tonyperezclass@gmail.com',
  'mannycru777@gmail.com',
  'kauluadamshi@gmail.com',
  'sano@myohanamarketing.com',
  'pauljmcmann@gmail.com',
  'teamallbeatsany@gmail.com',
  'muhammad.afzal@crmexpress.io',
  'ray@turfgrow.com',
  'sales@builducoaching.com',
  'ppportraits@icloud.com',
  'gui@bianzolab.com',
  'arielgetsmail@gmail.com',
  'gabriel@growscale.agency',
  'andrshans33@gmail.com',
  'elyone120@gmail.com'
);

-- 4. Downgrade everyone else to STARTER (except admin and test accounts)
UPDATE saas_suite_users SET plan = 'STARTER', max_onboarding_users = 1
WHERE lower(email) NOT IN (
  -- BASIC list
  'hello@introvertapproved.com','angiestp10@gmail.com','rob@medspamarketing.ai','alfredomarquez@easyedgedigital.com','jorge@marketinginnovationsgroup.com','admin@gorevora.com','lamonica@useaigent.io','connectproio@gmail.com','info@frontrowmedia.com.au','scottcurts@gmail.com','propelprofitsmarketing@gmail.com','sales@foundersmarketinggroup.com','web@cfocus.ca','info@wickai.app','stuart@xenongroup.org','michaelpopejr@gmail.com','chris@themarketingautopilots.com','dan@quantumcollective.com','ap@social-local.com','kevin@myuig.com','jason@rovaagent.com','bgtcreative@gmail.com','kate@katehumpherys.com','support@sustainablecollaboration.co',
  -- ADVANCED list
  'mal.herring@smallstepbigstep.com','josh@realpartnerscreative.com','jamiesmylnycky@designsquadmedia.com','digivoxllc@gmail.com','contact@sololink.io','info@cncsdirect.com','andy@welevel.io','andrew@xxidesigns.com','robert@hopla.tools','dsfds@ghl.com','empireasainc@gmail.com','maklodhi008@gmail.com','bookmrdongo@gmail.com','jasluvbrar@spademarketing.ca','tony@xealai.com','mullersinvestments@gmail.com','affiliatemarketingwithtorrance@gmail.com','biko@adverium.agency','stancexsystems@gmail.com','sazonmarva@gmail.com','jjethronulla@gmail.com','hbnycfitness@gmail.com','nutek.info1@gmail.com','rita@pjsboss.com','buttercup@yogarocks.me','marketplacefc@gmail.com','tonyperezclass@gmail.com','mannycru777@gmail.com','kauluadamshi@gmail.com','sano@myohanamarketing.com','pauljmcmann@gmail.com','teamallbeatsany@gmail.com','muhammad.afzal@crmexpress.io','ray@turfgrow.com','sales@builducoaching.com','ppportraits@icloud.com','gui@bianzolab.com','arielgetsmail@gmail.com','gabriel@growscale.agency','andrshans33@gmail.com','elyone120@gmail.com',
  -- Admin & test
  'andrew@dna-media.net','abbbbbb@gmail.com'
)
AND lower(email) != '';
