-- Agencies that run their own support stay out of SaaS Suite's platform queue.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
--
-- Config list, not a hardcoded agency. Add another agency with:
--   insert into public.platform_support_excluded_agencies (owner_email, reason)
--   values ('owner@example.com', 'runs own support');
-- The helper then hides every plan id on that owner's saas_suite_users row
-- (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite), ignoring a
-- trailing "NO" and letter case.
--
-- launch360's owner email is not in the repo (the only mention is a test fixture
-- location id). The INSERT SELECT below resolves lower(email) from saas_suite_users
-- when this migration runs, matching agency_id / agency_id_basic / agency_id_advanced
-- / agency_id_elite to 'launch360%' after the same normalization. buzzbull is seeded
-- the same way, and curtisv@buzzbullmarketing.com is inserted explicitly as well.
--
-- Platform notifications fail closed: edge functions skip the Grok handover, the
-- LeadConnector ping, and the admin queue when this lookup errors. Agency support
-- (assignee alerts, in-account views, auto-assign, end-user ticket creation) does
-- not call the helper except inside is_platform_admin() branches, so a lookup
-- error cannot hide an agency's own queue.

create table if not exists public.platform_support_excluded_agencies (
  owner_email text primary key,
  reason text,
  created_at timestamptz not null default now(),
  constraint platform_support_excluded_agencies_email_lower check (owner_email = lower(owner_email)),
  constraint platform_support_excluded_agencies_email_shape check (position('@' in owner_email) > 1)
);

comment on table public.platform_support_excluded_agencies is
  'Owners whose customer chats, handovers, and tickets must not appear in SaaS Suite platform support. Keyed by owner email so every plan agency id on that account is excluded.';

alter table public.platform_support_excluded_agencies enable row level security;

revoke all on table public.platform_support_excluded_agencies from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_support_excluded_agencies to authenticated;
grant all on table public.platform_support_excluded_agencies to service_role;

drop policy if exists "Platform admins select excluded agencies" on public.platform_support_excluded_agencies;
create policy "Platform admins select excluded agencies"
  on public.platform_support_excluded_agencies
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admins insert excluded agencies" on public.platform_support_excluded_agencies;
create policy "Platform admins insert excluded agencies"
  on public.platform_support_excluded_agencies
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists "Platform admins update excluded agencies" on public.platform_support_excluded_agencies;
create policy "Platform admins update excluded agencies"
  on public.platform_support_excluded_agencies
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Platform admins delete excluded agencies" on public.platform_support_excluded_agencies;
create policy "Platform admins delete excluded agencies"
  on public.platform_support_excluded_agencies
  for delete to authenticated
  using (public.is_platform_admin());

drop policy if exists "Service role manages excluded agencies" on public.platform_support_excluded_agencies;
create policy "Service role manages excluded agencies"
  on public.platform_support_excluded_agencies
  for all to service_role
  using (true)
  with check (true);

create index if not exists saas_suite_users_lower_email_idx
  on public.saas_suite_users (lower(email));

create or replace function public.platform_support_agency_key(p_agency_id text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p_agency_id, '')), 'NO$', '', 'i')), '');
$$;

comment on function public.platform_support_agency_key(text) is
  'Normalize an agency id for platform-support matching: trim, strip one trailing NO, lowercase. Blank becomes null.';

create or replace function public.is_platform_support_excluded(p_agency_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_support_excluded_agencies ex
    join public.saas_suite_users ssu
      on lower(ssu.email) = ex.owner_email
    where public.platform_support_agency_key(p_agency_id) is not null
      and public.platform_support_agency_key(p_agency_id) in (
        public.platform_support_agency_key(ssu.agency_id),
        public.platform_support_agency_key(ssu.agency_id_basic),
        public.platform_support_agency_key(ssu.agency_id_advanced),
        public.platform_support_agency_key(ssu.agency_id_elite)
      )
  );
$$;

comment on function public.is_platform_support_excluded(text) is
  'True when this agency id is one of the plan ids of an owner on platform_support_excluded_agencies. Blank ids are not excluded.';

create or replace function public.platform_support_excluded_agency_ids()
returns table (agency_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct keys.agency_id
  from public.platform_support_excluded_agencies ex
  join public.saas_suite_users ssu
    on lower(ssu.email) = ex.owner_email
  cross join lateral (
    values
      (public.platform_support_agency_key(ssu.agency_id)),
      (public.platform_support_agency_key(ssu.agency_id_basic)),
      (public.platform_support_agency_key(ssu.agency_id_advanced)),
      (public.platform_support_agency_key(ssu.agency_id_elite))
  ) as keys(agency_id)
  where keys.agency_id is not null;
$$;

comment on function public.platform_support_excluded_agency_ids() is
  'Every plan agency id belonging to an excluded owner. Used by the platform admin support API so those rows are omitted before the response is built.';

revoke all on function public.platform_support_agency_key(text) from public, anon;
revoke all on function public.is_platform_support_excluded(text) from public, anon;
revoke all on function public.platform_support_excluded_agency_ids() from public, anon, authenticated;
grant execute on function public.platform_support_agency_key(text) to authenticated, service_role;
grant execute on function public.is_platform_support_excluded(text) to authenticated, service_role;
grant execute on function public.platform_support_excluded_agency_ids() to service_role;

-- Platform admin still sees every other agency. Excluded owners disappear from
-- the admin inbox only. Agency members are not platform admins, so their own
-- support_can_see_* result is unchanged.
create or replace function public.support_can_see_ticket(p_agency_id text, p_assigned_to text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare r public.account_admins;
begin
  if public.is_platform_admin() then
    if public.is_platform_support_excluded(p_agency_id) then
      return false;
    end if;
    return true;
  end if;
  r := public.support_admin_row(p_agency_id);
  if r.id is null then return true; end if;
  if coalesce(r.permissions->>'support_tickets', 'edit') = 'none' then return false; end if;
  if r.restrict_assigned_tickets and lower(coalesce(p_assigned_to, '')) <> public.current_auth_email() then return false; end if;
  return true;
end $$;

create or replace function public.support_can_edit_ticket(p_agency_id text, p_assigned_to text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare r public.account_admins;
begin
  if public.is_platform_admin() then
    if public.is_platform_support_excluded(p_agency_id) then
      return false;
    end if;
    return true;
  end if;
  r := public.support_admin_row(p_agency_id);
  if r.id is null then return true; end if;
  if coalesce(r.permissions->>'support_tickets', 'edit') <> 'edit' then return false; end if;
  if r.restrict_assigned_tickets and lower(coalesce(p_assigned_to, '')) <> public.current_auth_email() then return false; end if;
  return true;
end $$;

create or replace function public.support_can_see_chat(p_agency_id text, p_user_identifier text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare r public.account_admins;
begin
  if public.is_platform_admin() then
    if public.is_platform_support_excluded(p_agency_id) then
      return false;
    end if;
    return true;
  end if;
  r := public.support_admin_row(p_agency_id);
  if r.id is null then return true; end if;
  if coalesce(r.permissions->>'support_chats', 'edit') = 'none' then return false; end if;
  if r.restrict_assigned_chats then
    return exists (
      select 1 from public.support_chat_assignments a
      where a.agency_id = p_agency_id
        and lower(btrim(a.user_identifier)) = lower(btrim(coalesce(p_user_identifier, '')))
        and lower(coalesce(a.assigned_to_email, '')) = public.current_auth_email()
    );
  end if;
  return true;
end $$;

create or replace function public.can_manage_agency_message(_agency_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_platform_admin()
    and not public.is_platform_support_excluded(_agency_id)
  ) or exists (
    select 1 from public.saas_suite_users u
    where lower(trim(u.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and lower(trim(_agency_id)) in (
        lower(trim(coalesce(u.agency_id, ''))),
        lower(trim(coalesce(u.agency_id_basic, ''))),
        lower(trim(coalesce(u.agency_id_advanced, ''))),
        lower(trim(coalesce(u.agency_id_elite, '')))
      )
  );
$$;

insert into public.platform_support_excluded_agencies (owner_email, reason)
values ('curtisv@buzzbullmarketing.com', 'runs own support')
on conflict (owner_email) do nothing;

insert into public.platform_support_excluded_agencies (owner_email, reason)
select distinct lower(btrim(ssu.email)), 'runs own support'
from public.saas_suite_users ssu
where btrim(coalesce(ssu.email, '')) <> ''
  and (
    public.platform_support_agency_key(ssu.agency_id) like 'buzzbull%'
    or public.platform_support_agency_key(ssu.agency_id_basic) like 'buzzbull%'
    or public.platform_support_agency_key(ssu.agency_id_advanced) like 'buzzbull%'
    or public.platform_support_agency_key(ssu.agency_id_elite) like 'buzzbull%'
  )
on conflict (owner_email) do nothing;

insert into public.platform_support_excluded_agencies (owner_email, reason)
select distinct lower(btrim(ssu.email)), 'runs own support'
from public.saas_suite_users ssu
where btrim(coalesce(ssu.email, '')) <> ''
  and (
    public.platform_support_agency_key(ssu.agency_id) like 'launch360%'
    or public.platform_support_agency_key(ssu.agency_id_basic) like 'launch360%'
    or public.platform_support_agency_key(ssu.agency_id_advanced) like 'launch360%'
    or public.platform_support_agency_key(ssu.agency_id_elite) like 'launch360%'
  )
on conflict (owner_email) do nothing;
