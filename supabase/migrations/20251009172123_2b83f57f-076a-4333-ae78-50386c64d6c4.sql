-- Create table for LevelUp Summit connections
CREATE TABLE public.levelup_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.levelup_connections ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert their phone number
CREATE POLICY "Anyone can submit their phone number"
ON public.levelup_connections
FOR INSERT
WITH CHECK (true);

-- Create policy for authenticated users to view connections
CREATE POLICY "Authenticated users can view connections"
ON public.levelup_connections
FOR SELECT
USING (auth.role() = 'authenticated');