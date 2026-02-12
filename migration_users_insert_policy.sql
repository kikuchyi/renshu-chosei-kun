-- Allow authenticated users to insert their own profile
-- This is needed for the first-time login profile creation if a trigger is not used.
CREATE POLICY "Users can insert own profile" 
    ON public.users FOR INSERT 
    WITH CHECK (auth.uid() = id);
