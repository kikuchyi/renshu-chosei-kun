-- Drop table if it exists to ensure fresh start
drop table if exists public.availabilities;

-- Create availabilities table
create table public.availabilities (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  group_id uuid references public.groups(id) on delete cascade not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index availabilities_group_id_idx on public.availabilities(group_id);
create index availabilities_user_id_idx on public.availabilities(user_id);
create index availabilities_time_range_idx on public.availabilities(start_time, end_time);

-- RLS Policies
alter table public.availabilities enable row level security;

-- Members can view all availabilities in their groups
create policy "Members can view group availabilities"
  on public.availabilities for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = availabilities.group_id
      and group_members.user_id = auth.uid()
    )
  );

-- Users can insert their own availability
create policy "Users can insert own availability"
  on public.availabilities for insert
  with check (
    auth.uid() = user_id
    and exists (
        select 1 from public.group_members
        where group_members.group_id = availabilities.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Users can delete their own availability
create policy "Users can delete own availability"
  on public.availabilities for delete
  using (auth.uid() = user_id);
