-- Done-for-you ad customization requests for the One Feature Kit.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- The edge function writes with the service role. A signed-in user can read only their own rows.

create table public.kit_ad_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  business_name text not null,
  notes text not null default '',
  template_ids text[] not null,
  logo_path text not null,
  created_at timestamptz not null default now(),
  constraint kit_ad_requests_email_lower check (email = lower(email)),
  constraint kit_ad_requests_email_shape check (position('@' in email) > 1),
  constraint kit_ad_requests_business_name check (char_length(btrim(business_name)) between 1 and 120),
  constraint kit_ad_requests_notes_len check (char_length(notes) <= 4000),
  constraint kit_ad_requests_templates check (cardinality(template_ids) between 1 and 17)
);

comment on table public.kit_ad_requests is
  'Logo and template choices a kit buyer sent for done-for-you ad customization.';

create index kit_ad_requests_user_idx on public.kit_ad_requests (user_id);

alter table public.kit_ad_requests enable row level security;

revoke all on table public.kit_ad_requests from anon, authenticated;
grant select on table public.kit_ad_requests to authenticated;
grant all on table public.kit_ad_requests to service_role;

create policy kit_ad_requests_select_own
  on public.kit_ad_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy kit_ad_requests_service
  on public.kit_ad_requests
  for all
  to service_role
  using (true)
  with check (true);

-- Public so the Slack ping can use a stable logo URL. The path is the buyer's user id
-- plus a random file name. Authenticated users can list only their own folder.
insert into storage.buckets (id, name, public)
values ('kit-ad-logos', 'kit-ad-logos', true);

create policy kit_ad_logos_owner_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'kit-ad-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
