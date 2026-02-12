-- Change invite_code type from UUID to TEXT
-- Note: existing UUID values will be converted to their string representation
ALTER TABLE public.groups 
  ALTER COLUMN invite_code TYPE TEXT,
  ALTER COLUMN invite_code DROP DEFAULT;
