-- 1. Drop events table (Data Loss Warning verified with user)
drop table if exists public.events;

-- 2. Alter groups table to add schedule columns
alter table public.groups
add column if not exists next_practice_date timestamptz,
add column if not exists practice_location text,
add column if not exists schedule_target_weeks int default 4;

-- 3. RLS Policies
-- Allow members to update the group (for schedule settings)
create policy "Groups: Members can update"
  on public.groups for update
  using (
    auth.uid() = created_by
    or
    is_group_member(id)
  );
