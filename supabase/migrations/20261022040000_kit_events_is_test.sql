-- Additive. Ship in the PR. Do not apply from an agent.
-- Marks One Feature Kit sessions opened with ?ofk_test=1.
-- Funnel analytics exclude them with: e.is_test is not true
-- (null and false still count). properties holds view_id, cta_location, and test.

alter table public.kit_events add column if not exists is_test boolean not null default false;
alter table public.kit_events add column if not exists properties jsonb;

comment on column public.kit_events.is_test is
  'True when the browser session was opened with ?ofk_test=1. Funnel analytics must exclude these rows with: e.is_test is not true';
comment on column public.kit_events.properties is
  'Optional client metadata: view_id, cta_location, test.';

grant insert (is_test, properties) on table public.kit_events to anon, authenticated;

create index if not exists kit_events_live_created_idx
  on public.kit_events (created_at)
  where is_test is not true;
