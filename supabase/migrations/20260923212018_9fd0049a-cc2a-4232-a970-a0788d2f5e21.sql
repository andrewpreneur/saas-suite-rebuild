ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to text, ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
CREATE OR REPLACE FUNCTION public.get_ticket_assignments(ticket_ids uuid[])
RETURNS TABLE(id uuid, assigned_to text, assigned_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.assigned_to, t.assigned_at FROM public.support_tickets t WHERE t.id = ANY(ticket_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_ticket_assignments(uuid[]) TO anon, authenticated;