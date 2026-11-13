-- One Feature Kit entitlements.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- Service role writes. A signed-in user can read, and can set user_id on, only the rows
-- whose email matches their own login email.

create table public.kit_purchases (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  stripe_customer_id text,
  checkout_session_id text not null,
  line_id text not null,
  stripe_price_id text,
  payment_intent_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  comped boolean not null default false,
  promotion_code_id text,
  source text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kit_purchases_email_lower check (email = lower(email)),
  constraint kit_purchases_email_shape check (position('@' in email) > 1),
  constraint kit_purchases_line check (line_id in (
    'kit', 'bump-replay', 'bump-video', 'bump-install', 'launch', 'webinar-system'
  )),
  constraint kit_purchases_source check (source in ('checkout', 'upsell')),
  constraint kit_purchases_amount_nonnegative check (amount_cents >= 0),
  constraint kit_purchases_session_line unique (checkout_session_id, line_id)
);

comment on table public.kit_purchases is
  'What a One Feature Kit buyer owns. One row per checkout session and catalog line. Idempotent on (checkout_session_id, line_id).';

create index kit_purchases_email_idx on public.kit_purchases (email);
create index kit_purchases_user_idx on public.kit_purchases (user_id);

alter table public.kit_purchases enable row level security;

revoke all on table public.kit_purchases from anon, authenticated;
grant select on table public.kit_purchases to authenticated;
grant update (user_id) on table public.kit_purchases to authenticated;
grant all on table public.kit_purchases to service_role;

create policy kit_purchases_select_own
  on public.kit_purchases
  for select
  to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy kit_purchases_attach_own
  on public.kit_purchases
  for update
  to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (
    email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and user_id = auth.uid()
  );

create policy kit_purchases_service
  on public.kit_purchases
  for all
  to service_role
  using (true)
  with check (true);
