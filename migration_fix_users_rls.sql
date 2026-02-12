-- Allow group members to see each other's profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "Users can view members of their groups" ON public.users
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members as gm1
        JOIN public.group_members as gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = public.users.id
    )
    OR auth.uid() = id
);
