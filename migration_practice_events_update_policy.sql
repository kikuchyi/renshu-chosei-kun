-- Enable UPDATE policy for practice_events
-- Required for upsert operations

CREATE POLICY "Members can update practice events"
    ON practice_events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = practice_events.group_id
            AND group_members.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = practice_events.group_id
            AND group_members.user_id = auth.uid()
        )
    );
