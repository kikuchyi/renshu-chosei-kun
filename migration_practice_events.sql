-- Create practice_events table for confirmed practice times
CREATE TABLE practice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, start_time)
);

-- Enable RLS
ALTER TABLE practice_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view practice events"
    ON practice_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = practice_events.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can create practice events"
    ON practice_events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = practice_events.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can delete practice events"
    ON practice_events FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = practice_events.group_id
            AND group_members.user_id = auth.uid()
        )
    );
