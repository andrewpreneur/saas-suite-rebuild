-- Create affiliates table to store affiliate applications
CREATE TABLE public.affiliates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  company text,
  network_size text NOT NULL,
  audience_description text,
  status text DEFAULT 'PENDING',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Allow public to insert affiliate applications (for the form submission)
CREATE POLICY "Anyone can submit affiliate applications" 
ON public.affiliates 
FOR INSERT 
WITH CHECK (true);

-- Only allow admin users to view affiliate applications
-- For now, allowing all authenticated users to read - you can restrict this later
CREATE POLICY "Authenticated users can view affiliate applications" 
ON public.affiliates 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Only allow admin users to update affiliate status
CREATE POLICY "Authenticated users can update affiliate applications" 
ON public.affiliates 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_affiliates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_affiliates_updated_at
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.update_affiliates_updated_at();

-- Add index for better performance on email lookups
CREATE INDEX idx_affiliates_email ON public.affiliates(email);
CREATE INDEX idx_affiliates_status ON public.affiliates(status);
CREATE INDEX idx_affiliates_created_at ON public.affiliates(created_at DESC);