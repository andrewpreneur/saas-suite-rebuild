-- Audit log for HighLevel theme and logo writes.
-- Ship this file in the PR only. Do not apply it from an agent.
-- Apply it before deploying the updated location-theme and theme-logo functions.
-- It does not change location_themes or theme_logos.

create table public.theme_save_audit (
  id bigint generated always as identity primary key,
  agency_id text not null,
  location_id text not null,
  action text not null,
  via text not null,
  user_id text,
  user_email text,
  origin text,
  ok boolean not null,
  created_at timestamptz not null default now(),
  constraint theme_save_audit_agency_id_check check (agency_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$'),
  constraint theme_save_audit_location_id_check check (location_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  constraint theme_save_audit_action_check check (action in ('theme_save', 'logo_save', 'logo_delete')),
  constraint theme_save_audit_via_check check (via in ('supabase', 'highlevel', 'rejected')),
  constraint theme_save_audit_user_id_len check (user_id is null or char_length(user_id) <= 80),
  constraint theme_save_audit_user_email_len check (user_email is null or char_length(user_email) <= 320),
  constraint theme_save_audit_origin_len check (origin is null or char_length(origin) <= 200)
);

comment on table public.theme_save_audit is
  'Who saved a HighLevel theme or logo. user_id and user_email are the verified HighLevel user or the signed-in SaaS Suite user. Service role only.';

create index theme_save_audit_agency_recent
  on public.theme_save_audit (agency_id, created_at desc);

alter table public.theme_save_audit enable row level security;

revoke all on table public.theme_save_audit from anon, authenticated;
grant all on table public.theme_save_audit to service_role;
grant usage, select on sequence public.theme_save_audit_id_seq to service_role;

create policy theme_save_audit_service
  on public.theme_save_audit
  for all
  to service_role
  using (true)
  with check (true);
