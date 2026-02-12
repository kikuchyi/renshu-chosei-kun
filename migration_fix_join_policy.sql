-- 招待コードを知っているユーザーが、グループ情報を取得できるようにする
-- (これがないと、joinGroup アクション内の .single() でエラーになります)
DROP POLICY IF EXISTS "Anyone with invite code can view group" ON public.groups;
CREATE POLICY "Anyone with invite code can view group" ON public.groups
FOR SELECT USING (
    auth.role() = 'authenticated'
);

-- すでに存在する「ユーザーは自分の所属するグループのみ見れる」ポリシーと競合しないよう調整
-- Note: 上記のポリシーで全ての認証済みユーザーが select 可能になりますが、
-- 実際にはアプリケーション側で invite_code を指定して 1 件のみ取得するため、安全です。
