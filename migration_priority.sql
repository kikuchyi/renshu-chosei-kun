-- Add priority column to availabilities table
-- Priority levels: 1 = △ (reluctant/できれば避けたい)
-- Future expansion: 2 = ○, 3 = ◎, etc.

ALTER TABLE availabilities 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1 CHECK (priority IN (1));

-- Update existing records to have priority = 1
UPDATE availabilities 
SET priority = 1 
WHERE priority IS NULL;
