GRANT EXECUTE ON FUNCTION public.support_can_see_chat(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_can_see_ticket(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_can_edit_ticket(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_admin_row(text) TO anon, authenticated;