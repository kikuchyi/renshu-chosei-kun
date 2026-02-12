-- Add time range columns to groups table
ALTER TABLE public.groups 
  ADD COLUMN start_hour INTEGER DEFAULT 5 NOT NULL,
  ADD COLUMN end_hour INTEGER DEFAULT 29 NOT NULL;

-- Comment for explanation
COMMENT ON COLUMN public.groups.start_hour IS 'Display start hour (0-23)';
COMMENT ON COLUMN public.groups.end_hour IS 'Display end hour (can be > 24 for next day)';
