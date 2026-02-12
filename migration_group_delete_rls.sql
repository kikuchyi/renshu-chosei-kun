-- Allow members to leave groups (delete their own row)
CREATE POLICY "Members can leave groups" ON public.group_members
  FOR DELETE USING (auth.uid() = user_id);

-- Allow group owners to delete their groups, or anyone to delete if no members remain (auto-cleanup)
CREATE POLICY "Owners or auto-cleanup can delete groups" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
    OR
    NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = groups.id)
  );
