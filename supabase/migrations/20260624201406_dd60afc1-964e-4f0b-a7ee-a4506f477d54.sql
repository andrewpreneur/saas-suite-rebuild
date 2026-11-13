UPDATE public.chat_threads ct
SET handover_requested_at = sub.first_handover_at
FROM (
  SELECT agency_id, lower(user_identifier) AS uid_l, MIN(created_at) AS first_handover_at
  FROM public.ai_chat_messages
  WHERE content ILIKE '%Human handover requested%'
  GROUP BY agency_id, lower(user_identifier)
) sub
WHERE ct.agency_id = sub.agency_id
  AND lower(ct.user_identifier) = sub.uid_l
  AND ct.handover_requested_at IS NULL;