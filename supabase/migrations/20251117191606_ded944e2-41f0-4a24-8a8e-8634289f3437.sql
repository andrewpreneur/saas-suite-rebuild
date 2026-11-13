-- Add source column to text_requests table
ALTER TABLE text_requests
ADD COLUMN source text NOT NULL DEFAULT 'unknown';