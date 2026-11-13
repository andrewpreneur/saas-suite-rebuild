-- Public SaaS directory waitlist.
-- Ship this file in the PR only. Do not apply it to the live project from an agent.
-- Inserts go through the saas-partner-waitlist edge function (service role).
-- There is no public read and no anon or authenticated insert.

create table public.saas_partner_waitlist (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  website text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  affiliate_link text,
  logo_path text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  user_agent text,
  ip_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint saas_partner_waitlist_business_name_len check (char_length(btrim(business_name)) between 2 and 120),
  constraint saas_partner_waitlist_contact_name_len check (char_length(btrim(contact_name)) between 2 and 120),
  constraint saas_partner_waitlist_email_len check (char_length(email) between 5 and 320),
  constraint saas_partner_waitlist_email_lower check (email = lower(email)),
  constraint saas_partner_waitlist_phone_len check (char_length(btrim(phone)) between 7 and 40),
  constraint saas_partner_waitlist_website_len check (char_length(website) between 8 and 500),
  constraint saas_partner_waitlist_affiliate_len check (affiliate_link is null or char_length(affiliate_link) between 8 and 500),
  constraint saas_partner_waitlist_logo_len check (logo_path is null or char_length(logo_path) between 1 and 300),
  constraint saas_partner_waitlist_source_len check (source is null or char_length(source) between 1 and 80),
  constraint saas_partner_waitlist_utm_source_len check (utm_source is null or char_length(utm_source) <= 200),
  constraint saas_partner_waitlist_utm_medium_len check (utm_medium is null or char_length(utm_medium) <= 200),
  constraint saas_partner_waitlist_utm_campaign_len check (utm_campaign is null or char_length(utm_campaign) <= 200),
  constraint saas_partner_waitlist_utm_content_len check (utm_content is null or char_length(utm_content) <= 200),
  constraint saas_partner_waitlist_utm_term_len check (utm_term is null or char_length(utm_term) <= 200),
  constraint saas_partner_waitlist_ua_len check (user_agent is null or char_length(user_agent) <= 500),
  constraint saas_partner_waitlist_ip_hash_len check (ip_hash is null or char_length(ip_hash) = 64),
  constraint saas_partner_waitlist_status_check check (status in ('pending', 'approved', 'rejected', 'spam'))
);

comment on table public.saas_partner_waitlist is
  'SaaS directory waitlist. Written only by the saas-partner-waitlist edge function.';

create unique index saas_partner_waitlist_email_website_idx
  on public.saas_partner_waitlist (lower(email), website);

create index saas_partner_waitlist_ip_hash_created_idx
  on public.saas_partner_waitlist (ip_hash, created_at desc);

alter table public.saas_partner_waitlist enable row level security;

revoke all on table public.saas_partner_waitlist from public, anon, authenticated;
grant all on table public.saas_partner_waitlist to service_role;

-- No policies for anon or authenticated: RLS with no policy denies public read and direct insert.
-- The service role bypasses RLS and is the only writer.

insert into storage.buckets (id, name, public)
values ('saas-partner-logos', 'saas-partner-logos', false);

comment on column public.saas_partner_waitlist.logo_path is
  'Object path in the private saas-partner-logos bucket. Not a public URL.';
