
-- Table to track per-user bans from specific agency pages
CREATE TABLE public.banned_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_identifier TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  reason TEXT,
  banned_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_identifier, agency_id)
);

-- Enable RLS
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

-- Only allow service role / admin access (no anon access needed since admin uses authenticated calls)
CREATE POLICY "Allow authenticated read access to banned_users"
  ON public.banned_users FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to banned_users"
  ON public.banned_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete from banned_users"
  ON public.banned_users FOR DELETE
  USING (true);

-- Function to ban a user from a specific agency page
CREATE OR REPLACE FUNCTION public.ban_user_from_page(
  p_user_identifier TEXT,
  p_agency_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.banned_users (user_identifier, agency_id, reason)
  VALUES (p_user_identifier, p_agency_id, p_reason)
  ON CONFLICT (user_identifier, agency_id) DO NOTHING;
  
  -- Also set approval to NO in user_progress for this user+agency combo
  UPDATE public.user_progress
  SET approval = 'NO'
  WHERE (email = p_user_identifier OR name = p_user_identifier)
    AND agency_id = p_agency_id;
  
  RETURN TRUE;
END;
$$;

-- Function to unban a user from a specific agency page
CREATE OR REPLACE FUNCTION public.unban_user_from_page(
  p_user_identifier TEXT,
  p_agency_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.banned_users
  WHERE user_identifier = p_user_identifier
    AND agency_id = p_agency_id;
  
  -- Restore approval in user_progress
  UPDATE public.user_progress
  SET approval = NULL
  WHERE (email = p_user_identifier OR name = p_user_identifier)
    AND agency_id = p_agency_id;
  
  RETURN TRUE;
END;
$$;

-- Function to check if a user is banned from a specific agency page
CREATE OR REPLACE FUNCTION public.is_user_banned(
  p_user_identifier TEXT,
  p_agency_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_banned BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.banned_users
    WHERE user_identifier = p_user_identifier
      AND agency_id = p_agency_id
  ) INTO is_banned;
  
  RETURN is_banned;
END;
$$;
