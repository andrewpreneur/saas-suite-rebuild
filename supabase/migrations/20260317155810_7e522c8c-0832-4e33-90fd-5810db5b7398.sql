-- Fix Wendy's Plan 2 and Plan 3 agency IDs to use name-based slugs
UPDATE saas_suite_users 
SET agency_id_advanced = 'porchlightgrowth-2',
    agency_id_elite = 'porchlightgrowth-3',
    use_agency_name_url = true
WHERE lower(email) = 'wendy@porchlightgrowth.com';

-- Update any v2_home_settings that reference the old UUIDs
UPDATE v2_home_settings SET agency_id = 'porchlightgrowth-2' WHERE agency_id = '50f3eecfe7334a16aab72cae484bfbdc';
UPDATE v2_home_settings SET agency_id = 'porchlightgrowth-3' WHERE agency_id = '6a337a0e45e44f39a753417bd55293ec';

-- Update any agency_video_settings that reference the old UUIDs
UPDATE agency_video_settings SET agency_id = 'porchlightgrowth-2' WHERE agency_id = '50f3eecfe7334a16aab72cae484bfbdc';
UPDATE agency_video_settings SET agency_id = 'porchlightgrowth-3' WHERE agency_id = '6a337a0e45e44f39a753417bd55293ec';

-- Update any custom_onboarding_videos that reference the old UUIDs
UPDATE custom_onboarding_videos SET agency_id = 'porchlightgrowth-2' WHERE agency_id = '50f3eecfe7334a16aab72cae484bfbdc';
UPDATE custom_onboarding_videos SET agency_id = 'porchlightgrowth-3' WHERE agency_id = '6a337a0e45e44f39a753417bd55293ec';

-- Update any agency_onboarding_checklist that reference the old UUIDs
UPDATE agency_onboarding_checklist SET agency_id = 'porchlightgrowth-2' WHERE agency_id = '50f3eecfe7334a16aab72cae484bfbdc';
UPDATE agency_onboarding_checklist SET agency_id = 'porchlightgrowth-3' WHERE agency_id = '6a337a0e45e44f39a753417bd55293ec';

-- Update agency_daily_checklist
UPDATE agency_daily_checklist SET agency_id = 'porchlightgrowth-2' WHERE agency_id = '50f3eecfe7334a16aab72cae484bfbdc';
UPDATE agency_daily_checklist SET agency_id = 'porchlightgrowth-3' WHERE agency_id = '6a337a0e45e44f39a753417bd55293ec';