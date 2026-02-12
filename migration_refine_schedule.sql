-- Drop columns that are no longer needed
alter table public.groups
drop column if exists next_practice_date,
drop column if exists practice_location;
