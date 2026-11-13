-- Add name column to text_requests table
ALTER TABLE text_requests
ADD COLUMN name text NOT NULL DEFAULT '';