-- Allow all authenticated users to read basic profile (display_name, avatar_url) of any user
-- This is needed so group members can see each other's names

-- Drop the restrictive "own profile only" SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Create a new policy that allows all authenticated users to SELECT from users table
CREATE POLICY "Authenticated users can view all profiles"
  ON public.users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Keep the UPDATE policy restricted to own profile only (already exists, but ensure it's there)
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
-- CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
