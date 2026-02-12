-- Allow authenticated users to create groups
create policy "Users can create groups" on public.groups for insert with check (auth.role() = 'authenticated');

-- Allow users to view groups they are members of
create policy "Members can view groups" on public.groups for select using (
  exists (
    select 1 from public.group_members
    where group_members.group_id = groups.id
    and group_members.user_id = auth.uid()
  )
);

-- Allow authenticated users to join groups (insert into group_members)
create policy "Users can join groups" on public.group_members for insert with check (auth.uid() = user_id);

-- Allow members to view other members in the same group
create policy "Members can view members" on public.group_members for select using (
  exists (
    select 1 from public.group_members as gm
    where gm.group_id = group_members.group_id
    and gm.user_id = auth.uid()
  )
);

-- Allow members to view events in their groups
create policy "Members can view events" on public.events for select using (
  exists (
    select 1 from public.group_members
    where group_members.group_id = events.group_id
    and group_members.user_id = auth.uid()
  )
);

-- Allow members to create events in their groups
create policy "Members can create events" on public.events for insert with check (
  exists (
    select 1 from public.group_members
    where group_members.group_id = events.group_id
    and group_members.user_id = auth.uid()
  )
);
