-- Read-only. Today's One Feature Kit funnel, America/Chicago midnight to midnight.
-- Paste into the SQL editor. This statement only reads kit_events and kit_purchases.
--
-- Exclude test sessions opened with ?ofk_test=1. Clause: e.is_test is not true
-- (null and false still count). Apply migration
-- 20261022040000_kit_events_is_test.sql before running this. Until is_test
-- exists, this query errors because the column is missing.
--
-- kit_purchases is the source of truth for orders and revenue. Those rows are
-- joined to kit_events on checkout_session_id so the session's first event
-- can supply utm_source and utm_campaign. A purchase with no matching event
-- is listed as (unjoined).
--
-- Columns:
--   step_view       sessions = unique viewers, events = view rows, rate = vs previous step
--   cta_click       sessions = unique clickers, events = clicks
--   checkout_start  sessions = unique starters, events = start rows, rate = vs checkout views
--   bump_add        detail and line_id are the add-on
--   upsell          detail is upsell_accept or upsell_decline, line_id is the offer
--   purchase        sessions = distinct kit_purchases orders, events = lines,
--                   revenue_cents from kit_purchases, rate = orders / checkout starts
--   utm             detail is utm_source / utm_campaign, sessions = unique viewers,
--                   events = unique checkout starts, revenue_cents from joined kit_purchases

with bounds as (
  select
    timezone('America/Chicago', date_trunc('day', timezone('America/Chicago', now()))) as start_at,
    timezone('America/Chicago', date_trunc('day', timezone('America/Chicago', now())) + interval '1 day') as end_at
),
events as (
  select e.*
  from public.kit_events e
  cross join bounds b
  where e.created_at >= b.start_at
    and e.created_at < b.end_at
    and e.is_test is not true
),
purchases as (
  select p.*
  from public.kit_purchases p
  cross join bounds b
  where p.created_at >= b.start_at
    and p.created_at < b.end_at
),
steps as (
  select *
  from (
    values
      ('sales'::text, 1),
      ('checkout', 2),
      ('ghl', 3),
      ('launch', 4),
      ('webinar', 5),
      ('thanks', 6)
  ) as t(step, ord)
),
views as (
  select step, count(distinct session_id)::bigint as sessions, count(*)::bigint as events
  from events
  where event = 'view'
  group by step
),
view_rates as (
  select
    s.ord,
    s.step,
    coalesce(v.sessions, 0) as sessions,
    coalesce(v.events, 0) as events,
    lag(coalesce(v.sessions, 0)) over (order by s.ord) as previous_sessions
  from steps s
  left join views v on v.step = s.step
),
cta as (
  select step, count(distinct session_id)::bigint as sessions, count(*)::bigint as events
  from events
  where event = 'cta_click'
  group by step
),
checkout_starts as (
  select count(distinct session_id)::bigint as sessions, count(*)::bigint as events
  from events
  where event = 'checkout_start'
),
checkout_views as (
  select coalesce(max(sessions), 0)::bigint as sessions
  from views
  where step = 'checkout'
),
bumps as (
  select
    line_id,
    count(distinct session_id)::bigint as sessions,
    count(*)::bigint as events,
    row_number() over (order by line_id) as ord
  from events
  where event = 'bump_add'
  group by line_id
),
upsells as (
  select
    coalesce(line_id, '(none)') as line_id,
    event,
    count(distinct session_id)::bigint as sessions,
    count(*)::bigint as events,
    row_number() over (order by coalesce(line_id, ''), event) as ord
  from events
  where event in ('upsell_accept', 'upsell_decline')
  group by line_id, event
),
purchase_totals as (
  select
    count(distinct checkout_session_id)::bigint as orders,
    count(*)::bigint as lines,
    coalesce(sum(amount_cents), 0)::bigint as revenue_cents
  from purchases
),
first_touch as (
  select distinct on (session_id)
    session_id,
    coalesce(nullif(utm_source, ''), '(none)') as utm_source,
    coalesce(nullif(utm_campaign, ''), '(none)') as utm_campaign
  from events
  order by session_id, created_at
),
checkout_link as (
  select distinct on (checkout_session_id)
    checkout_session_id,
    session_id
  from events
  where checkout_session_id is not null
  order by checkout_session_id, created_at
),
purchase_attr as (
  select
    p.checkout_session_id,
    p.amount_cents,
    coalesce(ft.utm_source, '(unjoined)') as utm_source,
    coalesce(ft.utm_campaign, '(unjoined)') as utm_campaign
  from purchases p
  left join checkout_link cl on cl.checkout_session_id = p.checkout_session_id
  left join first_touch ft on ft.session_id = cl.session_id
),
utm_views as (
  select
    ft.utm_source,
    ft.utm_campaign,
    count(distinct e.session_id)::bigint as sessions
  from events e
  join first_touch ft on ft.session_id = e.session_id
  where e.event = 'view'
  group by ft.utm_source, ft.utm_campaign
),
utm_checkouts as (
  select
    ft.utm_source,
    ft.utm_campaign,
    count(distinct e.session_id)::bigint as sessions
  from events e
  join first_touch ft on ft.session_id = e.session_id
  where e.event = 'checkout_start'
  group by ft.utm_source, ft.utm_campaign
),
utm_purchases as (
  select
    utm_source,
    utm_campaign,
    count(distinct checkout_session_id)::bigint as orders,
    coalesce(sum(amount_cents), 0)::bigint as revenue_cents
  from purchase_attr
  group by utm_source, utm_campaign
),
utm_keys as (
  select utm_source, utm_campaign from utm_views
  union
  select utm_source, utm_campaign from utm_checkouts
  union
  select utm_source, utm_campaign from utm_purchases
),
utm_rows as (
  select
    k.utm_source,
    k.utm_campaign,
    coalesce(v.sessions, 0)::bigint as view_sessions,
    coalesce(c.sessions, 0)::bigint as checkout_sessions,
    coalesce(p.revenue_cents, 0)::bigint as revenue_cents,
    row_number() over (order by k.utm_source, k.utm_campaign) as ord
  from utm_keys k
  left join utm_views v on v.utm_source = k.utm_source and v.utm_campaign = k.utm_campaign
  left join utm_checkouts c on c.utm_source = k.utm_source and c.utm_campaign = k.utm_campaign
  left join utm_purchases p on p.utm_source = k.utm_source and p.utm_campaign = k.utm_campaign
),
report as (
  select
    10 as sort_group,
    vr.ord as sort_item,
    'step_view' as section,
    vr.step as detail,
    null::text as line_id,
    vr.sessions,
    vr.events,
    null::bigint as revenue_cents,
    case
      when vr.previous_sessions is null then null
      else round(vr.sessions::numeric / nullif(vr.previous_sessions, 0), 4)
    end as rate
  from view_rates vr

  union all

  select
    20,
    s.ord,
    'cta_click',
    s.step,
    null::text,
    coalesce(c.sessions, 0),
    coalesce(c.events, 0),
    null::bigint,
    null::numeric
  from steps s
  left join cta c on c.step = s.step

  union all

  select
    30,
    1,
    'checkout_start',
    'checkout',
    null::text,
    cs.sessions,
    cs.events,
    null::bigint,
    round(cs.sessions::numeric / nullif(cv.sessions, 0), 4)
  from checkout_starts cs
  cross join checkout_views cv

  union all

  select
    40,
    ord::integer,
    'bump_add',
    line_id,
    line_id,
    sessions,
    events,
    null::bigint,
    null::numeric
  from bumps

  union all

  select
    50,
    ord::integer,
    'upsell',
    event,
    line_id,
    sessions,
    events,
    null::bigint,
    null::numeric
  from upsells

  union all

  select
    60,
    1,
    'purchase',
    'kit_purchases',
    null::text,
    pt.orders,
    pt.lines,
    pt.revenue_cents,
    round(pt.orders::numeric / nullif((select sessions from checkout_starts), 0), 4)
  from purchase_totals pt

  union all

  select
    70,
    ord::integer,
    'utm',
    utm_source || ' / ' || utm_campaign,
    null::text,
    view_sessions,
    checkout_sessions,
    revenue_cents,
    null::numeric
  from utm_rows
)
select
  section,
  detail,
  line_id,
  sessions,
  events,
  revenue_cents,
  rate
from report
order by sort_group, sort_item, detail, line_id;
