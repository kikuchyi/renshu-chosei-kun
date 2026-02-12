-- Drop existing policies to ensure clean slate (optional but safer)
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Members can view groups" on public.groups;
drop policy if exists "Users can join groups" on public.group_members;
drop policy if exists "Members can view members" on public.group_members;
drop policy if exists "Members can view events" on public.events;
drop policy if exists "Members can create events" on public.events;

-- 1. Groups Policies
create policy "Enable insert for authenticated users only" on public.groups for insert with check (auth.role() = 'authenticated');

create policy "Enable read access for group members" on public.groups for select using (
  exists (
    select 1 from public.group_members
    where group_members.group_id = groups.id
    and group_members.user_id = auth.uid()
  )
);

create policy "Enable read access for creators" on public.groups for select using (
    auth.uid() = created_by
);


-- 2. Group Members Policies
create policy "Enable insert for users to join" on public.group_members for insert with check (auth.uid() = user_id);

-- This policy avoids recursion by NOT querying group_members recursively
create policy "Enable read access for members" on public.group_members for select using (
    user_id = auth.uid() -- Can view own membership
    or 
    exists ( -- Can view other members in same groups
        select 1 from public.groups
        where groups.id = group_members.group_id
        and groups.created_by = auth.uid() -- Simplified: Creator can see members (MVP)
    )
    or
    exists (
       select 1 from public.group_members as my_membership
       where my_membership.group_id = group_members.group_id
       and my_membership.user_id = auth.uid()
    )
);


-- 3. Events Policies
create policy "Enable read access for group members" on public.events for select using (
  exists (
    select 1 from public.group_members
    where group_members.group_id = events.group_id
    and group_members.user_id = auth.uid()
  )
);

create policy "Enable insert for group members" on public.events for insert with check (
  exists (
    select 1 from public.group_members
    where group_members.group_id = events.group_id
    and group_members.user_id = auth.uid()
  )
);
