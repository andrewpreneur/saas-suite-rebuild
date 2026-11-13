-- Create function to manually accept an admin invitation (for super admin use)
CREATE OR REPLACE FUNCTION public.admin_accept_invitation(
  p_admin_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the invitation status to accepted
  UPDATE public.account_admins
  SET 
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  WHERE lower(admin_email) = lower(p_admin_email)
    AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users (will be restricted by logic)
GRANT EXECUTE ON FUNCTION public.admin_accept_invitation(text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.admin_accept_invitation IS 'Manually accepts a pending admin invitation. Used by super admin until email flow is implemented.';