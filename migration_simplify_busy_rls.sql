-- Simplify busy slots RLS
DROP POLICY IF EXISTS "Members can view each other's busy slots" ON public.user_busy_slots;

CREATE POLICY "Members can view each other's busy slots" ON public.user_busy_slots
FOR SELECT USING (
    user_id IN (
        SELECT user_id FROM public.group_members WHERE group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    )
    OR auth.uid() = user_id
);
