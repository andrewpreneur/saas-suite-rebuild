-- One Feature Kit first-party funnel events.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- Step names are the FUNNEL_ROUTES keys: sales, checkout, ghl, launch, webinar, thanks.
-- Clients may insert every event except purchase. service_role writes purchase rows.
-- There is no select policy for anon or authenticated.

create table if not exists public.kit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null check (char_length(session_id) between 8 and 64),
  step text not null check (step in ('sales','checkout','ghl','launch','webinar','thanks')),
  event text not null check (event in ('view','cta_click','checkout_start','bump_add','bump_remove','upsell_accept','upsell_decline','purchase')),
  line_id text check (line_id is null or line_id in ('kit','bump-replay','bump-video','bump-install','launch','webinar-system')),
  amount_cents integer check (amount_cents is null or amount_cents between 0 and 1000000),
  checkout_session_id text check (checkout_session_id is null or (char_length(checkout_session_id) <= 255 and checkout_session_id ~ '^cs_(live|test)_[A-Za-z0-9]+$')),
  utm_source text check (char_length(utm_source) <= 200),
  utm_medium text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content text check (char_length(utm_content) <= 200),
  utm_term text check (char_length(utm_term) <= 200),
  fbclid text check (char_length(fbclid) <= 500),
  referrer text check (char_length(referrer) <= 500),
  ua_hash text check (ua_hash is null or ua_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.kit_events is
  'One Feature Kit funnel events for one browser session. Clients insert steps and clicks. Only service_role inserts purchase, after kit_purchases is saved.';

create index if not exists kit_events_created_at_idx on public.kit_events (created_at);
create index if not exists kit_events_session_created_idx on public.kit_events (session_id, created_at);
create index if not exists kit_events_checkout_session_idx on public.kit_events (checkout_session_id) where checkout_session_id is not null;

alter table public.kit_events enable row level security;

revoke all on table public.kit_events from public, anon, authenticated;
grant insert (
  session_id,
  step,
  event,
  line_id,
  amount_cents,
  checkout_session_id,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term,
  fbclid,
  referrer,
  ua_hash
) on table public.kit_events to anon, authenticated;
grant all on table public.kit_events to service_role;

drop policy if exists kit_events_client_insert on public.kit_events;
create policy kit_events_client_insert
  on public.kit_events
  for insert
  to anon, authenticated
  with check (event <> 'purchase');

drop policy if exists kit_events_service on public.kit_events;
create policy kit_events_service
  on public.kit_events
  for all
  to service_role
  using (true)
  with check (true);
