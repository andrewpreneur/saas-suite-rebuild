-- Create a table to store user tool data and progress
CREATE TABLE public.user_tool_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_tool_data ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own tool data" 
ON public.user_tool_data 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own tool data" 
ON public.user_tool_data 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own tool data" 
ON public.user_tool_data 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own tool data" 
ON public.user_tool_data 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_user_tool_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_tool_data_updated_at
BEFORE UPDATE ON public.user_tool_data
FOR EACH ROW
EXECUTE FUNCTION public.update_user_tool_data_updated_at();

-- Create unique index to prevent duplicate entries per user/tool
CREATE UNIQUE INDEX idx_user_tool_unique ON public.user_tool_data(user_email, tool_name);