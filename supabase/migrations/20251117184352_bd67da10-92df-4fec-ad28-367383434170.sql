-- Create table for text message requests
CREATE TABLE IF NOT EXISTS public.text_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.text_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit text requests
CREATE POLICY "Anyone can submit text requests"
ON public.text_requests
FOR INSERT
WITH CHECK (true);

-- Allow authenticated users to view text requests
CREATE POLICY "Authenticated users can view text requests"
ON public.text_requests
FOR SELECT
USING (auth.role() = 'authenticated');