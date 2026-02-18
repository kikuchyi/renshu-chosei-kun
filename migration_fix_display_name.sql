-- Fix: Update the trigger to correctly extract display_name from Google OAuth metadata
-- Google provides name under 'full_name' or 'name', not 'display_name'

-- 1. Update the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)  -- fallback to email prefix
    ),
    COALESCE(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(
      EXCLUDED.display_name,
      public.users.display_name
    ),
    avatar_url = COALESCE(
      EXCLUDED.avatar_url,
      public.users.avatar_url
    );
  RETURN new;
END;
$$;

-- 2. Backfill: Update existing users that have NULL display_name
UPDATE public.users
SET
  display_name = COALESCE(
    (SELECT raw_user_meta_data ->> 'display_name' FROM auth.users WHERE auth.users.id = public.users.id),
    (SELECT raw_user_meta_data ->> 'full_name' FROM auth.users WHERE auth.users.id = public.users.id),
    (SELECT raw_user_meta_data ->> 'name' FROM auth.users WHERE auth.users.id = public.users.id),
    split_part(public.users.email, '@', 1)
  ),
  avatar_url = COALESCE(
    public.users.avatar_url,
    (SELECT raw_user_meta_data ->> 'avatar_url' FROM auth.users WHERE auth.users.id = public.users.id),
    (SELECT raw_user_meta_data ->> 'picture' FROM auth.users WHERE auth.users.id = public.users.id)
  )
WHERE display_name IS NULL OR display_name = '';

-- 3. Also insert any auth.users that are completely missing from public.users
INSERT INTO public.users (id, email, display_name, avatar_url)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data ->> 'display_name',
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    split_part(au.email, '@', 1)
  ),
  COALESCE(
    au.raw_user_meta_data ->> 'avatar_url',
    au.raw_user_meta_data ->> 'picture'
  )
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users);
