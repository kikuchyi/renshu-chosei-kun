-- 1. Create a function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- 2. Create the trigger on auth.users
-- Drop if exists to avoid errors on rerun
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Backfill existing users (CRITICAL for your current user)
-- This inserts any users from auth.users that are mostly missing from public.users
insert into public.users (id, email)
select id, email
from auth.users
where id not in (select id from public.users);
