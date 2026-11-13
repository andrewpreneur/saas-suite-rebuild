DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='copilot_chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.copilot_chat_messages';
  END IF;
END $$;

ALTER TABLE public.copilot_chat_messages REPLICA IDENTITY FULL;