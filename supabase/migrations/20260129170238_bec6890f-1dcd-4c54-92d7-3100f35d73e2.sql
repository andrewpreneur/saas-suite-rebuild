-- Update login_with to support BOTH option (keeping existing values valid)
-- No schema change needed - the column is already text type and can store 'EMAIL', 'NAME', or 'BOTH'

-- Create a table to track agency owner messages in AI chats
-- This allows agency owners to intervene in Native AI conversations
CREATE TABLE IF NOT EXISTS public.agency_owner_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id TEXT NOT NULL,
  user_identifier TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'agency_owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agency_owner_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert messages (agency owners sending messages)
CREATE POLICY "Authenticated users can insert agency_owner_messages"
  ON public.agency_owner_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow anyone to view messages (the client-facing chat app needs to read these)
CREATE POLICY "Anyone can view agency_owner_messages"
  ON public.agency_owner_messages
  FOR SELECT
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_agency_owner_messages_agency_user ON public.agency_owner_messages(agency_id, user_identifier);
CREATE INDEX idx_agency_owner_messages_created ON public.agency_owner_messages(created_at DESC);

-- Add a comment explaining the table purpose
COMMENT ON TABLE public.agency_owner_messages IS 'Stores messages sent by agency owners when intervening in Native AI chat conversations. These messages appear in the client chat alongside AI responses.';