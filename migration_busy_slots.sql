-- ユーザーの Google カレンダーの「予定あり」時間を保存するテーブル
CREATE TABLE IF NOT EXISTS public.user_busy_slots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, start_time)
);

ALTER TABLE public.user_busy_slots ENABLE ROW LEVEL SECURITY;

-- 自分の予定は自分で管理（挿入・削除・更新）できる
CREATE POLICY "Users can manage own busy slots" ON public.user_busy_slots
    FOR ALL USING (auth.uid() = user_id);

-- 同じグループのメンバーの予定（時間のみ）を参照できる
CREATE POLICY "Members can view each other's busy slots" ON public.user_busy_slots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members AS gm1
            JOIN public.group_members AS gm2 ON gm1.group_id = gm2.group_id
            WHERE gm1.user_id = auth.uid()
            AND gm2.user_id = user_busy_slots.user_id
        )
    );
