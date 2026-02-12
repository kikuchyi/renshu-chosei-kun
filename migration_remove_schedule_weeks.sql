-- Remove schedule_target_weeks column from groups table
ALTER TABLE groups DROP COLUMN IF EXISTS schedule_target_weeks;
