DELETE FROM public.webinar_funnel_purchases WHERE note LIKE 'Manually recorded MRR per Andrew%';
INSERT INTO public.webinar_funnel_purchases (customer_label, amount, interval, purchased_at, note)
VALUES
  ('Webinar sale 1', 97, 'monthly', '2026-09-22', 'Recorded live webinar sale (Advanced $97/mo)'),
  ('Webinar sale 2', 97, 'monthly', '2026-09-22', 'Recorded live webinar sale (Advanced $97/mo)'),
  ('Webinar sale 3', 87, 'monthly', '2026-09-22', 'Recorded live webinar sale ($87/mo)');