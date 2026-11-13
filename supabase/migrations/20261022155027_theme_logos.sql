-- Shared HighLevel theme logos, one row per agency and sub-account.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- The theme-logo edge function writes with the service role. Visitors read the image
-- from the existing public "logos" bucket. No anonymous storage policy is added.

create table public.theme_logos (
  agency_id text not null,
  location_id text not null,
  logo_url text,
  storage_path text,
  updated_at timestamptz not null default now(),
  primary key (agency_id, location_id),
  constraint theme_logos_agency_id_check check (agency_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$'),
  constraint theme_logos_location_id_check check (location_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  constraint theme_logos_logo_url_len check (logo_url is null or char_length(logo_url) < 600),
  constraint theme_logos_storage_path_len check (storage_path is null or char_length(storage_path) < 300)
);

comment on table public.theme_logos is
  'Hosted logo chosen in the HighLevel theme builder. Service role only.';

alter table public.theme_logos enable row level security;

revoke all on table public.theme_logos from anon, authenticated;
grant all on table public.theme_logos to service_role;

create policy theme_logos_service
  on public.theme_logos
  for all
  to service_role
  using (true)
  with check (true);
