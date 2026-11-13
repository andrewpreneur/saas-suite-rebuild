-- One Feature Kit thank-you onboarding.
-- Ships in the PR only. Do not apply this against the live project from the agent.
-- Visitors may insert a row. They cannot read, update, or delete.

create table if not exists public.funnel_onboarding (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  checkout_id text,
  first_name text,
  email text,
  phone text,
  order_lines jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  source text not null default 'one-feature-kit'
);

comment on table public.funnel_onboarding is
  'One Feature Kit thank-you onboarding. Order, contact, and every answer, including conditional DFY fields.';

alter table public.funnel_onboarding enable row level security;

revoke all on table public.funnel_onboarding from anon, authenticated;
grant insert on table public.funnel_onboarding to anon, authenticated;

create policy "anon and authenticated can insert funnel onboarding"
  on public.funnel_onboarding
  for insert
  to anon, authenticated
  with check (true);
