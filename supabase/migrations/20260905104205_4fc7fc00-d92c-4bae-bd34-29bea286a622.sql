create or replace function public.refresh_branding_cache(_agency_ids text[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  aid text;
  base text := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/dynamic-styles';
begin
  foreach aid in array coalesce(_agency_ids, '{}'::text[]) loop
    if aid is null or btrim(aid) = '' then
      continue;
    end if;
    perform net.http_get(url := base || '?agency_id=' || urlencode(btrim(aid)) || '&type=css&force=1');
    perform net.http_get(url := base || '?agency_id=' || urlencode(btrim(aid)) || '&type=js&force=1');
  end loop;
end;
$$;

create or replace function public.trg_refresh_branding_cache_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if TG_OP = 'UPDATE' and (
      new.primary_color is distinct from old.primary_color
      or new.secondary_color is distinct from old.secondary_color
      or new.tertiary_color is distinct from old.tertiary_color
      or new.generated_css is distinct from old.generated_css
      or new.billing_state is distinct from old.billing_state
      or new.agency_id is distinct from old.agency_id
      or new.agency_id_basic is distinct from old.agency_id_basic
      or new.agency_id_advanced is distinct from old.agency_id_advanced
      or new.agency_id_elite is distinct from old.agency_id_elite
  ) then
    perform public.refresh_branding_cache(array[
      new.agency_id, new.agency_id_basic, new.agency_id_advanced, new.agency_id_elite,
      old.agency_id, old.agency_id_basic, old.agency_id_advanced, old.agency_id_elite
    ]);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_branding_cache_users on public.saas_suite_users;
create trigger trg_branding_cache_users
after update on public.saas_suite_users
for each row execute function public.trg_refresh_branding_cache_user();

create or replace function public.trg_refresh_branding_cache_agency()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.refresh_branding_cache(array[old.agency_id]);
    return old;
  end if;
  perform public.refresh_branding_cache(array[new.agency_id, old.agency_id]);
  return new;
end;
$$;

drop trigger if exists trg_branding_cache_menu_config on public.agency_menu_config;
create trigger trg_branding_cache_menu_config
after insert or update or delete on public.agency_menu_config
for each row execute function public.trg_refresh_branding_cache_agency();

drop trigger if exists trg_branding_cache_menu_rules on public.menu_link_rules;
create trigger trg_branding_cache_menu_rules
after insert or update or delete on public.menu_link_rules
for each row execute function public.trg_refresh_branding_cache_agency();