-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.update_user_tool_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;