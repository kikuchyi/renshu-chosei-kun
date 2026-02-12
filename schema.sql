-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users table (public profile)
-- Note: Supabase automatically handles auth.users. Ideally, we use a trigger to create this record.
create table public.users (
  id uuid references auth.users not null primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Groups table
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  invite_code uuid default uuid_generate_v4() not null unique,
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Group Members table
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text check (role in ('admin', 'member')) default 'member' not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (group_id, user_id)
);

-- 4. Events table (Confirmed practice schedules)
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  title text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  location text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Policies (Examples)
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;

-- Only the user can view/edit their own profile
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
