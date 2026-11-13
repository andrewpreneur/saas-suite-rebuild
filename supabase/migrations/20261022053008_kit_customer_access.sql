-- One Feature Kit customer directory for the platform admin.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- It does not update saas_suite_users and does not change anyone's plan.
-- Buyers can save their own tracker marks. The platform admin can read the directory.

create table if not exists public.kit_onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  completed text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint kit_onboarding_progress_email_lower check (email is null or email = lower(email)),
  constraint kit_onboarding_progress_email_len check (email is null or char_length(email) <= 320),
  constraint kit_onboarding_progress_steps check (
    completed <@ array[
      'replay',
      'install-saas',
      'install-snapshot',
      'customize-video',
      'saas-training',
      'menu-training',
      'sales-page',
      'launch-ads',
      'launch-video'
    ]::text[]
  )
);

comment on table public.kit_onboarding_progress is
  'Kit tracker steps a buyer marked done. Confirmed steps still come from install, landing page, and ad-request rows.';

alter table public.kit_onboarding_progress enable row level security;

revoke all on table public.kit_onboarding_progress from public, anon, authenticated;
grant select, insert, update on table public.kit_onboarding_progress to authenticated;
grant all on table public.kit_onboarding_progress to service_role;

drop policy if exists kit_onboarding_progress_select_own on public.kit_onboarding_progress;
create policy kit_onboarding_progress_select_own
  on public.kit_onboarding_progress
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists kit_onboarding_progress_insert_own on public.kit_onboarding_progress;
create policy kit_onboarding_progress_insert_own
  on public.kit_onboarding_progress
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (email is null or email = public.current_auth_email())
  );

drop policy if exists kit_onboarding_progress_update_own on public.kit_onboarding_progress;
create policy kit_onboarding_progress_update_own
  on public.kit_onboarding_progress
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (email is null or email = public.current_auth_email())
  );

drop policy if exists kit_onboarding_progress_select_platform_admin on public.kit_onboarding_progress;
create policy kit_onboarding_progress_select_platform_admin
  on public.kit_onboarding_progress
  for select
  to authenticated
  using (public.is_platform_admin());

create or replace function public.kit_onboarding_progress_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.kit_onboarding_progress_set_updated_at() from public, anon;
grant execute on function public.kit_onboarding_progress_set_updated_at() to authenticated, service_role;

drop trigger if exists kit_onboarding_progress_set_updated_at on public.kit_onboarding_progress;
create trigger kit_onboarding_progress_set_updated_at
  before update on public.kit_onboarding_progress
  for each row
  execute function public.kit_onboarding_progress_set_updated_at();

-- Platform admin reads. Buyers keep their existing own-row policies.
grant select on table public.funnel_onboarding to authenticated;

drop policy if exists kit_purchases_select_platform_admin on public.kit_purchases;
create policy kit_purchases_select_platform_admin
  on public.kit_purchases
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists kit_landing_pages_select_platform_admin on public.kit_landing_pages;
create policy kit_landing_pages_select_platform_admin
  on public.kit_landing_pages
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists kit_ad_requests_select_platform_admin on public.kit_ad_requests;
create policy kit_ad_requests_select_platform_admin
  on public.kit_ad_requests
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists funnel_onboarding_select_platform_admin on public.funnel_onboarding;
create policy funnel_onboarding_select_platform_admin
  on public.funnel_onboarding
  for select
  to authenticated
  using (public.is_platform_admin());

create or replace function public.admin_kit_customers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    return '[]'::jsonb;
  end if;

  with purchases as (
    select
      email,
      min(created_at) as purchase_at,
      max(created_at) as last_purchase_at,
      array_agg(distinct line_id order by line_id) as line_ids,
      bool_or(comped) as comped
    from public.kit_purchases
    group by email
  ),
  signup_users as (
    select distinct lower(email) as email
    from public.saas_suite_users
    where email is not null
      and (
        trial_source = 'one_feature_kit_30day'
        or coalesce(landing_page, '') ilike '%one-feature-kit%'
        or coalesce(landing_page, '') ilike '%onefeaturekit%'
        or coalesce(checkout_page, '') ilike '%one-feature-kit%'
        or coalesce(checkout_page, '') ilike '%onefeaturekit%'
        or coalesce(referrer, '') ilike '%one-feature-kit%'
        or coalesce(referrer, '') ilike '%onefeaturekit%'
        or coalesce(source, '') ilike '%one-feature-kit%'
        or coalesce(source, '') ilike '%onefeaturekit%'
      )
  ),
  form_users as (
    select distinct lower(f.email) as email
    from public.funnel_onboarding f
    join public.saas_suite_users u on lower(u.email) = lower(f.email)
    where f.email is not null
      and coalesce(f.source, '') ilike '%one-feature%'
  ),
  people as (
    select email from purchases
    union
    select email from signup_users
    union
    select email from form_users
  ),
  users_one as (
    select distinct on (lower(u.email))
      lower(u.email) as email,
      u.full_name,
      u.agency_name,
      u.agency_id,
      u.agency_id_basic,
      u.agency_id_advanced,
      u.agency_id_elite,
      u.last_accessed,
      u.last_login_at,
      u.install_confirmed_at,
      u.videos_watched_count
    from public.saas_suite_users u
    join people p on p.email = lower(u.email)
    order by lower(u.email), u.created_at desc
  ),
  landings as (
    select distinct on (email)
      email,
      url,
      updated_at
    from (
      select lower(lp.email) as email, lp.url, lp.updated_at
      from public.kit_landing_pages lp
      where lp.email is not null
      union all
      select lower(au.email) as email, lp.url, lp.updated_at
      from public.kit_landing_pages lp
      join auth.users au on au.id = lp.user_id
      where au.email is not null
    ) rows
    order by email, updated_at desc
  ),
  ads as (
    select email, count(*)::int as ad_request_count, max(created_at) as last_ad_at
    from public.kit_ad_requests
    group by email
  ),
  progress as (
    select distinct on (lower(email))
      lower(email) as email,
      completed,
      updated_at
    from public.kit_onboarding_progress
    where email is not null
    order by lower(email), updated_at desc
  ),
  menu as (
    select
      u.email,
      exists (
        select 1
        from public.agency_menu_config m
        where m.agency_id in (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
          and (
            coalesce(btrim(m.menu_link_id), '') <> ''
            or coalesce(btrim(m.menu_link_id_2), '') <> ''
          )
      ) as menu_linked
    from users_one u
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'email', people.email,
      'name', users_one.full_name,
      'agencyName', users_one.agency_name,
      'agencyId', users_one.agency_id,
      'purchaseAt', purchases.purchase_at,
      'access', (
        select coalesce(jsonb_agg(to_jsonb(kinds.kind)), '[]'::jsonb)
        from (
          select 'purchase'::text as kind where purchases.email is not null
          union all
          select 'signup'::text where signup_users.email is not null or form_users.email is not null
        ) kinds
      ),
      'purchasedLineIds', coalesce(to_jsonb(purchases.line_ids), '[]'::jsonb),
      'comped', coalesce(purchases.comped, false),
      'lastActivity', (
        select max(v) from unnest(array[
          users_one.last_accessed,
          users_one.last_login_at,
          purchases.last_purchase_at,
          landings.updated_at,
          progress.updated_at,
          ads.last_ad_at
        ]) as v
      ),
      'landingPageUrl', landings.url,
      'installConfirmedAt', users_one.install_confirmed_at,
      'menuLinked', coalesce(menu.menu_linked, false),
      'adRequestCount', coalesce(ads.ad_request_count, 0),
      'completedStepIds', coalesce(to_jsonb(progress.completed), '[]'::jsonb),
      'videosWatchedCount', users_one.videos_watched_count
    )
    order by purchases.purchase_at desc nulls last, people.email
  ), '[]'::jsonb)
  into result
  from people
  left join purchases on purchases.email = people.email
  left join signup_users on signup_users.email = people.email
  left join form_users on form_users.email = people.email
  left join users_one on users_one.email = people.email
  left join landings on landings.email = people.email
  left join ads on ads.email = people.email
  left join progress on progress.email = people.email
  left join menu on menu.email = people.email;

  return result;
end;
$$;

comment on function public.admin_kit_customers() is
  'Platform admin directory of One Feature Kit customers. Returns [] for every other login. Does not write.';

revoke all on function public.admin_kit_customers() from public, anon, authenticated;
grant execute on function public.admin_kit_customers() to authenticated;
