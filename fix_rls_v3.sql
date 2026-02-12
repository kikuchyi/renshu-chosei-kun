-- 1. Helper Function to avoid recursion (Security Definer)
-- This allows checking membership without triggering RLS policies recursively
create or replace function public.is_group_member(_group_id uuid)
returns boolean as $$
begin
  return exists (
    select 1
    from public.group_members
    where group_id = _group_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;


-- 2. Drop existing policies to start fresh
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Members can view groups" on public.groups;
drop policy if exists "Enable insert for authenticated users only" on public.groups;
drop policy if exists "Enable read access for group members" on public.groups;
drop policy if exists "Enable read access for creators" on public.groups;

drop policy if exists "Users can join groups" on public.group_members;
drop policy if exists "Members can view members" on public.group_members;
drop policy if exists "Enable insert for users to join" on public.group_members;
drop policy if exists "Enable read access for members" on public.group_members;

drop policy if exists "Members can view events" on public.events;
drop policy if exists "Members can create events" on public.events;
drop policy if exists "Enable read access for group members" on public.events;
drop policy if exists "Enable insert for group members" on public.events;


-- 3. Groups Policies
create policy "Groups: Authenticated users can create" 
  on public.groups for insert 
  with check (auth.role() = 'authenticated');

create policy "Groups: Members and Creators can view" 
  on public.groups for select 
  using (
    auth.uid() = created_by 
    or 
    is_group_member(id)
  );


-- 4. Group Members Policies
create policy "Members: Users can join (insert own)" 
  on public.group_members for insert 
  with check (auth.uid() = user_id);

create policy "Members: View own membership or co-members" 
  on public.group_members for select 
  using (
    user_id = auth.uid() 
    or 
    is_group_member(group_id)
  );


-- 5. Events Policies
create policy "Events: Members can view" 
  on public.events for select 
  using (is_group_member(group_id));

create policy "Events: Members can create" 
  on public.events for insert 
  with check (is_group_member(group_id));
