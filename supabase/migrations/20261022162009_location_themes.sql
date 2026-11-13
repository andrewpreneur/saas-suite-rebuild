-- Shared HighLevel theme customizer saves, one row per agency and sub-account.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- The location-theme edge function writes with the service role. HighLevel user id
-- and email are stored as unverified hints from the install tag. They are not a login.

create table public.location_themes (
  agency_id text not null,
  location_id text not null,
  theme jsonb not null,
  user_id text,
  user_email text,
  updated_at timestamptz not null default now(),
  primary key (agency_id, location_id),
  constraint location_themes_agency_id_check check (agency_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$'),
  constraint location_themes_location_id_check check (location_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  constraint location_themes_user_id_len check (user_id is null or char_length(user_id) <= 80),
  constraint location_themes_user_email_len check (user_email is null or char_length(user_email) <= 320),
  constraint location_themes_theme_size check (octet_length(theme::text) < 24000)
);

comment on table public.location_themes is
  'Theme saved from the HighLevel theme customizer for one agency and location. Service role only. user_id and user_email are unverified hints.';

alter table public.location_themes enable row level security;

revoke all on table public.location_themes from anon, authenticated;
grant all on table public.location_themes to service_role;

create policy location_themes_service
  on public.location_themes
  for all
  to service_role
  using (true)
  with check (true);
