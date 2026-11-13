
-- Drop the existing tables that track course progress since we don't need them
DROP TABLE IF EXISTS public.module_completion;
DROP TABLE IF EXISTS public.user_progress;

-- The saas_suite_users table is already perfect for just tracking logins
-- It has: id, email, created_at, last_accessed
-- No changes needed to this table as it already tracks what we need
