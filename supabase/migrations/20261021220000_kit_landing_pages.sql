-- The landing page a One Feature Kit buyer uses to sell the offer.
-- One row per account. The signed-in user can read and write only their own row.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.

create table if not exists public.kit_landing_pages (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email text,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kit_landing_pages_url_http check (
    url ~* '^https?://'
    and url !~ '[[:space:]]'
    and char_length(url) between 8 and 2000
  ),
  constraint kit_landing_pages_email_lower check (email is null or email = lower(email)),
  constraint kit_landing_pages_email_len check (email is null or char_length(email) <= 320)
);

comment on table public.kit_landing_pages is
  'The landing page a kit buyer pastes in onboarding and uses to sell the offer.';

alter table public.kit_landing_pages enable row level security;

revoke all on table public.kit_landing_pages from public, anon, authenticated;
grant select, insert, update on table public.kit_landing_pages to authenticated;
grant all on table public.kit_landing_pages to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kit_landing_pages'
      and policyname = 'kit_landing_pages_select_own'
  ) then
    create policy kit_landing_pages_select_own
      on public.kit_landing_pages
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kit_landing_pages'
      and policyname = 'kit_landing_pages_insert_own'
  ) then
    create policy kit_landing_pages_insert_own
      on public.kit_landing_pages
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kit_landing_pages'
      and policyname = 'kit_landing_pages_update_own'
  ) then
    create policy kit_landing_pages_update_own
      on public.kit_landing_pages
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

create or replace function public.kit_landing_pages_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.kit_landing_pages_set_updated_at() from public, anon;
grant execute on function public.kit_landing_pages_set_updated_at() to authenticated, service_role;

drop trigger if exists kit_landing_pages_set_updated_at on public.kit_landing_pages;
create trigger kit_landing_pages_set_updated_at
  before update on public.kit_landing_pages
  for each row
  execute function public.kit_landing_pages_set_updated_at();
