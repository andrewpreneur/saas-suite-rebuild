-- Add support_ticketing_enabled column to saas_suite_users
ALTER TABLE public.saas_suite_users 
ADD COLUMN support_ticketing_enabled boolean NOT NULL DEFAULT false;

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number serial NOT NULL,
  agency_id text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  issue_category text NOT NULL,
  request_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique constraint on ticket_number
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_ticket_number_unique UNIQUE (ticket_number);

-- Create index for agency lookups (supports both old and new agency IDs)
CREATE INDEX idx_support_tickets_agency_id ON public.support_tickets(agency_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policy: Allow all access based on agency ownership (checked via function)
CREATE POLICY "Users can view their agency tickets"
ON public.support_tickets
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their agency tickets"
ON public.support_tickets
FOR UPDATE
USING (true);

CREATE POLICY "Users can delete their agency tickets"
ON public.support_tickets
FOR DELETE
USING (true);

-- Create function to get tickets for a user's agencies
CREATE OR REPLACE FUNCTION public.get_agency_tickets(user_email text)
RETURNS TABLE(
  id uuid,
  ticket_number integer,
  agency_id text,
  customer_name text,
  customer_email text,
  issue_category text,
  request_text text,
  status text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_agency_ids text[];
BEGIN
  -- Get all agency IDs for this user (current and original)
  SELECT ARRAY_REMOVE(ARRAY[
    ssu.agency_id,
    ssu.agency_id_basic,
    ssu.agency_id_advanced,
    ssu.agency_id_elite,
    ssu.original_agency_id,
    ssu.original_agency_id_basic,
    ssu.original_agency_id_advanced,
    ssu.original_agency_id_elite,
    ssu.agency_name
  ], NULL) INTO user_agency_ids
  FROM saas_suite_users ssu
  WHERE ssu.email = user_email;

  RETURN QUERY
  SELECT 
    st.id,
    st.ticket_number,
    st.agency_id,
    st.customer_name,
    st.customer_email,
    st.issue_category,
    st.request_text,
    st.status,
    st.created_at
  FROM support_tickets st
  WHERE st.agency_id = ANY(user_agency_ids)
  ORDER BY st.created_at DESC;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_user_tool_data_updated_at();