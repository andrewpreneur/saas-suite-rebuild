-- Add name column to levelup_connections table
ALTER TABLE public.levelup_connections 
ADD COLUMN name TEXT NOT NULL DEFAULT '';

-- Update the column to allow null temporarily for existing records
ALTER TABLE public.levelup_connections 
ALTER COLUMN name DROP DEFAULT;

COMMENT ON COLUMN public.levelup_connections.name IS 'Full name of the person from LevelUp Summit';