-- Create admin_lists table for smart lists
CREATE TABLE public.admin_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_list_members table for list memberships
CREATE TABLE public.admin_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.admin_lists(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_email)
);

-- Enable RLS
ALTER TABLE public.admin_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_list_members ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only (authenticated users)
CREATE POLICY "Authenticated users can manage admin_lists"
ON public.admin_lists
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage admin_list_members"
ON public.admin_list_members
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create updated_at trigger for admin_lists
CREATE TRIGGER update_admin_lists_updated_at
  BEFORE UPDATE ON public.admin_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_tool_data_updated_at();